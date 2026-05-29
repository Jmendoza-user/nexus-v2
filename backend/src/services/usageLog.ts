/**
 * usageLog — helper no-invasivo para registrar cada invocación a IA en
 * ai_usage_log. Se llama DESPUÉS de cada llamada al modelo en los flujos
 * (assistant/chat, vault/rag, finance/classify, autocure, scrape).
 *
 * Diseño:
 *  - logUsage() NUNCA lanza: un fallo de telemetría jamás debe romper el flujo
 *    de negocio. Captura y loguea el error y sigue.
 *  - org_id es opcional (autocure sólo conoce userId; se resuelve cuando hay
 *    contexto de tenant).
 *  - cache_hit=true marca que la respuesta salió del caché Redis (no se gastó
 *    modelo): alimenta el cálculo de ahorro en GET /api/usage.
 */
import { db } from '../db/index.js';
import { aiUsageLog } from '../db/schema.js';

export type UsageKind = 'chat' | 'rag' | 'classify' | 'repair' | 'scrape';

export interface LogUsageInput {
  userId: string;
  orgId?: string | null;
  kind: UsageKind;
  model?: string | null;
  tokensPrompt?: number;
  tokensCompletion?: number;
  cacheHit?: boolean;
}

/** Registra una fila en ai_usage_log. Best-effort: nunca lanza. */
export async function logUsage(input: LogUsageInput): Promise<void> {
  try {
    await db.insert(aiUsageLog).values({
      userId: input.userId,
      orgId: input.orgId ?? null,
      kind: input.kind,
      model: input.model ?? null,
      tokensPrompt: Math.max(0, Math.round(input.tokensPrompt ?? 0)),
      tokensCompletion: Math.max(0, Math.round(input.tokensCompletion ?? 0)),
      cacheHit: input.cacheHit ?? false,
    });
  } catch (err) {
    console.error('[usageLog] no se pudo registrar (ignorado):', (err as Error).message);
  }
}
