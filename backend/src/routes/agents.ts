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
import { quotaCheck, recordUsage } from '../middleware/quota.js';
import { runWithRepair, type AgentRunFn } from '../services/ai/autocure.js';
import { isSkillOnDisk } from '../services/skills.js';
import { pickAdapter } from '../services/ai/agentRunner.js';
import { AdapterError } from '../services/ai/types.js';

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
// (Crear un agente no consume cuota de mensajes; el chat sí — ver routes/assistant.ts.)
agentsRouter.post('/', async (req: Request, res: Response) => {
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

// ── Ejecución con autocure ────────────────────────────────────────────────────

const runSchema = z.object({
  prompt: z.string().trim().min(1).max(8000),
  maxAttempts: z.number().int().min(1).max(5).optional(),
});

/**
 * Construye el runFn de PRODUCCIÓN para un agente.
 *
 * REAL: el "gate" de skills — antes de invocar al modelo, comprueba que las
 * skills requeridas por el agente (runtimeConfig.requiredSkills) estén EN DISCO.
 * Si falta una, devuelve un fallo con el patrón que el autocure clasifica como
 * 'skill_missing' → el loop la instala y reintenta. Cuando todas están, invoca
 * al adapter real (OpenCode) con el prompt.
 *
 * SIMULADO/DEUDA: el ClaudeCliAdapter ejecutando tools/MCP de verdad. Hoy el
 * "trabajo" del agente es la respuesta del modelo; el gate de skills es lo que
 * hace el autocure observable y real en producción.
 */
function buildRunFn(opts: {
  tier: string;
  requestedAdapter?: string;
  requiredSkills: string[];
  systemPrompt: string;
}): AgentRunFn {
  return async ({ userId, prompt }) => {
    // 1. Gate de skills requeridas (real, contra el filesystem del env).
    for (const skillKey of opts.requiredSkills) {
      const present = await isSkillOnDisk(userId, skillKey);
      if (!present) {
        return {
          ok: false,
          output: `skill "${skillKey}" required: el agente la necesita y no está instalada.`,
          exitCode: 1,
        };
      }
    }

    // 2. Todas las skills presentes → invoca al modelo (best-effort).
    try {
      const picked = await pickAdapter(opts.tier, { requestedAdapter: opts.requestedAdapter });
      const result = await picked.adapter.chat(
        [
          { role: 'system', content: opts.systemPrompt },
          { role: 'user', content: prompt },
        ],
        { model: picked.model }
      );
      return { ok: true, output: result.text, exitCode: 0 };
    } catch (err) {
      const msg = err instanceof AdapterError ? err.message : (err as Error).message;
      return { ok: false, output: `run failed: ${msg}`, exitCode: 1 };
    }
  };
}

// POST /api/agents/:id/run — ejecuta el agente con el bucle autocurativo.
// Consume cuota de mensajes (1) tras un run exitoso.
agentsRouter.post('/:id/run', quotaCheck('messages'), async (req: Request, res: Response) => {
  const parsed = runSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const tenant = req.tenant!;
  const agent = await tenant.scoped.find(agents, paramId(req));
  if (!agent) return notFound(res);

  const cfg = (agent.runtimeConfig as Record<string, unknown>) ?? {};
  const requiredSkills = Array.isArray(cfg.requiredSkills)
    ? (cfg.requiredSkills as unknown[]).filter((s): s is string => typeof s === 'string')
    : [];
  const systemPrompt =
    typeof cfg.systemPrompt === 'string' && cfg.systemPrompt.trim()
      ? cfg.systemPrompt.trim()
      : `Eres ${agent.displayName}, un agente de NEXUS. Responde en español, conciso y al grano.`;

  const runFn = buildRunFn({
    tier: tenant.tier,
    requestedAdapter: agent.adapterType,
    requiredSkills,
    systemPrompt,
  });

  try {
    const result = await runWithRepair(tenant.userId, agent.id, parsed.data.prompt, {
      runFn,
      maxAttempts: parsed.data.maxAttempts,
      tier: tenant.tier,
      orgId: tenant.orgId,
      agentName: agent.displayName || agent.name,
    });

    if (result.ok) {
      await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);
    }

    // Siempre 200: un autocure que pide acción del usuario o abre issue no es
    // un error HTTP — es una respuesta conversacional con su repairLog.
    res.json({
      ok: result.ok,
      result: result.result,
      message: result.message,
      attempts: result.attempts,
      repairLog: result.repairLog,
      ...(result.issue ? { issue: result.issue } : {}),
    });
  } catch (err) {
    console.error('[agents] run error:', err);
    res.status(500).json({ error: 'No se pudo ejecutar el agente.' });
  }
});
