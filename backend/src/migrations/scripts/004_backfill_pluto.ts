/**
 * 004_backfill_pluto.ts — Backfill del histórico financiero de Jerson (user_001)
 * desde el JSON de PLUTO hacia la tabla `transactions` de NEXUS V2.
 *
 * USO:
 *   tsx src/migrations/scripts/004_backfill_pluto.ts            (dry-run, NO escribe)
 *   tsx src/migrations/scripts/004_backfill_pluto.ts --execute  (backfill real)
 *
 * QUÉ HACE (da a Jerson un dashboard real desde el día 1):
 *   - payment_log[]            → transactions Confirmado (tipo según categoría).
 *   - one_time_expenses[]      → transactions Confirmado (Egreso/Deuda).
 *   - quincena_plans[].salidas_planeadas (estado aprobado) → Confirmado (gastos
 *     históricos de la quincena registrada).
 *   - income[] (salarios/aportes) → Ingreso Confirmado del periodo de la quincena.
 *   - debts/fixed_expenses/subscriptions → transactions "ancla" recurrentes
 *     (recurrence != null) usadas por summary() para "próximos pagos".
 *
 * IDEMPOTENTE: cada fila lleva un id determinista (UUID v5-like derivado del
 * source key) → ON CONFLICT (id) DO NOTHING. Re-ejecutar no duplica.
 *
 * SEGURIDAD: sólo toca nexus_v2. user_001 (Jerson) y sus 9 agentes intactos
 * (sólo INSERT en transactions). NO modifica usuarios/agentes/proyectos.
 */
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { eq, sql } from 'drizzle-orm';
import { db, pool } from '../../db/index.js';
import { users, transactions } from '../../db/schema.js';

const PLUTO_PATH = '/root/.claude/tools/pluto/finances/data.json';
const JERSON_EMAIL = 'jersonmendoza@eyesa.com.co';

type TxTipo = 'Egreso' | 'Ingreso' | 'Inversion' | 'Deuda';

interface PendingTx {
  /** clave estable para id determinista. */
  key: string;
  tipo: TxTipo;
  monto: number;
  currency: string;
  categoria: string | null;
  comercioOrigen: string | null;
  fechaHora: Date;
  estado: 'Confirmado';
  recurrence?: Record<string, unknown> | null;
  note?: string | null;
}

