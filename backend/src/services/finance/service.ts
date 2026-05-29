/**
 * Servicio de Finanzas — CRUD de transacciones + summary, todo scoped por
 * tenant. Implementa el flujo Human-in-the-Loop:
 *
 *   createDraft   → estado 'Borrador' (NO afecta balance).
 *   approve       → 'Confirmado' + confirmed_at (SÍ entra al balance).
 *   reject        → 'Rechazado' + rejected_at (nunca cuenta).
 *   createManual  → 'Confirmado' directo (entrada a mano).
 *
 * REGLA: el balance/summary SÓLO suma estado='Confirmado'. Borradores y
 * rechazados no mueven el balance.
 *
 * Aislamiento: todo pasa por filtros user_id explícitos (find/update por
 * (id AND user_id) → 0 filas si es de otro tenant → null/404).
 */
import { and, eq, gte, lt, sql, desc } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  transactions,
  transactionEmailEvidence,
  users,
  type Transaction,
  type TransactionEmailEvidence,
} from '../../db/schema.js';
import type { Classification, TxTipo } from './classifier.js';

export class FinanceError extends Error {
  constructor(
    public code: 'not_found' | 'invalid' | 'org_unresolved',
    message: string
  ) {
    super(message);
    this.name = 'FinanceError';
  }
}

const VALID_TIPOS: TxTipo[] = ['Egreso', 'Ingreso', 'Inversion', 'Deuda'];
const VALID_CANALES = ['Gmail', 'OCR', 'Manual', 'Sync'] as const;
type Canal = (typeof VALID_CANALES)[number];

/** Resuelve la org del usuario (default_org_id) para insertar transacciones. */
async function resolveOrgId(userId: string): Promise<string> {
  const [u] = await db
    .select({ orgId: users.defaultOrgId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u?.orgId) throw new FinanceError('org_unresolved', 'El usuario no tiene organización asignada.');
  return u.orgId;
}

export interface CreateDraftInput {
  classification: Classification;
  canal: Canal;
  evidenceId?: string | null;
  note?: string | null;
}

/** Inserta un Borrador (no afecta balance). */
export async function createDraft(userId: string, input: CreateDraftInput): Promise<Transaction> {
  const orgId = await resolveOrgId(userId);
  const c = input.classification;
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      orgId,
      tipo: c.tipo,
      monto: String(c.monto),
      currency: c.currency,
      categoria: c.categoria,
      comercioOrigen: c.comercioOrigen,
      fechaHora: c.fechaHora ? new Date(c.fechaHora) : new Date(),
      canalOrigen: input.canal,
      estado: 'Borrador',
      legitimo: c.legitimo,
      confidence: c.confidence,
      evidenceId: input.evidenceId ?? null,
      classification: {
        reason: c.reason ?? null,
        redacted: c.redacted,
        model: c.model ?? null,
      },
      note: input.note ?? null,
    })
    .returning();
  return row!;
}

export interface CreateManualInput {
  tipo: TxTipo;
  monto: number;
  currency?: string;
  categoria?: string | null;
  comercioOrigen?: string | null;
  fechaHora?: string | null;
  note?: string | null;
  recurrence?: Record<string, unknown> | null;
}

/** Entrada manual: se confirma directamente (el humano la está escribiendo). */
export async function createManual(userId: string, input: CreateManualInput): Promise<Transaction> {
  if (!VALID_TIPOS.includes(input.tipo)) {
    throw new FinanceError('invalid', `tipo inválido: ${input.tipo}`);
  }
  const monto = Number(input.monto);
  if (!Number.isFinite(monto) || monto <= 0) {
    throw new FinanceError('invalid', 'monto debe ser un número positivo.');
  }
  const orgId = await resolveOrgId(userId);
  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      orgId,
      tipo: input.tipo,
      monto: String(monto),
      currency: input.currency?.trim() || 'COP',
      categoria: input.categoria ?? null,
      comercioOrigen: input.comercioOrigen ?? null,
      fechaHora: input.fechaHora ? new Date(input.fechaHora) : new Date(),
      canalOrigen: 'Manual',
      estado: 'Confirmado',
      legitimo: true,
      confidence: 100,
      recurrence: input.recurrence ?? null,
      note: input.note ?? null,
      confirmedAt: new Date(),
    })
    .returning();
  return row!;
}

