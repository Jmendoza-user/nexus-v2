/**
 * AgentRunner — selección de adapter/modelo según tier y tipo de agente.
 *
 * pickAdapter(tier, agentAdapterType):
 *   1. Lee tier_policies del tier (default_adapter, default_model, allowed_adapters).
 *   2. Si el agente pide un adapter NO permitido por el tier → downgrade al
 *      default del tier y loguea 'tier_downgrade' (observabilidad de límites).
 *   3. Devuelve { adapter, model } listos para usar.
 *
 * El modelo siempre sale de tier_policies.default_model (Hito 1: un modelo por
 * tier; per-agente/override es deuda de hitos siguientes).
 */
import { eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { tierPolicies, type TierPolicy } from '../../db/schema.js';
import { OpencodeAdapter } from './opencodeAdapter.js';
import { ClaudeCliAdapter, type ClaudeCliContext } from './claudeCliAdapter.js';
import { AdapterError, type AIAdapter } from './types.js';

export interface PickAdapterResult {
  adapter: AIAdapter;
  model: string;
  /** Adapter efectivamente usado tras posible downgrade. */
  adapterName: string;
  downgraded: boolean;
}

export interface PickAdapterOpts {
  /** Adapter solicitado por el agente (agents.adapter_type). */
  requestedAdapter?: string;
  /** Contexto necesario si se resuelve a claude_cli (env aislado del usuario). */
  cliContext?: ClaudeCliContext | null;
}

async function loadPolicy(tier: string): Promise<TierPolicy> {
  const [row] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, tier)).limit(1);
  if (row) return row;
  // Fallback defensivo: si el tier no existe en la tabla, cae a 'free'.
  const [free] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, 'free')).limit(1);
  if (!free) throw new AdapterError('agent_runner', null, 'tier_policies sin filas; ejecuta el seed.');
  console.warn(`[agent_runner] tier desconocido '${tier}', usando política free.`);
  return free;
}

function buildAdapter(name: string, cliContext?: ClaudeCliContext | null): AIAdapter {
  switch (name) {
    case 'opencode':
      return new OpencodeAdapter();
    case 'claude_cli':
      if (!cliContext) {
        throw new AdapterError('agent_runner', null, 'claude_cli requiere el env aislado del usuario (cliContext).');
      }
      return new ClaudeCliAdapter(cliContext);
    default:
      throw new AdapterError('agent_runner', null, `Adapter no soportado: ${name}`);
  }
}

export async function pickAdapter(tier: string, opts: PickAdapterOpts = {}): Promise<PickAdapterResult> {
  const policy = await loadPolicy(tier);
  const allowed = Array.isArray(policy.allowedAdapters)
    ? (policy.allowedAdapters as string[])
    : [policy.defaultAdapter];

  const requested = opts.requestedAdapter?.trim() || policy.defaultAdapter;
  let chosen = requested;
  let downgraded = false;

  if (!allowed.includes(requested)) {
    console.warn(
      `[agent_runner] tier_downgrade tier=${tier} requested=${requested} allowed=${JSON.stringify(allowed)} → ${policy.defaultAdapter}`
    );
    chosen = policy.defaultAdapter;
    downgraded = true;
  }

  // claude_cli sin contexto de usuario también degrada a opencode (Hito 1).
  if (chosen === 'claude_cli' && !opts.cliContext) {
    console.warn(`[agent_runner] tier_downgrade tier=${tier} claude_cli sin cliContext → opencode`);
    chosen = 'opencode';
    downgraded = true;
  }

  return {
    adapter: buildAdapter(chosen, opts.cliContext),
    model: policy.defaultModel,
    adapterName: chosen,
    downgraded,
  };
}
