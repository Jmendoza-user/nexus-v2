/**
 * scrape.ts — scraping headless bajo demanda (capacidad VPS Pro/Team, Hito 4).
 *
 * POST /api/scrape/run (authed + tier gate pro/team): body { url, selector?,
 * waitFor? }. Lanza chromium, extrae y cierra. free → 402 upgrade.
 *
 * Cuota: cuenta 1 'message' por scrape (es una operación cara) usando el mismo
 * modelo de cuotas; si está agotada → 402.
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { quotaCheck, recordUsage } from '../middleware/quota.js';
import { scrapeUrl, ScrapeError } from '../services/scrape/scraper.js';
import { logUsage } from '../services/usageLog.js';

export const scrapeRouter = Router();
scrapeRouter.use(authJwt, tenantContext);

const UPGRADE_URL = '/m/upgrade';

/** Tier gate: solo pro/team. free → 402 con CTA de upgrade. */
function requirePaidTier(req: Request, res: Response, next: NextFunction): void {
  const tier = req.tenant?.tier;
  if (tier !== 'pro' && tier !== 'team') {
    res.status(402).json({
      error: 'feature_locked',
      feature: 'scraping',
      message: 'El scraping headless está disponible en los planes Pro y Team.',
      upgradeUrl: UPGRADE_URL,
    });
    return;
  }
  next();
}

const runSchema = z.object({
  url: z.string().trim().min(1).max(2048),
  selector: z.string().trim().max(512).optional(),
  waitFor: z.string().trim().max(512).optional(),
});

scrapeRouter.post(
  '/run',
  requirePaidTier,
  quotaCheck('messages'),
  async (req: Request, res: Response) => {
    const parsed = runSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
      return;
    }
    const tenant = req.tenant!;
    try {
      const result = await scrapeUrl(parsed.data.url, {
        selector: parsed.data.selector,
        waitFor: parsed.data.waitFor,
      });
      await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);
      void logUsage({ userId: tenant.userId, orgId: tenant.orgId, kind: 'scrape', model: 'playwright' });
      res.json({ title: result.title, text: result.text, extracted: result.extracted, url: result.url });
    } catch (err) {
      if (err instanceof ScrapeError) {
        // SSRF y URL inválida → 400 (entrada del cliente). Fallos de navegación → 502.
        const status = err.code === 'ssrf_blocked' || err.code === 'invalid_url' ? 400 : 502;
        res.status(status).json({ error: err.message, code: err.code });
        return;
      }
      console.error('[scrape] error inesperado:', err);
      res.status(500).json({ error: 'No se pudo completar el scraping.' });
    }
  }
);
