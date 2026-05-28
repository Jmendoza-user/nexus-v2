/**
 * Rutas de dominio mínimas (agents) para validar aislamiento E2E.
 *
 * TODO el acceso a la tabla pasa por req.tenant.scoped (tenantScoped):
 * nunca se hace db.select().from(agents) directo. Esto garantiza que un
 * usuario solo vea/modifique sus propios agentes; un id ajeno → 404 (no 403),
 * para no revelar la existencia de recursos de otros tenants.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { agents } from '../db/schema.js';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { quotaCheck } from '../middleware/tenant.js';

export const agentsRouter = Router();

agentsRouter.use(authJwt, tenantContext);

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  displayName: z.string().trim().min(1).max(120).optional(),
  status: z.enum(['idle', 'running', 'paused', 'error']).optional(),
  adapterType: z.string().trim().max(60).optional(),
  capabilities: z.array(z.string()).optional(),
  runtimeConfig: z.record(z.unknown()).optional(),
});

const patchSchema = createSchema.partial();

function notFound(res: Response): void {
  res.status(404).json({ error: 'Agente no encontrado.' });
}

/** Express 5 tipa params como string | string[]; aquí siempre es string. */
function paramId(req: Request): string {
  const id = req.params.id;
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
}

// GET /api/agents — lista SOLO los del tenant.
agentsRouter.get('/', async (req: Request, res: Response) => {
  const rows = await req.tenant!.scoped.list(agents);
  res.json({ agents: rows });
});

// GET /api/agents/:id — solo si pertenece al tenant.
agentsRouter.get('/:id', async (req: Request, res: Response) => {
  const row = await req.tenant!.scoped.find(agents, paramId(req));
  if (!row) return notFound(res);
  res.json({ agent: row });
});

// POST /api/agents — crea para el user/org actual.
agentsRouter.post('/', quotaCheck('messages'), async (req: Request, res: Response) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const { name, displayName, status, adapterType, capabilities, runtimeConfig } = parsed.data;
  const row = await req.tenant!.scoped.insert(agents, {
    userId: req.tenant!.userId,
    orgId: req.tenant!.orgId,
    name,
    displayName: displayName ?? name,
    status: status ?? 'idle',
    adapterType: adapterType ?? 'opencode',
    capabilities: capabilities ?? [],
    runtimeConfig: runtimeConfig ?? {},
  });
  res.status(201).json({ agent: row });
});

// PATCH /api/agents/:id — solo si pertenece al tenant; si no → 404.
agentsRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const updated = await req.tenant!.scoped.update(agents, paramId(req), parsed.data);
  if (!updated) return notFound(res);
  res.json({ agent: updated });
});

// DELETE /api/agents/:id — solo si pertenece al tenant; si no → 404.
agentsRouter.delete('/:id', async (req: Request, res: Response) => {
  const ok = await req.tenant!.scoped.remove(agents, paramId(req));
  if (!ok) return notFound(res);
  res.json({ ok: true });
});
