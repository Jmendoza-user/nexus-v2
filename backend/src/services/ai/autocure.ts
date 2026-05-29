/**
 * AUTOCURE — bucle autocurativo de agentes (diferenciador del PRD).
 *
 * runWithRepair(userId, agentId, prompt, opts):
 *   1. Ejecuta el agente (runFn) → produce un AgentRunOutcome.
 *   2. Si falló, CLASIFICA el error (classifyError) por patrones en el texto.
 *   3. Llama a un "Reparador" (IA, OpencodeAdapter) que diagnostica y propone
 *      UNA acción JSON: install_skill | request_connection | ask_user.
 *      (Si la IA no está disponible, hay un fallback heurístico determinista
 *       para que el LOOP sea robusto y testeable sin red.)
 *   4. Si la acción es ejecutable sin usuario (install_skill del catálogo) la
 *      ejecuta y REINTENTA el run.
 *   5. Cada intento → fila en agent_repair_attempts.
 *   6. Agotados los intentos → outcome 'gave_up' + abre un issue automático.
 *
 * REAL vs SIMULADO (ver tests/autocure.spec.ts):
 *  - REAL: el LOOP detección→diagnóstico→acción→reintento→log, la
 *    reinstalación de skills (filesystem + DB), la apertura del issue, la
 *    clasificación de errores, el fallback heurístico del reparador.
 *  - SIMULADO en test: la función `runFn` del agente (en producción será el
 *    ClaudeCliAdapter ejecutando tools/MCP — deuda de runtime). El reparador IA
 *    usa OpencodeAdapter real si hay red; si no, cae al heurístico.
 */
import { randomUUID } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { agentRepairAttempts, issues, agents, projects } from '../../db/schema.js';
import { installSkill, listCatalog } from '../skills.js';
import { OpencodeAdapter } from './opencodeAdapter.js';
import { pickAdapter } from './agentRunner.js';
import { AdapterError } from './types.js';
import { notify } from '../telegramNotifier.js';
import { logUsage } from '../usageLog.js';

// ── Contrato del "run" del agente ────────────────────────────────────────────

export interface AgentRunOutcome {
  ok: boolean;
  /** Salida textual del agente (resultado o mensaje de error). */
  output: string;
  /** Código de salida del proceso (0 = ok). Opcional. */
  exitCode?: number;
}

/**
 * runFn ejecuta UN intento del agente. Recibe el prompt + un hint de "qué se
 * acaba de reparar" (para que un runtime real lo aproveche). En producción
 * será el ClaudeCliAdapter; en tests se inyecta un stub que falla si la skill
 * no está en disco y tiene éxito si está (demostración del loop).
 */
export type AgentRunFn = (ctx: {
  userId: string;
  agentId: string;
  prompt: string;
  attempt: number;
}) => Promise<AgentRunOutcome>;

// ── Clasificación de errores ─────────────────────────────────────────────────

export type ErrorClass =
  | 'skill_missing'
  | 'tool_not_found'
  | 'mcp_unavailable'
  | 'permission_denied'
  | 'nonzero_exit'
  | 'unknown';

interface ClassifiedError {
  errorClass: ErrorClass;
  /** skillKey extraída del mensaje, si aplica. */
  skillKey?: string;
  /** provider extraído, si aplica. */
  provider?: string;
}

