/**
 * usage.ts — observabilidad de consumo del tenant (Hito 4).
 *
 * GET /api/usage (authed): consumo del periodo actual:
 *   - quotas: messages / voice_seconds / vault_bytes (usado vs límite del tier).
 *   - ai: invocaciones IA del periodo desde ai_usage_log (por kind), tokens
 *     prompt/completion estimados, y AHORRO por caché semántico (cache hits *
 *     coste evitado estimado).
 *
 * El "ahorro" es una ESTIMACIÓN: cada cache hit evitó una llamada al modelo. Sin
 * tokens reales del hit (no se llamó al modelo), usamos el promedio de tokens de
 * las llamadas NO-cacheadas del periodo como proxy del coste evitado.
 */
import { Router, type Request, type Response } from 'express';
import { and, eq, gte, sql } from 'drizzle-orm';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { ensureQuotaRow, currentPeriod, type QuotaMetric } from '../middleware/quota.js';
import { db } from '../db/index.js';
import { aiUsageLog } from '../db/schema.js';

export const usageRouter = Router();
usageRouter.use(authJwt, tenantContext);

const METRICS: QuotaMetric[] = ['messages', 'voice_seconds', 'vault_bytes'];

/**
 * Coste estimado por 1k tokens (USD), proxy para el ahorro mostrado al usuario.
 * No es facturación real (J4 cubre el coste IA); es una métrica de "valor" del
 * caché. Configurable a futuro vía env si se quiere afinar.
 */
const USD_PER_1K_TOKENS = 0.002;

/** Primer instante (UTC) del periodo 'YYYY-MM' actual. */
function periodStart(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0));
}

usageRouter.get('/', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  try {
    // 1. Cuotas del periodo (usado vs límite) — reusa el modelo de quota.ts.
    const quotas = await Promise.all(
      METRICS.map(async (metric) => {
        const { limit, used } = await ensureQuotaRow(tenant.orgId, tenant.tier, metric);
        return { metric, limit, used, period: currentPeriod() };
      })
    );

    // 2. Telemetría IA del periodo (scoped por user_id).
    const start = periodStart();
    const rows = await db
      .select({
        kind: aiUsageLog.kind,
        calls: sql<number>`count(*)::int`,
        cacheHits: sql<number>`sum(case when ${aiUsageLog.cacheHit} then 1 else 0 end)::int`,
        tokensPrompt: sql<number>`coalesce(sum(${aiUsageLog.tokensPrompt}),0)::int`,
        tokensCompletion: sql<number>`coalesce(sum(${aiUsageLog.tokensCompletion}),0)::int`,
      })
      .from(aiUsageLog)
      .where(and(eq(aiUsageLog.userId, tenant.userId), gte(aiUsageLog.createdAt, start)))
      .groupBy(aiUsageLog.kind);

    let totalCalls = 0;
    let cacheHits = 0;
    let tokensPrompt = 0;
    let tokensCompletion = 0;
    const byKind: Record<string, { calls: number; cacheHits: number; tokens: number }> = {};
    for (const r of rows) {
      totalCalls += r.calls;
      cacheHits += r.cacheHits;
      tokensPrompt += r.tokensPrompt;
      tokensCompletion += r.tokensCompletion;
      byKind[r.kind] = {
        calls: r.calls,
        cacheHits: r.cacheHits,
        tokens: r.tokensPrompt + r.tokensCompletion,
      };
    }

    const totalTokens = tokensPrompt + tokensCompletion;
    // Tokens promedio por llamada NO-cacheada (proxy del coste de un hit).
    const billedCalls = totalCalls - cacheHits;
    const avgTokensPerCall = billedCalls > 0 ? totalTokens / billedCalls : 0;
    const tokensSaved = Math.round(avgTokensPerCall * cacheHits);
    const usdSaved = Number(((tokensSaved / 1000) * USD_PER_1K_TOKENS).toFixed(4));

    res.json({
      period: currentPeriod(),
      tier: tenant.tier,
      quotas,
      ai: {
        totalCalls,
        cacheHits,
        tokensPrompt,
        tokensCompletion,
        totalTokens,
        byKind,
        savings: {
          cacheHits,
          tokensSaved,
          usdSaved,
        },
      },
    });
  } catch (err) {
    console.error('[usage] error:', err);
    res.status(500).json({ error: 'No se pudo cargar tu uso.' });
  }
});