/** Aprueba un Borrador → Confirmado. 404 si no es del tenant o no existe. */
export async function approve(userId: string, txId: string): Promise<Transaction> {
  const [row] = await db
    .update(transactions)
    .set({ estado: 'Confirmado', confirmedAt: new Date(), rejectedAt: null })
    .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)))
    .returning();
  if (!row) throw new FinanceError('not_found', 'Transacción no encontrada.');
  return row;
}

/** Rechaza un Borrador → Rechazado (no afecta balance). */
export async function reject(userId: string, txId: string): Promise<Transaction> {
  const [row] = await db
    .update(transactions)
    .set({ estado: 'Rechazado', rejectedAt: new Date(), confirmedAt: null })
    .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)))
    .returning();
  if (!row) throw new FinanceError('not_found', 'Transacción no encontrada.');
  return row;
}

export interface ListFilters {
  estado?: string;
  tipo?: string;
  canal?: string;
  from?: string; // ISO
  to?: string; // ISO
  limit?: number;
}

/** Lista transacciones del tenant con filtros opcionales (orden fecha desc). */
export async function listTransactions(userId: string, filters: ListFilters = {}): Promise<Transaction[]> {
  const conds = [eq(transactions.userId, userId)];
  if (filters.estado) conds.push(eq(transactions.estado, filters.estado));
  if (filters.tipo) conds.push(eq(transactions.tipo, filters.tipo));
  if (filters.canal) conds.push(eq(transactions.canalOrigen, filters.canal));
  if (filters.from) conds.push(gte(transactions.fechaHora, new Date(filters.from)));
  if (filters.to) conds.push(lt(transactions.fechaHora, new Date(filters.to)));

  const limit = Math.min(Math.max(filters.limit ?? 200, 1), 500);
  return db
    .select()
    .from(transactions)
    .where(and(...conds))
    .orderBy(desc(transactions.fechaHora))
    .limit(limit);
}

export interface TransactionWithEvidence {
  transaction: Transaction;
  evidence: TransactionEmailEvidence | null;
}

/** Obtiene una transacción del tenant + su evidencia (si la tiene). */
export async function getTransaction(userId: string, txId: string): Promise<TransactionWithEvidence | null> {
  const [tx] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, txId), eq(transactions.userId, userId)))
    .limit(1);
  if (!tx) return null;

  let evidence: TransactionEmailEvidence | null = null;
  if (tx.evidenceId) {
    const [ev] = await db
      .select()
      .from(transactionEmailEvidence)
      .where(and(eq(transactionEmailEvidence.id, tx.evidenceId), eq(transactionEmailEvidence.userId, userId)))
      .limit(1);
    evidence = ev ?? null;
  }
  return { transaction: tx, evidence };
}

// ── Summary / dashboard ─────────────────────────────────────────────────────

export interface CategoryTotal {
  categoria: string;
  amount: number;
}
export interface WeeklyPoint {
  d: string; // etiqueta día (Lun..Dom)
  in: number;
  out: number;
}
export interface UpcomingPayment {
  name: string;
  amount: number;
  date: string; // 'YYYY-MM-DD'
  dueDay: number;
  source: string;
}
export interface FinanceSummary {
  period: string; // 'YYYY-MM'
  currency: string;
  balanceMonth: number; // Confirmado: Ingreso - (Egreso+Deuda+Inversion)
  income: number;
  expense: number;
  vsPrev: number; // % variación del balance vs mes anterior (entero redondeado)
  topCategories: CategoryTotal[];
  weekly: WeeklyPoint[];
  upcoming: UpcomingPayment[];
}

function monthBounds(period: string): { start: Date; end: Date } {
  const parts = period.split('-').map(Number);
  const y = parts[0] ?? new Date().getUTCFullYear();
  const m = parts[1] ?? 1;
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 1));
  return { start, end };
}

