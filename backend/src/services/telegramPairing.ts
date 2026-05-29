/**
 * telegramPairing — lógica de vinculación de un chat de Telegram a un usuario.
 *
 * Flujo:
 *   1. PWA → createPairingCode(userId): genera un código de 6 chars, expira en
 *      15 min, lo persiste en telegram_pairings.
 *   2. Usuario → envía "/start <codigo>" a @NexusJ4Bot.
 *   3. Webhook → consumePairingCode(code, chatId): valida (existe, no consumido,
 *      no expirado), escribe users.telegram_chat_id + telegram_paired_at, marca
 *      consumed_at. Idempotente ante reintentos del mismo código (ya consumido →
 *      'already_consumed').
 *
 * Código sin caracteres ambiguos (sin 0/O/1/I) para dictarlo o teclearlo fácil.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { telegramPairings, users } from '../db/schema.js';

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin O/0/I/1
const CODE_LENGTH = 6;
export const PAIRING_TTL_MS = 15 * 60 * 1000; // 15 minutos

function randomCode(): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

export interface PairingCode {
  code: string;
  expiresAt: Date;
  ttlSeconds: number;
}

/**
 * Crea un código de vinculación para `userId`. Reintenta ante colisión de PK
 * (extremadamente improbable). El código vive 15 min.
 */
export async function createPairingCode(userId: string): Promise<PairingCode> {
  const expiresAt = new Date(Date.now() + PAIRING_TTL_MS);
  // Hasta 5 intentos por si el código aleatorio colisiona con uno vigente.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = randomCode();
    try {
      await db.insert(telegramPairings).values({ pairingCode: code, userId, expiresAt });
      return { code, expiresAt, ttlSeconds: Math.floor(PAIRING_TTL_MS / 1000) };
    } catch (err) {
      // 23505 = unique_violation (colisión de PK); reintenta con otro código.
      if ((err as { code?: string }).code === '23505') continue;
      throw err;
    }
  }
  throw new Error('No se pudo generar un código de vinculación único.');
}

export type ConsumeResult =
  | { ok: true; userId: string }
  | { ok: false; reason: 'not_found' | 'expired' | 'already_consumed' };

/**
 * Consume un código: lo valida y vincula `chatId` al usuario dueño del código.
 * Atómico: marca consumed_at solo si seguía sin consumir; setea
 * users.telegram_chat_id + telegram_paired_at.
 */
export async function consumePairingCode(
  codeRaw: string,
  chatId: number
): Promise<ConsumeResult> {
  const code = codeRaw.trim().toUpperCase();
  if (!code) return { ok: false, reason: 'not_found' };

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(telegramPairings)
      .where(eq(telegramPairings.pairingCode, code))
      .limit(1);

    if (!row) return { ok: false, reason: 'not_found' as const };
    if (row.consumedAt) return { ok: false, reason: 'already_consumed' as const };
    if (row.expiresAt.getTime() < Date.now()) return { ok: false, reason: 'expired' as const };

    // Marca consumido SOLO si aún no lo estaba (carrera entre dos updates del bot).
    const consumed = await tx
      .update(telegramPairings)
      .set({ consumedAt: sql`now()` })
      .where(and(eq(telegramPairings.pairingCode, code), isNull(telegramPairings.consumedAt)))
      .returning({ pairingCode: telegramPairings.pairingCode });
    if (consumed.length === 0) return { ok: false, reason: 'already_consumed' as const };

    await tx
      .update(users)
      .set({ telegramChatId: chatId, telegramPairedAt: sql`now()` })
      .where(eq(users.id, row.userId));

    return { ok: true as const, userId: row.userId };
  });
}

/** ¿El usuario ya tiene un chat de Telegram vinculado? */
export async function getPairingStatus(
  userId: string
): Promise<{ linked: boolean; chatId: number | null; pairedAt: Date | null }> {
  const [user] = await db
    .select({ chatId: users.telegramChatId, pairedAt: users.telegramPairedAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return {
    linked: !!user?.chatId,
    chatId: user?.chatId ?? null,
    pairedAt: user?.pairedAt ?? null,
  };
}
