/**
 * Rutas de Proyectos + Tareas (issues), montadas en /api/projects.
 *
 * Regla de producto (Jerson): en V2 toda tarea pertenece OBLIGATORIAMENTE a un
 * proyecto (no hay issues "libres" como en V1). Por eso las tareas viven
 * anidadas bajo /api/projects/:id/issues.
 *
 * Todo el acceso pasa por req.tenant.scoped (aislamiento por usuario): un id
 * ajeno → 404 (no 403), para no revelar recursos de otros tenants.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { projects, issues } from '../db/schema.js';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

export const projectsRouter = Router();
projectsRouter.use(authJwt, tenantContext);

function paramId(req: Request, key = 'id'): string {
  const v = req.params[key];
  return Array.isArray(v) ? (v[0] ?? '') : (v ?? '');
}
function notFound(res: Response, what = 'Proyecto'): void {
  res.status(404).json({ error: `${what} no encontrado.` });
}

const projectCreate = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullable().optional(),
  status: z.string().trim().max(40).optional(),
  leadAgentId: z.string().uuid().nullable().optional(),
  targetDate: z.string().datetime().nullable().optional(),
  color: z.string().trim().max(20).nullable().optional(),
});
const projectPatch = projectCreate.partial();

const issueCreate = z.object({
  title: z.string().trim().min(1).max(300),
  status: z.enum(['open', 'in_progress', 'done', 'canceled']).optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  assigneeAgentId: z.string().uuid().nullable().optional(),
});
const issuePatch = issueCreate.partial();

/** Normaliza targetDate (string ISO | null) → Date | null para Drizzle. */
function dateOrNull(v: string | null | undefined): Date | null | undefined {
  if (v === undefined) return undefined;
  return v ? new Date(v) : null;
}

// ── Proyectos ──────────────────────────────────────────────────────────────

// GET /api/projects — lista con conteo de tareas (total y completadas).
projectsRouter.get('/', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const [rows, allIssues] = await Promise.all([
    tenant.scoped.list(projects),
    tenant.scoped.list(issues),
  ]);
  const counts = new Map<string, { total: number; done: number }>();
  for (const i of allIssues) {
    if (!i.projectId) continue;
    const c = counts.get(i.projectId) ?? { total: 0, done: 0 };
    c.total++;
    if (i.status === 'done') c.done++;
    counts.set(i.projectId, c);
  }
  res.json({
    projects: rows.map((p) => ({
      ...p,
      issueCount: counts.get(p.id)?.total ?? 0,
      doneCount: counts.get(p.id)?.done ?? 0,
    })),
  });
});

// POST /api/projects
projectsRouter.post('/', async (req: Request, res: Response) => {
  const parsed = projectCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const tenant = req.tenant!;
  const d = parsed.data;
  const row = await tenant.scoped.insert(projects, {
    userId: tenant.userId,
    orgId: tenant.orgId,
    name: d.name,
    description: d.description ?? null,
    status: d.status ?? 'active',
    leadAgentId: d.leadAgentId ?? null,
    targetDate: dateOrNull(d.targetDate) ?? null,
    color: d.color ?? null,
  });
  res.status(201).json({ project: row });
});

// GET /api/projects/:id — proyecto + sus tareas.
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const project = await tenant.scoped.find(projects, paramId(req));
  if (!project) return notFound(res);
  const list = await tenant.scoped.list(issues, { extraWhere: eq(issues.projectId, project.id) });
  res.json({ project, issues: list });
});

// PATCH /api/projects/:id
projectsRouter.patch('/:id', async (req: Request, res: Response) => {
  const parsed = projectPatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const patch: Record<string, unknown> = { ...parsed.data };
  if ('targetDate' in patch) patch.targetDate = dateOrNull(parsed.data.targetDate);
  const updated = await req.tenant!.scoped.update(projects, paramId(req), patch);
  if (!updated) return notFound(res);
  res.json({ project: updated });
});

// DELETE /api/projects/:id (borra el proyecto; las tareas quedan con project_id NULL por FK).
projectsRouter.delete('/:id', async (req: Request, res: Response) => {
  const ok = await req.tenant!.scoped.remove(projects, paramId(req));
  if (!ok) return notFound(res);
  res.json({ ok: true });
});

// ── Tareas (issues) anidadas en el proyecto ─────────────────────────────────

// POST /api/projects/:id/issues — crea una tarea con identificador autogenerado.
projectsRouter.post('/:id/issues', async (req: Request, res: Response) => {
  const tenant = req.tenant!;
  const project = await tenant.scoped.find(projects, paramId(req));
  if (!project) return notFound(res);
  const parsed = issueCreate.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const existing = await tenant.scoped.list(issues, { extraWhere: eq(issues.projectId, project.id) });
  const prefix = (project.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()) || 'TASK';
  const identifier = `${prefix}-${existing.length + 1}`;
  const d = parsed.data;
  const row = await tenant.scoped.insert(issues, {
    userId: tenant.userId,
    orgId: tenant.orgId,
    projectId: project.id,
    identifier,
    title: d.title,
    status: d.status ?? 'open',
    priority: d.priority ?? 'medium',
    assigneeAgentId: d.assigneeAgentId ?? null,
  });
  res.status(201).json({ issue: row });
});

// PATCH /api/projects/:id/issues/:issueId
projectsRouter.patch('/:id/issues/:issueId', async (req: Request, res: Response) => {
  const parsed = issuePatch.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const updated = await req.tenant!.scoped.update(issues, paramId(req, 'issueId'), parsed.data);
  if (!updated) return notFound(res, 'Tarea');
  res.json({ issue: updated });
});

// DELETE /api/projects/:id/issues/:issueId
projectsRouter.delete('/:id/issues/:issueId', async (req: Request, res: Response) => {
  const ok = await req.tenant!.scoped.remove(issues, paramId(req, 'issueId'));
  if (!ok) return notFound(res, 'Tarea');
  res.json({ ok: true });
});
