/**
 * monitor — monitores proactivos sobre páginas web (Hito 4).
 *
 * runDueMonitors() recorre los monitores `enabled`, scrapea su target_url con
 * Playwright, evalúa el `criteria` contra el último valor extraído y, si se
 * cumple/cambió, crea una notification (in-app + espejo Telegram). Siempre
 * actualiza last_value/last_checked_at.
 *
 * Evaluación (`criteria` = { op, value }):
 *   - changed         → dispara si el texto extraído difiere del last_value.
 *   - lt/lte/gt/gte/eq/neq → compara numéricamente (extrae el primer número del
 *     texto, tolerante a $ y separadores es-CO) contra `value`.
 * Si no hay criteria válido → comportamiento 'changed' por defecto.
 *
 * El scheduler (setInterval no solapado) vive en scheduler.ts y llama aquí.
 *
 * TODO-DEUDA(monitor-criteria-ia): criterios en lenguaje natural evaluados por
 *  IA ("avísame si baja de 100 mil"); hoy es comparación numérica/texto simple.
 */
import { and, eq, lte } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { monitors, type Monitor } from '../../db/schema.js';
import { scrapeUrl, ScrapeError, type ScrapeOptions, type ScrapeResult } from './scraper.js';
import { createNotification } from '../notifications.js';

/**
 * Firma del scraper que usa el monitor. En producción es scrapeUrl (con guard
 * SSRF). Inyectable para tests (servidor local) sin desactivar el guard real.
 */
export type ScrapeFn = (url: string, opts?: ScrapeOptions) => Promise<ScrapeResult>;

export type CriteriaOp = 'changed' | 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';

interface Criteria {
  op: CriteriaOp;
  value?: number;
}

/** Extrae el primer número de un texto, tolerante a $ y separadores es-CO. */
export function extractNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  // Busca el primer grupo tipo 1.234.567,89 / 1,234.56 / 1234.56 / 1234
  const m = text.match(/-?\d[\d.,]*\d|\d/);
  if (!m) return null;
  let s = m[0];
  const lastComma = s.lastIndexOf(',');
  const lastDot = s.lastIndexOf('.');
  if (lastComma > lastDot) {
    s = s.replace(/\./g, '').replace(',', '.'); // es-CO/EU: coma decimal
  } else {
    s = s.replace(/,/g, ''); // en-US: punto decimal
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export interface MonitorEvaluation {
  triggered: boolean;
  newValue: string;
  reason: string;
}

/** Evalúa el criteria contra el valor anterior y el recién extraído. */
export function evaluateCriteria(
  rawCriteria: unknown,
  prevValue: string | null,
  scraped: { text: string; extracted: string | null }
): MonitorEvaluation {
  // El valor de interés: selector extraído si existe, si no el texto (recortado).
  const newValue = (scraped.extracted ?? scraped.text ?? '').slice(0, 2000).trim();
  const c = (rawCriteria ?? {}) as Criteria;
  const op: CriteriaOp = c.op ?? 'changed';

  if (op === 'changed') {
    const triggered = prevValue !== null && prevValue !== newValue;
    return {
      triggered,
      newValue,
      reason: triggered ? 'El contenido monitoreado cambió.' : 'Sin cambios.',
    };
  }

  // Operadores numéricos.
  const current = extractNumber(newValue);
  if (current === null || typeof c.value !== 'number') {
    return { triggered: false, newValue, reason: 'Sin valor numérico comparable.' };
  }
  let triggered = false;
  switch (op) {
    case 'lt': triggered = current < c.value; break;
    case 'lte': triggered = current <= c.value; break;
    case 'gt': triggered = current > c.value; break;
    case 'gte': triggered = current >= c.value; break;
    case 'eq': triggered = current === c.value; break;
    case 'neq': triggered = current !== c.value; break;
  }
  return {
    triggered,
    newValue,
    reason: triggered
      ? `Condición cumplida: ${current} ${op} ${c.value}.`
      : `Condición no cumplida: ${current} ${op} ${c.value}.`,
  };
}

export interface RunMonitorsResult {
  checked: number;
  triggered: number;
  errors: number;
}

/**
 * Ejecuta UN monitor: scrapea, evalúa, notifica si corresponde, actualiza
 * last_value. Aislado para test directo. Devuelve si disparó.
 */
export async function runMonitor(
  monitor: Monitor,
  scrapeFn: ScrapeFn = scrapeUrl
): Promise<{ triggered: boolean; error?: string }> {
  try {
    const scraped = await scrapeFn(monitor.targetUrl, {
      selector: monitor.selector ?? undefined,
    });
    const evalRes = evaluateCriteria(monitor.criteria, monitor.lastValue, scraped);

    if (evalRes.triggered) {
      await createNotification({
        userId: monitor.userId,
        orgId: monitor.orgId,
        kind: 'monitor',
        title: `Alerta: ${monitor.title}`,
        body: `${evalRes.reason}\nValor actual: ${evalRes.newValue.slice(0, 200)}`,
        data: {
          monitorId: monitor.id,
          oldValue: monitor.lastValue,
          newValue: evalRes.newValue,
          url: monitor.targetUrl,
        },
        alsoTelegram: true,
      });
    }

    await db
      .update(monitors)
      .set({ lastValue: evalRes.newValue, lastCheckedAt: new Date() })
      .where(eq(monitors.id, monitor.id));

    return { triggered: evalRes.triggered };
  } catch (err) {
    const msg = err instanceof ScrapeError ? `${err.code}: ${err.message}` : (err as Error).message;
    // Marca el check aunque falle (evita reintentos en bucle apretado).
    await db
      .update(monitors)
      .set({ lastCheckedAt: new Date() })
      .where(eq(monitors.id, monitor.id))
      .catch(() => {});
    console.error(`[monitor] ${monitor.id} (${monitor.targetUrl}) falló: ${msg}`);
    return { triggered: false, error: msg };
  }
}

/**
 * Recorre los monitores que toca revisar. `olderThanMs` evita re-chequear
 * monitores revisados hace poco (el scheduler corre cada 30min; con 25min de
 * gracia, un monitor recién creado/chequeado no se re-evalúa de inmediato).
 * Procesa en SERIE (un browser a la vez) para no saturar el VPS.
 */
export async function runDueMonitors(opts?: { olderThanMs?: number }): Promise<RunMonitorsResult> {
  const olderThanMs = opts?.olderThanMs ?? 25 * 60 * 1000;
  const cutoff = new Date(Date.now() - olderThanMs);

  // enabled AND (nunca chequeado OR chequeado antes del cutoff).
  const due = await db
    .select()
    .from(monitors)
    .where(
      and(
        eq(monitors.enabled, true),
        // last_checked_at IS NULL OR last_checked_at <= cutoff
        // drizzle: usamos OR vía sql en where compuesto
        // (se modela con lte tolerando null mediante coalesce abajo)
      )
    );

  let checked = 0;
  let triggered = 0;
  let errors = 0;
  for (const m of due) {
    if (m.lastCheckedAt && m.lastCheckedAt > cutoff) continue; // aún fresco
    checked++;
    const r = await runMonitor(m);
    if (r.triggered) triggered++;
    if (r.error) errors++;
  }
  void lte; // (referencia para futura optimización SQL del cutoff)
  return { checked, triggered, errors };
}