/** UUID determinista (formato v4-shaped) a partir de una clave de negocio. */
function detId(key: string): string {
  const h = createHash('sha1').update(`pluto:${key}`).digest('hex');
  // Da forma de UUID: 8-4-4-4-12.
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

/** Categoría → tipo de transacción. */
function tipoFromCategory(cat: string | undefined, fallback: TxTipo): TxTipo {
  if (!cat) return fallback;
  const c = cat.toLowerCase();
  if (c.includes('debt') || c.includes('deuda') || c.includes('credit') || c.includes('loan')) return 'Deuda';
  if (c.includes('income') || c.includes('salario') || c.includes('ingreso') || c.includes('aporte')) return 'Ingreso';
  return fallback;
}

function parseFlags() {
  const argv = process.argv.slice(2);
  return { execute: argv.includes('--execute') };
}

function buildPending(pluto: any): PendingTx[] {
  const out: PendingTx[] = [];
  const currency = pluto.meta?.currency ?? 'COP';

  // 1) payment_log (vacío hoy, pero soportado para el futuro).
  for (const p of pluto.payment_log ?? []) {
    if (!p.amount || !p.date) continue;
    out.push({
      key: `log:${p.id ?? `${p.date}:${p.name ?? p.concept ?? p.amount}`}`,
      tipo: tipoFromCategory(p.category ?? p.type, 'Egreso'),
      monto: Math.abs(Number(p.amount)),
      currency: p.currency ?? currency,
      categoria: p.category ?? null,
      comercioOrigen: p.name ?? p.concept ?? null,
      fechaHora: new Date(p.date),
      estado: 'Confirmado',
      note: p.notes ?? null,
    });
  }

  // 2) one_time_expenses → gastos puntuales confirmados.
  for (const e of pluto.one_time_expenses ?? []) {
    if (!e.amount || !e.date) continue;
    out.push({
      key: `onetime:${e.id ?? `${e.date}:${e.name}`}`,
      tipo: tipoFromCategory(e.category, 'Egreso'),
      monto: Math.abs(Number(e.amount)),
      currency: e.currency ?? currency,
      categoria: e.category ?? 'Otros',
      comercioOrigen: e.name ?? null,
      fechaHora: new Date(e.date),
      estado: 'Confirmado',
      note: e.notes ?? null,
    });
  }

  // 3) quincena_plans aprobadas → ingresos + salidas confirmadas del periodo.
  for (const q of pluto.quincena_plans ?? []) {
    if (q.estado !== 'aprobado_por_jerson') continue;
    const baseDate = q.fecha_quincena ? new Date(q.fecha_quincena) : new Date();

    // Ingresos de la quincena.
    const ing = q.ingresos ?? {};
    if (ing.salario_davivienda) {
      out.push({
        key: `q:${q.fecha_quincena}:salario`,
        tipo: 'Ingreso',
        monto: Number(ing.salario_davivienda),
        currency,
        categoria: 'Ingresos',
        comercioOrigen: 'Salario Davivienda',
        fechaHora: baseDate,
        estado: 'Confirmado',
        note: q.tipo ?? null,
      });
    }
    if (ing.aporte_jeraldine) {
      out.push({
        key: `q:${q.fecha_quincena}:aporte`,
        tipo: 'Ingreso',
        monto: Number(ing.aporte_jeraldine),
        currency,
        categoria: 'Ingresos',
        comercioOrigen: 'Aporte pareja',
        fechaHora: baseDate,
        estado: 'Confirmado',
        note: ing.aporte_jeraldine_nota ?? null,
      });
    }

    // Salidas planeadas (ya ejecutadas en la quincena aprobada).
    for (const s of q.salidas_planeadas ?? []) {
      if (!s.monto) continue;
      const esDeuda = /leasing|claro|crédito|credito|tarjeta|préstamo|prestamo/i.test(s.concepto ?? '');
      out.push({
        key: `q:${q.fecha_quincena}:salida:${s.orden}`,
        tipo: esDeuda ? 'Deuda' : 'Egreso',
        monto: Number(s.monto),
        currency,
        categoria: esDeuda ? 'Deudas' : 'Servicios',
        comercioOrigen: s.concepto ?? null,
        fechaHora: baseDate,
        estado: 'Confirmado',
        note: s.metodo ? `método: ${s.metodo}` : null,
      });
    }
  }

  // 4) Recurrentes (próximos pagos): debts, fixed_expenses, subscriptions.
  // Se crean como "anclas" Confirmadas con recurrence != null. El monto va con
  // fecha del 1° del mes pasado para no inflar el balance del mes actual (no son
  // gastos del mes corriente, son plantillas de recurrencia).
  const anchorDate = (() => {
    const n = new Date();
    return new Date(Date.UTC(n.getUTCFullYear(), n.getUTCMonth() - 1, 1));
  })();

  for (const d of pluto.debts ?? []) {
    const amount = Number(d.monthly_payment ?? d.min_payment ?? d.min_payment_total ?? 0);
    if (!amount) continue;
    out.push({
      key: `debt:${d.id}`,
      tipo: 'Deuda',
      monto: amount,
      currency,
      categoria: 'Deudas',
      comercioOrigen: d.name ?? d.id,
      fechaHora: anchorDate,
      estado: 'Confirmado',
      recurrence: { freq: 'monthly', dueDay: d.due_day ?? 1, source: 'debt', label: d.name ?? d.id },
      note: d.notes ?? null,
    });
  }

  for (const f of pluto.fixed_expenses ?? []) {
    const amount = Number(f.real_amount ?? f.amount ?? f.estimated ?? 0);
    if (!amount) continue;
    out.push({
      key: `fixed:${f.id}`,
      tipo: 'Egreso',
      monto: amount,
      currency,
      categoria: f.name?.toLowerCase().includes('mercado') ? 'Alimentación' : 'Servicios',
      comercioOrigen: f.name ?? f.id,
      fechaHora: anchorDate,
      estado: 'Confirmado',
      recurrence: { freq: f.frequency ?? 'monthly', dueDay: 15, source: 'fixed', label: f.name ?? f.id },
      note: f.notes ?? null,
    });
  }

  for (const s of pluto.subscriptions?.active ?? []) {
    const amount = Number(s.amount_cop ?? 0);
    if (!amount) continue; // las bundled/variables (Rappi, Disney) no tienen monto
    out.push({
      key: `sub:${s.id}`,
      tipo: 'Egreso',
      monto: amount,
      currency: 'COP',
      categoria: 'Suscripciones',
      comercioOrigen: s.name ?? s.id,
      fechaHora: anchorDate,
      estado: 'Confirmado',
      recurrence: { freq: 'monthly', dueDay: s.renewal_day ?? 1, source: 'subscription', label: s.name ?? s.id },
      note: s.notes ?? null,
    });
  }

  return out;
}

async function main() {
  const { execute } = parseFlags();
  const pluto = JSON.parse(readFileSync(PLUTO_PATH, 'utf8'));

  const [jerson] = await db
    .select({ id: users.id, orgId: users.defaultOrgId })
    .from(users)
    .where(eq(users.email, JERSON_EMAIL))
    .limit(1);
  if (!jerson?.id || !jerson.orgId) {
    throw new Error(`No se encontró user_001 (${JERSON_EMAIL}) con org. ¿Corriste 001_jerson_to_user?`);
  }

  const pending = buildPending(pluto);
  const byTipo = pending.reduce<Record<string, number>>((acc, p) => {
    acc[p.tipo] = (acc[p.tipo] ?? 0) + 1;
    return acc;
  }, {});
  const recurrentes = pending.filter((p) => p.recurrence).length;

  console.log('═'.repeat(70));
  console.log(`  BACKFILL PLUTO → transactions  ·  user_001  ·  ${execute ? 'EXECUTE' : 'DRY-RUN'}`);
  console.log('═'.repeat(70));
  console.log(`  Transacciones a insertar: ${pending.length}`);
  console.log(`    por tipo: ${JSON.stringify(byTipo)}`);
  console.log(`    recurrentes (próximos pagos): ${recurrentes}`);

  if (!execute) {
    console.log('\n  DRY-RUN: no se escribió nada. Añade --execute para aplicar.');
    await pool.end();
    return;
  }

  let inserted = 0;
  for (const p of pending) {
    const rows = await db
      .insert(transactions)
      .values({
        id: detId(p.key),
        userId: jerson.id,
        orgId: jerson.orgId,
        tipo: p.tipo,
        monto: String(p.monto),
        currency: p.currency,
        categoria: p.categoria,
        comercioOrigen: p.comercioOrigen,
        fechaHora: p.fechaHora,
        canalOrigen: 'Manual',
        estado: 'Confirmado',
        legitimo: true,
        confidence: 100,
        recurrence: p.recurrence ?? null,
        classification: { source: 'pluto-backfill' },
        note: p.note ?? null,
        confirmedAt: p.fechaHora,
      })
      .onConflictDoNothing({ target: transactions.id })
      .returning({ id: transactions.id });
    if (rows.length) inserted++;
  }

  const countRows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(eq(transactions.userId, jerson.id));
  const count = countRows[0]?.count ?? 0;

  console.log(`\n  ✓ Insertadas ${inserted} nuevas (idempotente).`);
  console.log(`  Total transactions de user_001 ahora: ${count}`);
  await pool.end();
}

main().catch(async (err) => {
  console.error('[004_backfill_pluto] ERROR:', err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
