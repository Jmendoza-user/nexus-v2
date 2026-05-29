/**
 * service.ts — lógica de negocio de facturación (Hito 5).
 *
 * Responsabilidades:
 *  - listPlans(): catálogo comercial (plans) ordenado.
 *  - getCurrentSubscription(orgId): suscripción + uso vs límites del periodo.
 *  - changeTier(orgId, tier): aplica el cambio de plan de forma transaccional:
 *      · upsert de subscriptions (tier/status/periodo/cancel flag),
 *      · actualiza organizations.tier y users.tier de TODOS los miembros,
 *      · RE-SIEMBRA usage_quotas del periodo actual con los nuevos límites,
 *        PRESERVANDO lo ya consumido (ajusta limit, mantiene used).
 *  - cancelAtPeriodEnd(orgId): marca cancel_at_period_end (no degrada al instante;
 *    la degradación a free la hará el ciclo/cron o el webhook de fin de periodo).
 *  - processWebhookEvent(): aplica un evento de MP a subscriptions/tier de forma
 *    idempotente por provider_event_id.
 *
 * IMPORTANTE (JWT tier): el tier viaja en el JWT de sesión. Tras changeTier, el
 * token existente sigue con el tier viejo hasta el próximo login/refresh. Las
 * cuotas se enforced por tier_policies a través de la ORG (organizations.tier se
 * actualiza aquí), pero el middleware tenantContext lee tier del JWT. Para que el
 * cambio surta efecto completo en runtime, el cliente debe re-loguear o renovar
 * el token. Documentado como TODO-DEUDA(billing-jwt-refresh).
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../../db/index.js';
import {
  plans,
  subscriptions,
  organizations,
  orgMembers,
  users,
  usageQuotas,
  tierPolicies,
  billingEvents,
  type Plan,
} from '../../db/schema.js';
import { currentPeriod, type QuotaMetric } from '../../middleware/quota.js';

export type Tier = 'free' | 'pro' | 'team';
export const TIERS: readonly Tier[] = ['free', 'pro', 'team'] as const;
export function isTier(t: string): t is Tier {
  return (TIERS as readonly string[]).includes(t);
}

export class BillingError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
    this.name = 'BillingError';
  }
}

const METRICS: readonly QuotaMetric[] = ['messages', 'voice_seconds', 'vault_bytes'] as const;
const POLICY_COLUMN: Record<QuotaMetric, 'quotaMessages' | 'quotaVoiceSeconds' | 'quotaVaultBytes'> = {
  messages: 'quotaMessages',
  voice_seconds: 'quotaVoiceSeconds',
  vault_bytes: 'quotaVaultBytes',
};

/** Catálogo comercial de planes (ordenado por sort_order). */
export async function listPlans(): Promise<Plan[]> {
  return db.select().from(plans).orderBy(plans.sortOrder);
}

/** Periodo actual 'YYYY-MM' (UTC) — re-exporta la fuente única. */
export { currentPeriod };

function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}
function periodEnd(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));
}

export interface SubscriptionView {
  orgId: string;
  tier: string;
  status: string;
  provider: string;
  providerSubId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: Plan | null;
  quotas: { metric: QuotaMetric; limit: number; used: number; period: string }[];
}

/**
 * Suscripción actual del org + uso del periodo vs límites del tier vigente.
 * Si no hay fila de subscriptions, sintetiza una vista 'free/active' a partir de
 * organizations.tier (toda org tiene tier; subscriptions puede no existir aún).
 */
export async function getCurrentSubscription(orgId: string): Promise<SubscriptionView> {
  const [org] = await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
  if (!org) throw new BillingError(404, 'org_not_found', 'Organización no encontrada.');

  const [sub] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .orderBy(sql`${subscriptions.createdAt} desc`)
    .limit(1);

  const effectiveTier = sub?.tier ?? org.tier;
  const [plan] = await db.select().from(plans).where(eq(plans.tier, effectiveTier)).limit(1);

  // Uso del periodo (cuota org global, user_id NULL) por métrica.
  const period = currentPeriod();
  const quotaRows = await db
    .select()
    .from(usageQuotas)
    .where(and(eq(usageQuotas.orgId, orgId), isNull(usageQuotas.userId), eq(usageQuotas.period, period)));

  const limitsByTier = await tierLimits(effectiveTier);
  const quotas = METRICS.map((metric) => {
    const row = quotaRows.find((q) => q.metric === metric);
    return {
      metric,
      limit: row ? Number(row.limitValue) : limitsByTier[metric],
      used: row ? Number(row.usedValue) : 0,
      period,
    };
  });

  return {
    orgId,
    tier: effectiveTier,
    status: sub?.status ?? 'active',
    provider: sub?.provider ?? 'mercadopago',
    providerSubId: sub?.providerSubId ?? null,
    currentPeriodStart: sub?.currentPeriodStart?.toISOString() ?? null,
    currentPeriodEnd: sub?.currentPeriodEnd?.toISOString() ?? null,
    cancelAtPeriodEnd: sub?.cancelAtPeriodEnd ?? false,
    plan: plan ?? null,
    quotas,
  };
}