const SKILL_REQUIRED_RE =
  /(?:skill|habilidad)\s+["'`]?([a-z0-9][a-z0-9-]{0,63})["'`]?\s+(?:required|requerida|no instalada|missing|faltante)/i;
const SKILL_REQUIRED_RE2 =
  /(?:required|requerida|falta(?:nte)?|missing)\s+skill\s*[:=]?\s*["'`]?([a-z0-9][a-z0-9-]{0,63})/i;

/** Clasifica un fallo a partir de la salida/exit del run. */
export function classifyError(outcome: AgentRunOutcome): ClassifiedError {
  const text = outcome.output ?? '';
  let m = text.match(SKILL_REQUIRED_RE) ?? text.match(SKILL_REQUIRED_RE2);
  if (m) return { errorClass: 'skill_missing', skillKey: m[1] };

  if (/tool\s+not\s+found|herramienta\s+no\s+(?:encontrada|disponible)/i.test(text)) {
    return { errorClass: 'tool_not_found' };
  }
  if (/mcp\s+(?:no\s+disponible|unavailable|not\s+available)/i.test(text)) {
    const pm = text.match(/conexi[oó]n\s+([a-z]+)|provider\s*[:=]?\s*([a-z]+)/i);
    return { errorClass: 'mcp_unavailable', provider: pm?.[1] ?? pm?.[2] };
  }
  if (/permiso\s+denegado|permission\s+denied|unauthorized|401|403/i.test(text)) {
    const pm = text.match(/conexi[oó]n\s+([a-z]+)|provider\s*[:=]?\s*([a-z]+)/i);
    return { errorClass: 'permission_denied', provider: pm?.[1] ?? pm?.[2] };
  }
  if (typeof outcome.exitCode === 'number' && outcome.exitCode !== 0) {
    return { errorClass: 'nonzero_exit' };
  }
  return { errorClass: 'unknown' };
}

// ── Acción del reparador ─────────────────────────────────────────────────────

export type RepairAction =
  | { action: 'install_skill'; skillKey: string }
  | { action: 'request_connection'; provider: string }
  | { action: 'ask_user'; question: string };

const REPAIRER_SYSTEM = `Eres un reparador automático de agentes. Recibes el error de un run fallido y el catálogo de skills disponibles. Diagnostica la causa en una frase y propón EXACTAMENTE UNA acción en JSON, sin texto extra, con una de estas formas:
{"action":"install_skill","skillKey":"<key del catálogo>"}
{"action":"request_connection","provider":"<gmail|gcal|meta|telegram|mercadopago>"}
{"action":"ask_user","question":"<pregunta corta al usuario>"}
Si el error indica que falta una skill y existe en el catálogo, elige install_skill. Responde SOLO el JSON.`;

/** Extrae el primer objeto JSON del texto del reparador. */
function parseAction(text: string): RepairAction | null {
  const m = text.match(/\{[\s\S]*?\}/);
  if (!m) return null;
  try {
    const obj = JSON.parse(m[0]) as Record<string, unknown>;
    if (obj.action === 'install_skill' && typeof obj.skillKey === 'string') {
      return { action: 'install_skill', skillKey: obj.skillKey };
    }
    if (obj.action === 'request_connection' && typeof obj.provider === 'string') {
      return { action: 'request_connection', provider: obj.provider };
    }
    if (obj.action === 'ask_user' && typeof obj.question === 'string') {
      return { action: 'ask_user', question: obj.question };
    }
  } catch {
    /* json inválido → null */
  }
  return null;
}

/** Diagnóstico heurístico determinista (fallback sin red, y red de seguridad). */
function heuristicAction(cls: ClassifiedError, catalogKeys: Set<string>): RepairAction {
  if (cls.errorClass === 'skill_missing' && cls.skillKey && catalogKeys.has(cls.skillKey)) {
    return { action: 'install_skill', skillKey: cls.skillKey };
  }
  if (cls.errorClass === 'mcp_unavailable' && cls.provider) {
    return { action: 'request_connection', provider: cls.provider };
  }
  if (cls.errorClass === 'permission_denied' && cls.provider) {
    return { action: 'request_connection', provider: cls.provider };
  }
  return {
    action: 'ask_user',
    question: 'No pude reparar esto automáticamente. ¿Me das más detalle de lo que necesitas?',
  };
}

/**
 * Pide al reparador IA una acción. Si la IA falla o devuelve algo no parseable,
 * cae al heurístico determinista. Devuelve {action, diagnosis}.
 */
async function diagnose(
  tier: string,
  cls: ClassifiedError,
  errorText: string,
  catalog: { key: string; name: string; description: string }[],
  telemetry?: { userId: string; orgId?: string | null }
): Promise<{ action: RepairAction; diagnosis: string }> {
  const catalogKeys = new Set(catalog.map((c) => c.key));
  const fallback = heuristicAction(cls, catalogKeys);

  // Intento IA real (best-effort). Si no hay red/clave, usa el heurístico.
  try {
    const picked = await pickAdapter(tier, { requestedAdapter: 'opencode' });
    const adapter = picked.adapter instanceof OpencodeAdapter ? picked.adapter : new OpencodeAdapter();
    const catalogList = catalog.map((c) => `- ${c.key}: ${c.name} — ${c.description}`).join('\n');
    const res = await adapter.chat(
      [
        { role: 'system', content: REPAIRER_SYSTEM },
        {
          role: 'user',
          content: `ERROR DEL RUN:\n${errorText}\n\nCLASE DETECTADA: ${cls.errorClass}${cls.skillKey ? ` (skill=${cls.skillKey})` : ''}\n\nCATÁLOGO DE SKILLS:\n${catalogList}`,
        },
      ],
      { model: picked.model, temperature: 0, maxTokens: 200 }
    );
    if (telemetry) {
      void logUsage({
        userId: telemetry.userId,
        orgId: telemetry.orgId ?? null,
        kind: 'repair',
        model: res.model,
        tokensPrompt: res.usage.promptTokens,
        tokensCompletion: res.usage.completionTokens,
      });
    }
    const parsed = parseAction(res.text);
    if (parsed) {
      // Si la IA propone instalar una skill que NO existe en el catálogo, no la
      // dejamos pasar: degradamos al heurístico (evita acciones imposibles).
      if (parsed.action === 'install_skill' && !catalogKeys.has(parsed.skillKey)) {
        return { action: fallback, diagnosis: `IA propuso skill fuera de catálogo (${parsed.skillKey}); uso heurístico.` };
      }
      return { action: parsed, diagnosis: res.text.trim().slice(0, 500) };
    }
    return { action: fallback, diagnosis: `IA no devolvió JSON parseable; uso heurístico. (${res.text.slice(0, 120)})` };
  } catch (err) {
    const why = err instanceof AdapterError ? err.message : (err as Error).message;
    return { action: fallback, diagnosis: `Reparador IA no disponible (${why}); diagnóstico heurístico.` };
  }
}

// ── Registro de intentos ─────────────────────────────────────────────────────

async function logAttempt(opts: {
  runId: string;
  userId: string;
  agentId: string;
  attemptNum: number;
  errorClass: ErrorClass;
  diagnosis: string;
  action: RepairAction | null;
  outcome: 'success' | 'failed' | 'gave_up';
}): Promise<void> {
  await db.insert(agentRepairAttempts).values({
    runId: opts.runId,
    userId: opts.userId,
    agentId: opts.agentId,
    attemptNum: opts.attemptNum,
    errorClass: opts.errorClass,
    diagnosis: opts.diagnosis,
    action: (opts.action ?? {}) as Record<string, unknown>,
    outcome: opts.outcome,
  });
}

/** Abre un issue automático cuando el autocure se agota (scoped por usuario). */
async function openAutocureIssue(opts: {
  userId: string;
  orgId: string;
  agentId: string;
  agentName: string;
  runId: string;
  lastDiagnosis: string;
}): Promise<{ id: string; identifier: string }> {
  // Liga el issue a un proyecto del usuario si existe alguno; si no, sin proyecto.
  const [proj] = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.userId, opts.userId))
    .limit(1);

  const identifier = `AUTO-${opts.runId.slice(0, 6).toUpperCase()}`;
  const [row] = await db
    .insert(issues)
    .values({
      userId: opts.userId,
      orgId: opts.orgId,
      projectId: proj?.id ?? null,
      identifier,
      title: `Autocure agotado: ${opts.agentName}`,
      status: 'open',
      priority: 'high',
      assigneeAgentId: opts.agentId,
    })
    .returning({ id: issues.id, identifier: issues.identifier });
  void opts.lastDiagnosis; // el detalle vive en agent_repair_attempts (mismo run_id)
  return row!;
}

