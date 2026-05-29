/**
 * Asistente conversacional — POST /api/assistant/chat (no-stream, Hito 1).
 *
 * Flujo:
 *   1. authJwt + tenantContext + quotaCheck('messages') (montados aquí).
 *   2. Resuelve el agente (si agentId pertenece al tenant) y el system prompt:
 *        agente.runtimeConfig.systemPrompt → user_settings.primaryAgentPrompt →
 *        default cálido en español.
 *   3. Selecciona adapter/modelo con AgentRunner.pickAdapter(tier).
 *   4. TokenGuard.redact() sobre el contenido del USUARIO (no sobre el system).
 *   5. adapter.chat(messages) → restore() sobre la respuesta.
 *   6. recordUsage('messages', 1) tras éxito.
 *   7. Responde { reply, agent, model }.
 *
 * TODO-DEUDA(assistant-sse): streaming SSE incremental (token a token). Hito 1
 *  entrega no-stream; el front ya maneja estados listening/thinking/speaking.
 * TODO-DEUDA(assistant-history-persist): persistir el hilo (tabla conversations).
 *  Hoy el historial llega del cliente y no se guarda server-side.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { quotaCheck, recordUsage } from '../middleware/quota.js';
import { agents, userSettings } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pickAdapter } from '../services/ai/agentRunner.js';
import { redact, restore } from '../services/tokenGuard.js';
import { AdapterError, type ChatMessage } from '../services/ai/types.js';

export const assistantRouter = Router();

assistantRouter.use(authJwt, tenantContext);

const DEFAULT_SYSTEM = `Eres el asistente personal de NEXUS. Hablas español neutro (LATAM), con un tono cálido, cercano y directo. Tuteas. Eres conciso: vas al grano sin rodeos ni listas largas, salvo que te las pidan. Si no sabes algo, lo dices con honestidad y pides el detalle que falta. Cuando respondas para ser leído en voz alta, evita formato markdown y usa frases naturales y breves.`;

// Límite defensivo del historial que aceptamos del cliente.
const MAX_HISTORY = 20;

const chatSchema = z.object({
  message: z.string().trim().min(1, 'Escribe un mensaje.').max(8000),
  agentId: z.string().uuid().optional(),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().max(8000),
      })
    )
    .max(MAX_HISTORY)
    .optional(),
});

assistantRouter.post('/chat', quotaCheck('messages'), async (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const tenant = req.tenant!;
  const { message, agentId, history } = parsed.data;

  // 1. Resolver agente (scoped) y system prompt.
  let agentName = 'NEXUS';
  let requestedAdapter: string | undefined;
  let systemPrompt: string | null = null;

  if (agentId) {
    const agent = await tenant.scoped.find(agents, agentId);
    if (agent) {
      agentName = agent.displayName || agent.name;
      requestedAdapter = agent.adapterType;
      const cfg = agent.runtimeConfig as Record<string, unknown> | null;
      if (cfg && typeof cfg.systemPrompt === 'string' && cfg.systemPrompt.trim()) {
        systemPrompt = cfg.systemPrompt.trim();
      }
    }
  }

  if (!systemPrompt) {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, tenant.userId))
      .limit(1);
    if (settings?.primaryAgentPrompt && settings.primaryAgentPrompt.trim()) {
      systemPrompt = settings.primaryAgentPrompt.trim();
    }
  }
  if (!systemPrompt) systemPrompt = DEFAULT_SYSTEM;

  try {
    // 2. Adapter/modelo según tier (downgrade si el agente pide algo no permitido).
    const cliContext = tenant.userPaths
      ? { home: tenant.userPaths.root, workdir: tenant.userPaths.workdir }
      : null;
    const picked = await pickAdapter(tenant.tier, { requestedAdapter, cliContext });

    // 3. Redacción PII del contenido del usuario (system NO se redacta).
    const { redacted, map } = redact(message);

    const messages: ChatMessage[] = [{ role: 'system', content: systemPrompt }];
    if (history) {
      for (const h of history) {
        // Redacta también el historial del usuario; el del asistente ya pasó por restore antes.
        const c = h.role === 'user' ? redact(h.content).redacted : h.content;
        messages.push({ role: h.role, content: c });
      }
    }
    messages.push({ role: 'user', content: redacted });

    // 4. Llamada al modelo.
    const result = await picked.adapter.chat(messages, { model: picked.model });

    // 5. Restaurar PII en la respuesta (el modelo pudo repetir placeholders).
    const reply = restore(result.text, map);

    // 6. Registrar uso (1 mensaje) tras éxito.
    await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);

    res.json({
      reply,
      agent: agentName,
      model: picked.model,
      adapter: picked.adapterName,
      downgraded: picked.downgraded,
      usage: result.usage,
    });
  } catch (err) {
    if (err instanceof AdapterError) {
      console.error(`[assistant] adapter=${err.adapter} status=${err.status} ${err.message}`, err.detail ?? '');
      res.status(502).json({ error: 'El asistente no está disponible en este momento.', detail: err.message });
      return;
    }
    console.error('[assistant] error inesperado:', err);
    res.status(500).json({ error: 'Algo no salió bien. Inténtalo en un momento.' });
  }
});
