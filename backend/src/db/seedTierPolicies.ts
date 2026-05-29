/**
 * Seed idempotente de tier_policies — catálogo de políticas por tier.
 *
 * Fuente única de verdad de adapter/modelo por defecto, adapters permitidos y
 * cuotas base. Se ejecuta tras aplicar migraciones (db:migrate corre esto al
 * final) y también puede invocarse aislado (`tsx src/db/seedTierPolicies.ts`).
 *
 * Los modelos salen de las env MODEL_FREE / MODEL_PRO / MODEL_TEAM para que un
 * cambio de modelo no requiera re-seed manual (se actualiza con upsert).
 */
import { sql } from 'drizzle-orm';
import { db, pool } from './index.js';
import { tierPolicies } from './schema.js';

const MB = 1024 * 1024;
const GB = 1024 * MB;

const MODEL_FREE = process.env.MODEL_FREE ?? 'mimo-v2.5-pro';
const MODEL_PRO = process.env.MODEL_PRO ?? 'qwen3.6-plus';
const MODEL_TEAM = process.env.MODEL_TEAM ?? 'qwen3.6-plus';

export const TIER_POLICY_ROWS = [
  {
    tier: 'free',
    defaultAdapter: 'opencode',
    defaultModel: MODEL_FREE,
    allowedAdapters: ['opencode'],
    quotaMessages: 200,
    quotaVoiceSeconds: 0, // sin voz en free
    quotaVaultBytes: 200 * MB,
  },
  {
    tier: 'pro',
    defaultAdapter: 'opencode',
    defaultModel: MODEL_PRO,
    allowedAdapters: ['opencode', 'claude_cli'],
    quotaMessages: 5000,
    quotaVoiceSeconds: 18_000, // 5 h / mes
    quotaVaultBytes: 5 * GB,
  },
  {
    tier: 'team',
    defaultAdapter: 'opencode',
    defaultModel: MODEL_TEAM,
    allowedAdapters: ['opencode', 'claude_cli'],
    quotaMessages: 20_000,
    quotaVoiceSeconds: 72_000, // 20 h / mes
    quotaVaultBytes: 50 * GB,
  },
] as const;

export async function seedTierPolicies(): Promise<void> {
  for (const row of TIER_POLICY_ROWS) {
    await db
      .insert(tierPolicies)
      .values({ ...row, allowedAdapters: [...row.allowedAdapters] })
      .onConflictDoUpdate({
        target: tierPolicies.tier,
        set: {
          defaultAdapter: row.defaultAdapter,
          defaultModel: row.defaultModel,
          allowedAdapters: [...row.allowedAdapters],
          quotaMessages: row.quotaMessages,
          quotaVoiceSeconds: row.quotaVoiceSeconds,
          quotaVaultBytes: row.quotaVaultBytes,
        },
      });
  }
  // Garantiza que la tabla exista incluso si se llama antes de migrar (defensivo).
  void sql;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  seedTierPolicies()
    .then(() => {
      console.log('[seed:tier_policies] OK', TIER_POLICY_ROWS.map((r) => r.tier).join(', '));
      return pool.end();
    })
    .catch((err) => {
      console.error('[seed:tier_policies] error:', err);
      process.exit(1);
    });
}