/** Límites base (limit por métrica) del tier desde tier_policies. */
async function tierLimits(tier: string): Promise<Record<QuotaMetric, number>> {
  const [p] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, tier)).limit(1);
  if (!p) return { messages: 0, voice_seconds: 0, vault_bytes: 0 };
  return {
    messages: Number(p[POLICY_COLUMN.messages]),
    voice_seconds: Number(p[POLICY_COLUMN.voice_seconds]),
    vault_bytes: Number(p[POLICY_COLUMN.vault_bytes]),
  };
}

export interface ChangeTierResult {
  orgId: string;
  tier: Tier;
  quotas: { metric: QuotaMetric; limit: number; used: number }[];
}

/**
 * Aplica un cambio de tier al org. Transaccional. Idempotente respecto al uso:
 * re-siembra usage_quotas del periodo con los NUEVOS límites preservando used.
 *
 * @param status estado de la suscripción resultante (active por defecto). Un
 *   downgrade a free puede llegar como 'cancelled' desde el webhook; aquí lo
 *   normalizamos a 'active' salvo que se indique lo contrario.
 */
export async function changeTier(
  orgId: string,
  tier: Tier,
  opts?: {
    provider?: string;
    providerSubId?: string | null;
    status?: string;
    cancelAtPeriodEnd?: boolean;
  }
): Promise<ChangeTierResult> {
  if (!isTier(tier)) throw new BillingError(400, 'invalid_tier', 'Plan no válido.');

  const limits = await tierLimits(tier);
  const period = currentPeriod();
  const status = opts?.status ?? 'active';

  const result = await db.transaction(async (tx) => {
    const [org] = await tx.select().from(organizations).where(eq(organizations.id, orgId)).limit(1);
    if (!org) throw new BillingError(404, 'org_not_found', 'Organización no encontrada.');

    // 1. organizations.tier
    await tx.update(organizations).set({ tier }).where(eq(organizations.id, orgId));

    // 2. users.tier de TODOS los miembros del org (cuota org-global pero el tier
    //    del usuario también se alinea para el JWT del próximo login).
    const members = await tx.select({ userId: orgMembers.userId }).from(orgMembers).where(eq(orgMembers.orgId, orgId));
    for (const m of members) {
      await tx.update(users).set({ tier }).where(eq(users.id, m.userId));
    }

    // 3. subscriptions: upsert (una fila viva por org; usamos la más reciente).
    const [existing] = await tx
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.orgId, orgId))
      .orderBy(sql`${subscriptions.createdAt} desc`)
      .limit(1);

    const subValues = {
      tier,
      status,
      provider: opts?.provider ?? existing?.provider ?? 'mercadopago',
      providerSubId: opts?.providerSubId ?? existing?.providerSubId ?? null,
      currentPeriodStart: periodStart(),
      currentPeriodEnd: periodEnd(),
      cancelAtPeriodEnd: opts?.cancelAtPeriodEnd ?? false,
      updatedAt: new Date(),
    };

    if (existing) {
      await tx.update(subscriptions).set(subValues).where(eq(subscriptions.id, existing.id));
    } else {
      await tx.insert(subscriptions).values({ orgId, ...subValues });
    }

    // 4. RE-SIEMBRA usage_quotas del periodo: ajusta limit al nuevo tier,
    //    PRESERVA used (no se pierde lo ya consumido; un downgrade no borra el
    //    consumo, solo baja el techo → futuras acciones se bloquean si used>=limit).
    const quotaOut: { metric: QuotaMetric; limit: number; used: number }[] = [];
    for (const metric of METRICS) {
      const newLimit = limits[metric];
      const [existingQuota] = await tx
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

      if (existingQuota) {
        await tx
          .update(usageQuotas)
          .set({ limitValue: newLimit, updatedAt: new Date() })
          .where(eq(usageQuotas.id, existingQuota.id));
        quotaOut.push({ metric, limit: newLimit, used: Number(existingQuota.usedValue) });
      } else {
        await tx
          .insert(usageQuotas)
          .values({ orgId, userId: null, period, metric, limitValue: newLimit, usedValue: 0 });
        quotaOut.push({ metric, limit: newLimit, used: 0 });
      }
    }

    return { orgId, tier, quotas: quotaOut };
  });

  return result;
}

/**
 * Marca la suscripción del org para cancelarse al fin del periodo. NO degrada de
 * inmediato (el usuario conserva su tier hasta current_period_end). La
 * degradación efectiva a free la dispara el webhook de fin de periodo o un cron
 * de ciclo (deuda: cron de degradación).
 */
