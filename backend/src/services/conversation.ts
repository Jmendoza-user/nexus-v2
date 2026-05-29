/**
 * Conversación persistente — historial server-side (continuidad real).
 *
 * Hilo único rolling por usuario: el asistente carga los últimos N mensajes
 * como contexto y persiste cada turno (user + assistant). La pantalla Chat
 * recupera el historial al recargar, así no se pierde entre sesiones/dispositivos.
 */
import { asc, desc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { chatMessages, type ChatMessageRow } from '../db/schema.js';

export type ChatRole = 'user' | 'assistant';

/** Persiste un mensaje del hilo del usuario. */
export async function appendMessage(userId: string, orgId: string, role: ChatRole, content: string): Promise<void> {
  const text = content?.trim();
  if (!text) return;
  await db.insert(chatMessages).values({ userId, orgId, role, content: text });
}

/**
 * Últimos `limit` mensajes en orden cronológico (para contexto del modelo).
 * Trae los más recientes y los devuelve ascendentes.
 */
export async function recentHistory(userId: string, limit = 20): Promise<{ role: ChatRole; content: string }[]> {
  const rows = await db
    .select({ role: chatMessages.role, content: chatMessages.content })
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(desc(chatMessages.createdAt))
    .limit(limit);
  return rows.reverse().map((r) => ({ role: r.role as ChatRole, content: r.content }));
}

/** Historial completo (para la pantalla Chat), cronológico, tope defensivo. */
export async function listMessages(userId: string, limit = 200): Promise<ChatMessageRow[]> {
  return db
    .select()
    .from(chatMessages)
    .where(eq(chatMessages.userId, userId))
    .orderBy(asc(chatMessages.createdAt))
    .limit(limit);
}

/** Borra todo el hilo del usuario (nueva conversación). */
export async function clearConversation(userId: string): Promise<void> {
  await db.delete(chatMessages).where(eq(chatMessages.userId, userId));
}
