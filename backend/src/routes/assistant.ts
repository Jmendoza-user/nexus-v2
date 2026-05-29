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
import { cacheKey, getCached, setCached } from '../services/promptCache.js';
import { logUsage } from '../services/usageLog.js';
import { isGoogleConnected } from '../services/google/client.js';
import { googleSystemBlock, parseAction } from '../services/google/promptProtocol.js';
import { runGoogleTool, isGoogleTool } from '../services/google/tools.js';
import { isNexusTool, runNexusTool, nexusToolsBlock } from '../services/tools/nexus.js';

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

  // Conciencia de conexión Google (Gmail/Calendar/Drive) + protocolo de tools.
  const googleConnected = await isGoogleConnected(tenant.userId).catch(() => false);
  systemPrompt = `${systemPrompt}\n${googleSystemBlock(googleConnected)}\n${nexusToolsBlock()}`;

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

    // 4. Caché semántico (TokenGuard etapa 2): si el MISMO prompt redactado +
    //    system + modelo ya tiene respuesta cacheada en Redis, la reusamos sin
    //    gastar el modelo. La clave usa texto YA redactado (no se cachea PII).
    //    Sólo cacheamos turnos sin historial (one-shot): con historial la
    //    respuesta depende del contexto y el hit exacto sería poco fiable.
    const cacheable = (!history || history.length === 0) && !googleConnected;
    const ns = `chat|${picked.model}|${systemPrompt.slice(0, 64)}`;
    const key = cacheKey(ns, redacted);

    if (cacheable) {
      const cached = await getCached(key);
      if (cached !== null) {
        const reply = restore(cached, map);
        await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);
        // cache_hit: tokens 0 (no se gastó modelo) → alimenta el ahorro en /usage.
        void logUsage({ userId: tenant.userId, orgId: tenant.orgId, kind: 'chat', model: picked.model, cacheHit: true });
        res.json({
          reply,
          agent: agentName,
          model: picked.model,
          adapter: picked.adapterName,
          downgraded: picked.downgraded,
          cached: true,
        });
        return;
      }
    }

    // 5. Loop acción→observación (protocolo de tools por prompt). Si Google no
    //    está conectado, el modelo no emite acciones → una sola pasada.
    const MAX_STEPS = 5;
    let finalText = '';
    let usedTool = false;
    let promptTokens = 0;
    let completionTokens = 0;

    for (let i = 0; i < MAX_STEPS; i++) {
      const result = await picked.adapter.chat(messages, { model: picked.model });
      promptTokens += result.usage.promptTokens ?? 0;
      completionTokens += result.usage.completionTokens ?? 0;

      const isKnown = (t: string) => (googleConnected && isGoogleTool(t)) || isNexusTool(t);
      const action = parseAction(result.text, isKnown);
      if (!action) {
        finalText = result.text;
        break;
      }
      // El modelo pidió una herramienta (interna de NEXUS o de Google): ejecutar.
      usedTool = true;
      messages.push({ role: 'assistant', content: result.text });
      let obs: string;
      try {
        const tr = isNexusTool(action.tool)
          ? await runNexusTool(
              { userId: tenant.userId, orgId: tenant.orgId, tier: tenant.tier, scoped: tenant.scoped },
              action.tool,
              action.args
            )
          : await runGoogleTool(tenant.userId, action.tool, action.args);
        obs = JSON.stringify(tr);
      } catch (e) {
        obs = JSON.stringify({ ok: false, error: (e as Error).message });
      }
      if (obs.length > 6000) obs = `${obs.slice(0, 6000)}…(truncado)`;
      messages.push({ role: 'user', content: `OBSERVACIÓN (${action.tool}): ${obs}` });
    }
    if (!finalText) {
      finalText = 'No pude completar la acción tras varios pasos. ¿Me lo dices de otra forma?';
    }

    // 6. Restaurar PII en la respuesta (el modelo pudo repetir placeholders).
    const reply = restore(finalText, map);

    // 7. Registrar uso (1 mensaje) + telemetría de tokens agregados del loop.
    await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);
    void logUsage({
      userId: tenant.userId,
      orgId: tenant.orgId,
      kind: 'chat',
      model: picked.model,
      tokensPrompt: promptTokens,
      tokensCompletion: completionTokens,
      cacheHit: false,
    });
    // Cachea sólo el camino simple (sin tools): respuesta con placeholders.
    if (cacheable && !usedTool) void setCached(key, finalText);

    res.json({
      reply,
      agent: agentName,
      model: picked.model,
      adapter: picked.adapterName,
      downgraded: picked.downgraded,
      usage: { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens },
      cached: false,
      usedTool,
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