// ── Resultado del loop ───────────────────────────────────────────────────────

export interface RepairLogEntry {
  attempt: number;
  errorClass: ErrorClass;
  diagnosis: string;
  action: RepairAction | null;
  outcome: 'success' | 'failed' | 'gave_up';
}

export interface RunWithRepairResult {
  ok: boolean;
  runId: string;
  /** Salida final del agente (último intento). */
  result: string;
  attempts: number;
  repairLog: RepairLogEntry[];
  /** Mensaje conversacional para el usuario (siempre presente). */
  message: string;
  /** Issue abierto si se agotó el autocure. */
  issue?: { id: string; identifier: string };
}

export interface RunWithRepairOpts {
  runFn: AgentRunFn;
  maxAttempts?: number;
  /** tier del usuario (para el reparador IA). Default 'free'. */
  tier?: string;
  orgId: string;
  /** Permite inyectar el catálogo en tests; por defecto lee de DB. */
  agentName?: string;
}

/**
 * Núcleo autocurativo. REAL: detección, diagnóstico, acción, reintento, log,
 * issue. La ejecución del agente (runFn) la provee el caller.
 */
export async function runWithRepair(
  userId: string,
  agentId: string,
  prompt: string,
  opts: RunWithRepairOpts
): Promise<RunWithRepairResult> {
  const runId = randomUUID();
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const tier = opts.tier ?? 'free';
  const repairLog: RepairLogEntry[] = [];

  // Nombre del agente (para issue + mensaje), scoped.
  let agentName = opts.agentName;
  if (!agentName) {
    const [a] = await db
      .select({ name: agents.displayName })
      .from(agents)
      .where(and(eq(agents.id, agentId), eq(agents.userId, userId)))
      .limit(1);
    agentName = a?.name ?? 'tu agente';
  }

  const catalogRows = await listCatalog();
  const catalog = catalogRows.map((c) => ({ key: c.key, name: c.name, description: c.description }));

  let lastOutput = '';
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outcome = await opts.runFn({ userId, agentId, prompt, attempt });
    lastOutput = outcome.output;

    if (outcome.ok && (outcome.exitCode ?? 0) === 0) {
      // Éxito. Si veníamos de reparar, registra el desenlace exitoso.
      if (attempt > 1) {
        repairLog.push({
          attempt,
          errorClass: 'unknown',
          diagnosis: 'El run tuvo éxito tras la reparación.',
          action: null,
          outcome: 'success',
        });
        await logAttempt({
          runId,
          userId,
          agentId,
          attemptNum: attempt,
          errorClass: 'unknown',
          diagnosis: 'El run tuvo éxito tras la reparación.',
          action: null,
          outcome: 'success',
        });
      }
      return {
        ok: true,
        runId,
        result: outcome.output,
        attempts: attempt,
        repairLog,
        message:
          attempt > 1
            ? `Listo. Tuve que ajustar algo por dentro (intento ${attempt}) y ya quedó funcionando.`
            : 'Listo.',
      };
    }

    // Falló: clasifica + diagnostica + decide acción.
    const cls = classifyError(outcome);
    const { action, diagnosis } = await diagnose(tier, cls, outcome.output, catalog, {
      userId,
      orgId: opts.orgId,
    });

    const isLast = attempt >= maxAttempts;
    let executed = false;

    // Acciones ejecutables SIN usuario.
    if (!isLast && action.action === 'install_skill') {
      try {
        await installSkill(userId, action.skillKey, 'autocure');
        executed = true;
      } catch (err) {
        // No se pudo instalar (p.ej. fuera de catálogo): se registra y se
        // dejará que el loop se agote o pida al usuario.
        repairLog.push({
          attempt,
          errorClass: cls.errorClass,
          diagnosis: `${diagnosis} | instalación falló: ${(err as Error).message}`,
          action,
          outcome: 'failed',
        });
        await logAttempt({
          runId,
          userId,
          agentId,
          attemptNum: attempt,
          errorClass: cls.errorClass,
          diagnosis: `${diagnosis} | instalación falló: ${(err as Error).message}`,
          action,
          outcome: 'failed',
        });
        continue;
      }
    }

    const entryOutcome: RepairLogEntry['outcome'] = executed ? 'failed' : isLast ? 'gave_up' : 'failed';
    // 'failed' = intento de reparación aplicado, se reintentará.
    // 'gave_up' = último intento sin reparación posible.

    repairLog.push({ attempt, errorClass: cls.errorClass, diagnosis, action, outcome: entryOutcome });
    await logAttempt({
      runId,
      userId,
      agentId,
      attemptNum: attempt,
      errorClass: cls.errorClass,
      diagnosis,
      action,
      outcome: entryOutcome,
    });

    if (executed) continue; // reintenta el run con la skill ya instalada.

    // No ejecutable automáticamente (request_connection / ask_user) o último intento.
    if (action.action === 'request_connection' || action.action === 'ask_user') {
      // No agotamos intentos en seco: si no es ejecutable, devolvemos pidiendo al usuario.
      const message =
        action.action === 'request_connection'
          ? `Para completar esto necesito que conectes ${action.provider}. Entra a Conexiones y autorízalo, y lo retomo.`
          : action.question;
      return {
        ok: false,
        runId,
        result: lastOutput,
        attempts: attempt,
        repairLog,
        message,
      };
    }

    if (isLast) break;
  }

  // Agotados los intentos sin éxito → issue automático + mensaje.
  const issue = await openAutocureIssue({
    userId,
    orgId: opts.orgId,
    agentId,
    agentName,
    runId,
    lastDiagnosis: repairLog.at(-1)?.diagnosis ?? '',
  });

  const message = `No logré resolverlo automáticamente tras ${maxAttempts} intentos. Abrí el caso ${issue.identifier} para darle seguimiento y te aviso cuando avance.`;
  // Aviso conversacional por Telegram si el usuario lo tiene vinculado (no-op si no).
  void notify(userId, `NEXUS: ${message}`).catch(() => {});

  return {
    ok: false,
    runId,
    result: lastOutput,
    attempts: maxAttempts,
    repairLog,
    message,
    issue,
  };
}
