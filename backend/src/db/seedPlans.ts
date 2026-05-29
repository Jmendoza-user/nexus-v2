/**
 * Seed idempotente de `plans` — catálogo COMERCIAL de planes (Hito 5).
 *
 * Mientras tier_policies es la fuente TÉCNICA (cuotas/modelos/adapters), `plans`
 * es la cara comercial: precios COP/USD (defaults de Jerson), nombre, features
 * narrativas para la pantalla de upgrade y el id de preapproval de MercadoPago
 * (NULL hasta que Jerson cree los planes en MP).
 *
 * Las features se DERIVAN de tier_policies en runtime (mensajes/voz/vault) para
 * no duplicar números: si Jerson sube una cuota en tier_policies, el copy del
 * plan se mantiene coherente al re-sembrar (db:migrate corre esto al final).
 *
 * Precios configurables por env (PRICE_PRO_COP, etc.) sin re-seed manual:
 * un cambio se aplica con upsert.
 */
import { eq } from 'drizzle-orm';
import { db, pool } from './index.js';
import { plans, tierPolicies } from './schema.js';

const MB = 1024 * 1024;
const GB = 1024 * MB;

// Precios default Jerson (28-may-2026). USD ~ referencia informativa.
const PRICE_FREE_COP = Number(process.env.PRICE_FREE_COP ?? 0);
const PRICE_PRO_COP = Number(process.env.PRICE_PRO_COP ?? 45_000);
const PRICE_TEAM_COP = Number(process.env.PRICE_TEAM_COP ?? 120_000);
const PRICE_FREE_USD = process.env.PRICE_FREE_USD ?? '0';
const PRICE_PRO_USD = process.env.PRICE_PRO_USD ?? '12';
const PRICE_TEAM_USD = process.env.PRICE_TEAM_USD ?? '32';

/** Formatea un límite de mensajes/cantidad para copy es-CO. */
function fmtCount(n: number): string {
  return n.toLocaleString('es-CO');
}

/** Formatea bytes a MB/GB legible. */
function fmtBytes(bytes: number): string {
  if (bytes >= GB) return `${Math.round(bytes / GB)} GB`;
  return `${Math.round(bytes / MB)} MB`;
}

/**
 * Deriva las features narrativas de un tier a partir de su tier_policy.
 * Devuelve una lista lista para mostrar en las PlanCards de /m/upgrade.
 */
function deriveFeatures(
  tier: 'free' | 'pro' | 'team',
  policy: { quotaMessages: number; quotaVoiceSeconds: number; quotaVaultBytes: number }
): string[] {
  const msgs = `${fmtCount(policy.quotaMessages)} mensajes IA / mes`;
  const vault = `Vault hasta ${fmtBytes(policy.quotaVaultBytes)}`;
  const voiceMin = Math.round(policy.quotaVoiceSeconds / 60);

  if (tier === 'free') {
    return ['1 agente personal', msgs, vault, 'Telegram', 'OpenCode (modelo base)'];
  }
  if (tier === 'pro') {
    return [
      'Agentes ilimitados',
      msgs,
      `${vault} + RAG`,
      `Voz ElevenLabs (${voiceMin} min / mes)`,
      'Gmail + OCR finanzas',
      'Token Guard PII',
      'Scraping headless',
    ];
  }
  // team
  return [
    'Todo lo de Pro',
    msgs,
    `${vault} + RAG`,
    `Voz ElevenLabs (${voiceMin} min / mes)`,
    'Agentes compartidos del equipo',
    'Claude CLI + OpenCode',
    'Soporte prioritario',
  ];
}

export interface PlanSeed {
  tier: 'free' | 'pro' | 'team';
  name: string;
  priceCop: number;
  priceUsd: string;
  popular: boolean;
  sortOrder: number;
  mpPreapprovalPlanId: string | null;
}

const PLAN_DEFS: PlanSeed[] = [
  { tier: 'free', name: 'Free', priceCop: PRICE_FREE_COP, priceUsd: PRICE_FREE_USD, popular: false, sortOrder: 0, mpPreapprovalPlanId: process.env.MP_PLAN_FREE ?? null },
  { tier: 'pro', name: 'Pro', priceCop: PRICE_PRO_COP, priceUsd: PRICE_PRO_USD, popular: true, sortOrder: 1, mpPreapprovalPlanId: process.env.MP_PLAN_PRO ?? null },
  { tier: 'team', name: 'Team', priceCop: PRICE_TEAM_COP, priceUsd: PRICE_TEAM_USD, popular: false, sortOrder: 2, mpPreapprovalPlanId: process.env.MP_PLAN_TEAM ?? null },
];

export async function seedPlans(): Promise<void> {
  for (const def of PLAN_DEFS) {
    const [policy] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, def.tier)).limit(1);
    const features = policy
      ? deriveFeatures(def.tier, {
          quotaMessages: Number(policy.quotaMessages),
          quotaVoiceSeconds: Number(policy.quotaVoiceSeconds),
          quotaVaultBytes: Number(policy.quotaVaultBytes),
        })
      : [];

    await db
      .insert(plans)
      .values({
        tier: def.tier,
        name: def.name,
        priceCop: def.priceCop,
        priceUsd: def.priceUsd,
        features,
        popular: def.popular,
        sortOrder: def.sortOrder,
        mpPreapprovalPlanId: def.mpPreapprovalPlanId,
      })
      .onConflictDoUpdate({
        target: plans.tier,
        set: {
          name: def.name,
          priceCop: def.priceCop,
          priceUsd: def.priceUsd,
          features,
          popular: def.popular,
          sortOrder: def.sortOrder,
          // mp_preapproval_plan_id NO se pisa si ya existe y el env no lo trae
          // (evita borrar un id seteado a mano). Solo actualiza si viene del env.
          ...(def.mpPreapprovalPlanId ? { mpPreapprovalPlanId: def.mpPreapprovalPlanId } : {}),
        },
      });
  }
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  seedPlans()
    .then(() => {
      console.log('[seed:plans] OK', PLAN_DEFS.map((p) => p.tier).join(', '));
      return pool.end();
    })
    .catch((err) => {
      console.error('[seed:plans] error:', err);
      process.exit(1);
    });
}