export async function cancelAtPeriodEnd(orgId: string): Promise<SubscriptionView> {
  const [existing] = await db
    .select()
    .from(subscriptions)
    .where(eq(subscriptions.orgId, orgId))
    .orderBy(sql`${subscriptions.createdAt} desc`)
    .limit(1);

  if (!existing) {
    // Sin suscripción (probablemente free): nada que cancelar.
    throw new BillingError(409, 'no_active_subscription', 'No tienes una suscripción activa que cancelar.');
  }
  if (existing.tier === 'free') {
    throw new BillingError(409, 'free_plan', 'El plan Free no tiene nada que cancelar.');
  }

  await db
    .update(subscriptions)
    .set({ cancelAtPeriodEnd: true, updatedAt: new Date() })
    .where(eq(subscriptions.id, existing.id));

  return getCurrentSubscription(orgId);
}

/** Registra un evento de facturación (auditoría). Idempotente por providerEventId. */
export async function recordBillingEvent(input: {
  orgId?: string | null;
  provider?: string;
  eventType: string;
  providerEventId?: string | null;
  payload?: unknown;
  processed?: boolean;
}): Promise<{ id: string; duplicate: boolean }> {
  const insertValues = {
    orgId: input.orgId ?? null,
    provider: input.provider ?? 'mercadopago',
    eventType: input.eventType,
    providerEventId: input.providerEventId ?? null,
    payload: (input.payload ?? {}) as object,
    processed: input.processed ?? false,
  };

  // Idempotencia por providerEventId. El índice parcial garantiza la unicidad a
  // nivel DB (anti-carrera); aquí hacemos un check-then-insert para devolver el
  // flag `duplicate` de forma clara. Eventos internos sin providerEventId (NULL)
  // se insertan siempre (nunca son "duplicados").
  if (input.providerEventId) {
    const [existing] = await db
      .select({ id: billingEvents.id })
      .from(billingEvents)
      .where(eq(billingEvents.providerEventId, input.providerEventId))
      .limit(1);
    if (existing) return { id: existing.id, duplicate: true };
  }

  const inserted = await db.insert(billingEvents).values(insertValues).returning({ id: billingEvents.id });
  return { id: inserted[0]!.id, duplicate: false };
}

export type WebhookOutcome =
  | { processed: false; reason: 'not_configured' | 'duplicate' | 'unhandled' | 'no_org'; eventId?: string }
  | { processed: true; eventId: string; tier?: Tier; action: string };

/**
 * Procesa un evento de webhook de MercadoPago de forma idempotente.
 *
 * Mapea eventos a acciones sobre subscriptions/tier:
 *  - payment.approved / subscription.authorized → activa el tier de la metadata.
 *  - subscription.updated → re-aplica el tier (renovación/cambio).
 *  - payment.rejected → marca past_due (sin degradar de inmediato).
 *  - subscription.cancelled → degrada a free (changeTier free, status cancelled).
 *
 * `event` es una forma normalizada del payload de MP (el router extrae los
 * campos relevantes). Si falta org/tier resolvibles, se registra como unhandled.
 */
export async function processWebhookEvent(event: {
  providerEventId?: string | null;
  type: string;
  orgId?: string | null;
  tier?: string | null;
  raw?: unknown;
}): Promise<WebhookOutcome> {
  // Idempotencia + auditoría: registra primero. Si es duplicado, no re-aplica.
  const rec = await recordBillingEvent({
    orgId: event.orgId ?? null,
    provider: 'mercadopago',
    eventType: event.type,
    providerEventId: event.providerEventId ?? null,
    payload: event.raw ?? event,
    processed: false,
  });
  if (rec.duplicate) return { processed: false, reason: 'duplicate', eventId: rec.id };

  const orgId = event.orgId;
  if (!orgId) return { processed: false, reason: 'no_org', eventId: rec.id };

  let action = '';
  let appliedTier: Tier | undefined;

  switch (event.type) {
    case 'payment.approved':
    case 'subscription.authorized':
    case 'subscription.updated': {
      const tier = event.tier && isTier(event.tier) ? event.tier : null;
      if (!tier) return { processed: false, reason: 'unhandled', eventId: rec.id };
      await changeTier(orgId, tier, { provider: 'mercadopago', status: 'active' });
      action = `tier→${tier} (active)`;
      appliedTier = tier;
      break;
    }
    case 'payment.rejected':
    case 'payment.pending': {
      await db
        .update(subscriptions)
        .set({ status: event.type === 'payment.rejected' ? 'past_due' : 'pending', updatedAt: new Date() })
        .where(eq(subscriptions.orgId, orgId));
      action = `status→${event.type === 'payment.rejected' ? 'past_due' : 'pending'}`;
      break;
    }
    case 'subscription.cancelled': {
      await changeTier(orgId, 'free', { provider: 'mercadopago', status: 'cancelled' });
      action = 'tier→free (cancelled)';
      appliedTier = 'free';
      break;
    }
    default:
      return { processed: false, reason: 'unhandled', eventId: rec.id };
  }

  await db.update(billingEvents).set({ processed: true }).where(eq(billingEvents.id, rec.id));
  return { processed: true, eventId: rec.id, tier: appliedTier, action };
}
