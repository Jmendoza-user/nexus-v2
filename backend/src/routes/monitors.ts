/**
 * monitors.ts — CRUD de monitores proactivos (Hito 4), scoped por tenant.
 *
 *   GET    /api/monitors            → lista del tenant.
 *   POST   /api/monitors            → crea (valida URL anti-SSRF antes de guardar).
 *   PATCH  /api/monitors/:id        → edita (enabled, criteria, selector, title).
 *   DELETE /api/monitors/:id        → borra.
 *   POST   /api/monitors/:id/run    → ejecuta ahora (manual; útil para probar).
 *
 * Crear/editar son capacidad Pro/Team (el scraping subyacente lo es). free → 402.
 * Todo el acceso pasa por tenant.scoped (aislamiento estricto).
 */
import { Router, type Request, type Response, type NextFunction } from 'express';
import { z } from 'zod';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { monitors, type Monitor } from '../db/schema.js';
import { assertSafeUrl, ScrapeError } from '../services/scrape/scraper.js';
import { runMonitor } from '../services/scrape/monitor.js';

export const monitorsRouter = Router();
monitorsRouter.use(authJwt, tenantContext);

const UPGRADE_URL = '/m/upgrade';

function requirePaidTier(req: Request, res: Response, next: NextFunction): void {
  const tier = req.tenant?.tier;
  if (tier !== 'pro' && tier !== 'team') {
    res.status(402).json({
      error: 'feature_locked',
      feature: 'monitors',
      message: 'Los monitores proactivos están disponibles en los planes Pro y Team.',
      upgradeUrl: UPGRADE_URL,
    });
    return;
  }
  next();
}

const criteriaSchema = z.object({
  op: z.enum(['changed', 'lt', 'lte', 'gt', 'gte', 'eq', 'neq']),
  value: z.number().optional(),
});

const createSchema = z.object({
  title: z.string().trim().min(1).max(120),
  kind: z.enum(['price', 'availability', 'generic']).optional(),
  targetUrl: z.string().trim().min(1).max(2048),
  selector: z.string().trim().max(512).optional(),
  criteria: criteriaSchema.optional(),
});

const patchSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  selector: z.string().trim().max(512).nullable().optional(),
  criteria: criteriaSchema.optional(),
  enabled: z.boolean().optional(),
});

function view(m: Monitor) {
  return {
    id: m.id,
    title: m.title,
    kind: m.kind,
    targetUrl: m.targetUrl,
    selector: m.selector,
    criteria: m.criteria,
    lastValue: m.lastValue,
    lastCheckedAt: m.lastCheckedAt,
    enabled: m.enabled,
    createdAt: m.createdAt,
  };
}

monitorsRouter.get('/', async (req: Request, res: Response) => {
  const list = await req.tenant!.scoped.list(monitors);
  res.json({ monitors: list.map(view) });
});

monitorsRouter.post('/', requirePaidTier, async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  // Valida la URL anti-SSRF YA en la creación (no esperar al primer run).
  try {
    await assertSafeUrl(parsed.data.targetUrl);
  } catch (err) {
    if (err instanceof ScrapeError) {
      res.status(400).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
  const tenant = req.tenant!;
  const row = await tenant.scoped.insert(monitors, {
    userId: tenant.userId,
    orgId: tenant.orgId,
    title: parsed.data.title,
    kind: parsed.data.kind ?? 'generic',
    targetUrl: parsed.data.targetUrl,
    selector: parsed.data.selector ?? null,
    criteria: (parsed.data.criteria ?? { op: 'changed' }) as Record<string, unknown>,
  } as typeof monitors.$inferInsert);
  res.status(201).json({ monitor: view(row) });
});

monitorsRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const patch: Partial<typeof monitors.$inferInsert> = {};
  if (parsed.data.title !== undefined) patch.title = parsed.data.title;
  if (parsed.data.selector !== undefined) patch.selector = parsed.data.selector;
  if (parsed.data.criteria !== undefined) patch.criteria = parsed.data.criteria as Record<string, unknown>;
  if (parsed.data.enabled !== undefined) patch.enabled = parsed.data.enabled;

  const updated = await req.tenant!.scoped.update(monitors, String(req.params.id), patch);
  if (!updated) {
    res.status(404).json({ error: 'Monitor no encontrado.' });
    return;
  }
  res.json({ monitor: view(updated) });
});

monitorsRouter.delete('/:id', async (req: Request, res: Response) => {
  const ok = await req.tenant!.scoped.remove(monitors, String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Monitor no encontrado.' });
    return;
  }
  res.json({ ok: true });
});

monitorsRouter.post('/:id/run', requirePaidTier, async (req: Request, res: Response) => {
  const monitor = await req.tenant!.scoped.find(monitors, String(req.params.id));
  if (!monitor) {
    res.status(404).json({ error: 'Monitor no encontrado.' });
    return;
  }
  const result = await runMonitor(monitor);
  // Re-lee para devolver el last_value actualizado.
  const fresh = await req.tenant!.scoped.find(monitors, monitor.id);
  res.json({ triggered: result.triggered, error: result.error ?? null, monitor: fresh ? view(fresh) : null });
});
