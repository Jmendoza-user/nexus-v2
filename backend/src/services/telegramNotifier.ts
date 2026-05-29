/**
 * telegramNotifier — envío de mensajes a Telegram vía Bot API.
 *
 * ⛔ REGLA CRÍTICA DE INFRA: V2 usa EXCLUSIVAMENTE TELEGRAM_BOT_TOKEN_V2 (bot
 * dedicado @NexusJ4Bot). NUNCA el TELEGRAM_BOT_TOKEN compartido (lo usa otro
 * sistema). Si TELEGRAM_BOT_TOKEN_V2 está vacío, todas las funciones quedan
 * NO-OP con un log claro: ni siquiera se construye la URL del bot. Tampoco hay
 * ningún getUpdates/polling en este módulo — el ingreso de updates es por
 * webhook (routes/telegram.ts), nunca por poll.
 */
import { env } from '../lib/env.js';

const API_BASE = 'https://api.telegram.org';

/** ¿Está configurado el bot dedicado de V2? Si no, todo es no-op. */
export function isTelegramEnabled(): boolean {
  return env.TELEGRAM_BOT_TOKEN_V2.trim().length > 0;
}

/**
 * Envía un mensaje a un chat de Telegram por chat_id directo.
 * No-op (devuelve false) si el bot no está configurado.
 */
export async function sendMessage(chatId: number, text: string): Promise<boolean> {
  if (!isTelegramEnabled()) {
    console.warn(
      '[telegram] sendMessage NO-OP: TELEGRAM_BOT_TOKEN_V2 vacío. ' +
        'Configura el bot dedicado de V2 para habilitar el envío.'
    );
    return false;
  }
  try {
    const res = await fetch(`${API_BASE}/bot${env.TELEGRAM_BOT_TOKEN_V2}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    if (!res.ok) {
      console.error(`[telegram] sendMessage HTTP ${res.status}: ${await res.text().catch(() => '')}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[telegram] sendMessage error de red:', err);
    return false;
  }
}

/**
 * notify(userId, text) — envía a un usuario por su telegram_chat_id vinculado.
 *
 * Carga perezosa de db para evitar ciclos en arranque. Devuelve false si el
 * usuario no tiene chat vinculado o si el bot no está configurado.
 */
export async function notify(userId: string, text: string): Promise<boolean> {
  if (!isTelegramEnabled()) {
    console.warn(`[telegram] notify NO-OP (bot V2 sin configurar) user=${userId}`);
    return false;
  }
  const { db } = await import('../db/index.js');
  const { users } = await import('../db/schema.js');
  const { eq } = await import('drizzle-orm');

  const [user] = await db
    .select({ chatId: users.telegramChatId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user?.chatId) {
    console.warn(`[telegram] notify: user=${userId} sin telegram_chat_id vinculado.`);
    return false;
  }
  return sendMessage(user.chatId, text);
}