function prevPeriod(period: string): string {
  const parts = period.split('-').map(Number);
  const y = parts[0] ?? new Date().getUTCFullYear();
  const m = parts[1] ?? 1;
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

/** Suma confirmada del mes: ingresos − egresos (Egreso+Deuda+Inversion). */
async function confirmedTotals(
  userId: string,
  start: Date,
  end: Date
): Promise<{ income: number; expense: number }> {
  const rows = await db
    .select({
      tipo: transactions.tipo,
      total: sql<string>`coalesce(sum(${transactions.monto}), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.estado, 'Confirmado'),
        // Las anclas recurrentes (recurrence != null) NO son gasto real del mes:
        // existen sólo para alimentar "próximos pagos". No suman al balance.
        sql`${transactions.recurrence} is null`,
        gte(transactions.fechaHora, start),
        lt(transactions.fechaHora, end)
      )
    )
    .groupBy(transactions.tipo);

  let income = 0;
  let expense = 0;
  for (const r of rows) {
    const n = Number(r.total);
    if (r.tipo === 'Ingreso') income += n;
    else expense += n; // Egreso + Deuda + Inversion cuentan como salida
  }
  return { income, expense };
}

/** Resumen financiero del periodo (default: mes actual UTC). */
export async function summary(userId: string, period?: string): Promise<FinanceSummary> {
  const now = new Date();
  const per = period ?? `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  const { start, end } = monthBounds(per);

  const [cur, prev] = await Promise.all([
    confirmedTotals(userId, start, end),
    (async () => {
      const pb = monthBounds(prevPeriod(per));
      return confirmedTotals(userId, pb.start, pb.end);
    })(),
  ]);

  const balanceMonth = cur.income - cur.expense;
  const prevBalance = prev.income - prev.expense;
  const vsPrev =
    prevBalance === 0 ? 0 : Math.round(((balanceMonth - prevBalance) / Math.abs(prevBalance)) * 100);

  // Top categorías de egresos confirmados del mes.
  const catRows = await db
    .select({
      categoria: sql<string>`coalesce(${transactions.categoria}, 'Otros')`,
      amount: sql<string>`sum(${transactions.monto})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.estado, 'Confirmado'),
        sql`${transactions.tipo} <> 'Ingreso'`,
        sql`${transactions.recurrence} is null`,
        gte(transactions.fechaHora, start),
        lt(transactions.fechaHora, end)
      )
    )
    .groupBy(sql`coalesce(${transactions.categoria}, 'Otros')`)
    .orderBy(desc(sql`sum(${transactions.monto})`))
    .limit(5);
  const topCategories: CategoryTotal[] = catRows.map((r) => ({
    categoria: r.categoria,
    amount: Number(r.amount),
  }));

  // Serie semanal (últimos 7 días móviles desde hoy): ingresos/egresos confirmados.
  const weekly = await weeklySeries(userId);

  // Próximos pagos: recurrentes confirmados del usuario (recurrence != null).
  const upcoming = await upcomingPayments(userId);

  return {
    period: per,
    currency: 'COP',
    balanceMonth,
    income: cur.income,
    expense: cur.expense,
    vsPrev,
    topCategories,
    weekly,
    upcoming,
  };
}

const DAY_LABELS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

/** Serie de los últimos 7 días (in/out confirmados) en orden cronológico. */
async function weeklySeries(userId: string): Promise<WeeklyPoint[]> {
  const today = new Date();
  const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + 1));

  const rows = await db
    .select({
      day: sql<string>`to_char(${transactions.fechaHora} at time zone 'UTC', 'YYYY-MM-DD')`,
      tipo: transactions.tipo,
      total: sql<string>`sum(${transactions.monto})`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.estado, 'Confirmado'),
        sql`${transactions.recurrence} is null`,
        gte(transactions.fechaHora, start),
        lt(transactions.fechaHora, end)
      )
    )
    .groupBy(sql`to_char(${transactions.fechaHora} at time zone 'UTC', 'YYYY-MM-DD')`, transactions.tipo);

  const byDay = new Map<string, { in: number; out: number }>();
  for (const r of rows) {
    const cur = byDay.get(r.day) ?? { in: 0, out: 0 };
    if (r.tipo === 'Ingreso') cur.in += Number(r.total);
    else cur.out += Number(r.total);
    byDay.set(r.day, cur);
  }

  const out: WeeklyPoint[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate() + i));
    const key = d.toISOString().slice(0, 10);
    const v = byDay.get(key) ?? { in: 0, out: 0 };
    out.push({ d: DAY_LABELS[d.getUTCDay()] ?? '', in: v.in, out: v.out });
  }
  return out;
}

/** Próximos pagos derivados de transacciones recurrentes (recurrence != null). */
async function upcomingPayments(userId: string): Promise<UpcomingPayment[]> {
  const rows = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.userId, userId), sql`${transactions.recurrence} is not null`));

  const today = new Date();
  const seen = new Set<string>();
  const list: UpcomingPayment[] = [];
  for (const r of rows) {
    const rec = (r.recurrence ?? {}) as Record<string, unknown>;
    const dueDay = Number(rec.dueDay);
    const label = (rec.label as string) || r.comercioOrigen || r.categoria || 'Pago recurrente';
    if (seen.has(label)) continue;
    seen.add(label);
    if (!Number.isFinite(dueDay) || dueDay < 1 || dueDay > 31) continue;

    // Próxima fecha con ese día de vencimiento (este mes o el siguiente).
    let target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), dueDay));
    if (target < today) target = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, dueDay));

    list.push({
      name: label,
      amount: Number(r.monto),
      date: target.toISOString().slice(0, 10),
      dueDay,
      source: (rec.source as string) || 'recurrente',
    });
  }
  list.sort((a, b) => a.date.localeCompare(b.date));
  return list.slice(0, 6);
}

// ── Evidencia de correo (ingesta) ───────────────────────────────────────────

export interface UpsertEvidenceInput {
  gmailMsgId: string;
  subject?: string | null;
  fromAddr?: string | null;
  receivedAt?: string | null;
  /** Texto YA redactado por TokenGuard; se trunca a 4KB. */
  rawExcerptRedacted: string;
  classification: Record<string, unknown>;
}

const MAX_EXCERPT = 4096;

/**
 * Upsert idempotente de evidencia por (user_id, gmail_msg_id). Devuelve la fila.
 * raw_excerpt DEBE venir ya redactado por el caller (no se redacta aquí).
 */
export async function upsertEvidence(
  userId: string,
  input: UpsertEvidenceInput
): Promise<TransactionEmailEvidence> {
  const excerpt = input.rawExcerptRedacted.slice(0, MAX_EXCERPT);
  const [row] = await db
    .insert(transactionEmailEvidence)
    .values({
      userId,
      gmailMsgId: input.gmailMsgId,
      subject: input.subject ?? null,
      fromAddr: input.fromAddr ?? null,
      receivedAt: input.receivedAt ? new Date(input.receivedAt) : null,
      rawExcerpt: excerpt,
      classification: input.classification,
    })
    .onConflictDoUpdate({
      target: [transactionEmailEvidence.userId, transactionEmailEvidence.gmailMsgId],
      set: {
        subject: input.subject ?? null,
        fromAddr: input.fromAddr ?? null,
        rawExcerpt: excerpt,
        classification: input.classification,
      },
    })
    .returning();
  return row!;
}

/** ¿Ya existe evidencia para este (user, gmail_msg_id)? (idempotencia de ingesta). */
export async function evidenceExists(userId: string, gmailMsgId: string): Promise<TransactionEmailEvidence | null> {
  const [row] = await db
    .select()
    .from(transactionEmailEvidence)
    .where(
      and(eq(transactionEmailEvidence.userId, userId), eq(transactionEmailEvidence.gmailMsgId, gmailMsgId))
    )
    .limit(1);
  return row ?? null;
}
