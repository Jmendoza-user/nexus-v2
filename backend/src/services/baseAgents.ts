/**
 * Roster base de un usuario NUEVO.
 *
 * Al registrarse, cada usuario recibe 3 agentes base en su tenant, con system
 * prompts en español (tono cálido y conciso) y adapter 'opencode'. El primero
 * ("Asistente Personal") queda como primary_agent_id en user_settings.
 *
 * IDEMPOTENCIA / SEGURIDAD: seedBaseAgents() SOLO siembra si el usuario aún no
 * tiene NINGÚN agente. Así nunca se duplica el roster y, crítico, NUNCA se le
 * añaden agentes a Jerson (user_001), que ya migró con sus 9 agentes desde V1.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { agents, userSettings } from '../db/schema.js';

export interface BaseAgentSpec {
  name: string;
  displayName: string;
  systemPrompt: string;
  capabilities: string[];
}

/**
 * Catálogo del roster base. El orden importa: el primero es el primario.
 * Los system prompts son cálidos y concisos, en español neutro (LATAM).
 */
export const BASE_AGENTS: readonly BaseAgentSpec[] = [
  {
    name: 'asistente-personal',
    displayName: 'Asistente Personal',
    systemPrompt:
      'Eres el asistente personal de quien te habla. Tono cálido y cercano, ' +
      'tuteas. Respuestas concisas y claras: una sola recomendación, sin listas ' +
      'largas salvo que las pidan. Ayudas con la agenda, las tareas, recordatorios ' +
      'y coordinas a los demás agentes. Hablas español neutro (LATAM). Sin emojis ' +
      'en respuestas formales. Si no sabes algo, lo dices con naturalidad.',
    capabilities: ['agenda', 'tareas', 'orquestacion'],
  },
  {
    name: 'curador-finanzas',
    displayName: 'Curador de Finanzas',
    systemPrompt:
      'Eres el curador de finanzas personales de quien te habla. Tono cálido, ' +
      'directo y tranquilizador con el dinero. Detectas movimientos, propones ' +
      'borradores de transacciones y resumes gastos e ingresos de forma simple. ' +
      'Nunca apruebas un movimiento por tu cuenta: siempre sugieres y dejas que la ' +
      'persona confirme. Montos en la moneda local. Español neutro (LATAM), conciso.',
    capabilities: ['finanzas', 'borradores', 'resumen'],
  },
  {
    name: 'curador-vault',
    displayName: 'Curador del Vault',
    systemPrompt:
      'Eres el curador del segundo cerebro (vault) de quien te habla. Tono cálido y ' +
      'curioso. Indexas notas, conectas ideas, encuentras relaciones y respondes ' +
      'preguntas citando las notas de origen. Cuando respondas con base en el vault, ' +
      'menciona de qué notas sale la información. Español neutro (LATAM), conciso, ' +
      'sin inventar contenido que no esté en las notas.',
    capabilities: ['rag', 'embeddings', 'backlinks'],
  },
] as const;

/**
 * Siembra el roster base para un usuario NUEVO (sin agentes) y fija el primario.
 * No-op si el usuario ya tiene al menos un agente (no toca a Jerson).
 *
 * @returns ids de los agentes creados (vacío si no se sembró nada).
 */
export async function seedBaseAgents(opts: {
  userId: string;
  orgId: string;
}): Promise<string[]> {
  const { userId, orgId } = opts;

  // Guard: si ya tiene agentes, no sembramos (protege a user_001 y reentradas).
  const existing = await db
    .select({ id: agents.id })
    .from(agents)
    .where(eq(agents.userId, userId))
    .limit(1);
  if (existing.length > 0) return [];

  const created = await db
    .insert(agents)
    .values(
      BASE_AGENTS.map((a) => ({
        userId,
        orgId,
        name: a.name,
        displayName: a.displayName,
        status: 'idle',
        adapterType: 'opencode',
        capabilities: a.capabilities,
        runtimeConfig: { systemPrompt: a.systemPrompt },
      }))
    )
    .returning();

  // El primer agente del catálogo (Asistente Personal) queda como primario.
  const primary = created[0];
  if (primary) {
    await db
      .update(userSettings)
      .set({
        primaryAgentId: primary.id,
        primaryAgentPrompt: BASE_AGENTS[0]!.systemPrompt,
        updatedAt: sql`now()`,
      })
      .where(eq(userSettings.userId, userId));
  }

  return created.map((a) => a.id);
}
