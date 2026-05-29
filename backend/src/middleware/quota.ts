/**
 * quotaCheck — enforcement real de cuotas por org y periodo mensual.
 *
 * Modelo: usage_quotas guarda una fila por (org_id, user_id NULL, period, metric).
 * La cuota es a nivel ORG (user_id NULL = global de la org); el sublímite por
 * user queda como deuda (la columna existe pero Hito 1 usa cuota org global).
 *
 * Flujo del middleware quotaCheck(metric):
 *   1. Resuelve/crea la fila del periodo actual (rollover mensual lazy desde
 *      tier_policies).
 *   2. Si used_value >= limit_value → 402 { error:'quota_exceeded', metric,
 *      upgradeUrl }.
 *   3. Si pasa, deja seguir. El incremento real lo hace el handler con
 *      recordUsage() DESPUÉS de la operación exitosa (no se reserva por
 *      adelantado en Hito 1 — simple y suficiente para 1 req a la vez/usuario).
 *
 * recordUsage(orgId, metric, amount): UPDATE atómico used_value = used_value + N
 * sobre la fila del periodo; si no existe, la crea primero (idempotente).
 *
 * TODO-DEUDA(quota-reserve): para concurrencia alta, reservar antes y confirmar/
 *  liberar después (evita pasarse del límite con requests paralelas).
 * TODO-DEUDA(quota-per-user): sublímites por usuario dentro de la org.
 */
import type { Request, Response, NextFunction } from 'express';
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { usageQuotas, tierPolicies } from '../db/schema.js';

export type QuotaMetric = 'messages' | 'voice_seconds' | 'vault_bytes';

const UPGRADE_URL = '/m/upgrade';

/** Periodo actual 'YYYY-MM' en UTC (coherente con services/auth.ts). */
export function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

const POLICY_COLUMN: Record<QuotaMetric, 'quotaMessages' | 'quotaVoiceSeconds' | 'quotaVaultBytes'> = {
  messages: 'quotaMessages',
  voice_seconds: 'quotaVoiceSeconds',
  vault_bytes: 'quotaVaultBytes',
};

/** Límite base para (tier, metric) leído de tier_policies (fallback 0). */
async function limitFor(tier: string, metric: QuotaMetric): Promise<number> {
  const [policy] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, tier)).limit(1);
  if (!policy) return 0;
  return Number(policy[POLICY_COLUMN[metric]]);
}

/**
 * Devuelve la fila de cuota (org global) del periodo actual, creándola desde
 * tier_policies si no existe (rollover mensual lazy). Devuelve { limit, used }.
 */
export async function ensureQuotaRow(
  orgId: string,
  tier: string,
  metric: QuotaMetric
): Promise<{ limit: number; used: number }> {
  const period = currentPeriod();
  const existing = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.orgId, orgId),
        isNull(usageQuotas.userId),
        eq(usageQuotas.period, period),
        eq(usageQuotas.metric, metric)
      )
    )
    .limit(1);

  if (existing[0]) {
    return { limit: Number(existing[0].limitValue), used: Number(existing[0].usedValue) };
  }

  const limit = await limitFor(tier, metric);
  // Inserción idempotente: si una request paralela la creó, no falla.
  const inserted = await db
    .insert(usageQuotas)
    .values({ orgId, userId: null, period, metric, limitValue: limit, usedValue: 0 })
    .onConflictDoNothing({
      target: [usageQuotas.orgId, usageQuotas.userId, usageQuotas.period, usageQuotas.metric],
    })
    .returning();

  if (inserted[0]) return { limit: Number(inserted[0].limitValue), used: 0 };

  // Carrera: otra request la creó entre el SELECT y el INSERT → re-lee.
  const [row] = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.orgId, orgId),
        isNull(usageQuotas.userId),
        eq(usageQuotas.period, period),
        eq(usageQuotas.metric, metric)
      )
    )
    .limit(1);
  return { limit: row ? Number(row.limitValue) : limit, used: row ? Number(row.usedValue) : 0 };
}

/**
 * Incremento atómico de uso. Crea la fila del periodo si no existe.
 * No lanza si la org no tiene política (limit 0): registra igual el uso.
 */
export async function recordUsage(
  orgId: string,
  tier: string,
  metric: QuotaMetric,
  amount: number
): Promise<void> {
  if (amount <= 0) return;
  await ensureQuotaRow(orgId, tier, metric);
  const period = currentPeriod();
  await db
    .update(usageQuotas)
    .set({ usedValue: sql`${usageQuotas.usedValue} + ${amount}`, updatedAt: new Date() })
    .where(
      and(
        eq(usageQuotas.orgId, orgId),
        isNull(usageQuotas.userId),
        eq(usageQuotas.period, period),
        eq(usageQuotas.metric, metric)
      )
    );
}

/**
 * Middleware. Debe montarse después de authJwt + tenantContext.
 * Bloquea con 402 si la cuota del periodo está agotada.
 */
export function quotaCheck(metric: QuotaMetric) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const tenant = req.tenant;
    if (!tenant) {
      res.status(401).json({ error: 'No autenticado.' });
      return;
    }
    try {
      const { limit, used } = await ensureQuotaRow(tenant.orgId, tenant.tier, metric);
      if (used >= limit) {
        res.status(402).json({ error: 'quota_exceeded', metric, upgradeUrl: UPGRADE_URL });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
