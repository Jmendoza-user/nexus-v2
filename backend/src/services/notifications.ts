/**
 * notifications — avisos al usuario (in-app + espejo Telegram), scoped.
 *
 * createNotification() inserta la fila (channel 'inapp' por defecto) y, si se
 * pide channel 'telegram' o `alsoTelegram`, dispara telegramNotifier.notify
 * (no-op si el bot V2 no está configurado). El badge de la topbar se calcula
 * con unreadCount(). Todo aislado por user_id.
 */
import { and, eq, isNull, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications, type Notification } from '../db/schema.js';
import { notify as telegramNotify } from './telegramNotifier.js';

export interface CreateNotificationInput {
  userId: string;
  orgId?: string | null;
  kind: string; // monitor | autocure | system | ...
  title: string;
  body?: string | null;
  data?: Record<string, unknown>;
  /** Canal principal de registro. Default 'inapp'. */
  channel?: 'inapp' | 'telegram';
  /** Si true, además del registro envía un espejo por Telegram (best-effort). */
  alsoTelegram?: boolean;
}

/** Crea una notificación (scoped) y opcionalmente la espeja a Telegram. */
export async function createNotification(input: CreateNotificationInput): Promise<Notification> {
  const [row] = await db
    .insert(notifications)
    .values({
      userId: input.userId,
      orgId: input.orgId ?? null,
      channel: input.channel ?? 'inapp',
      kind: input.kind,
      title: input.title,
      body: input.body ?? null,
      data: (input.data ?? {}) as Record<string, unknown>,
    })
    .returning();

  if (input.alsoTelegram || input.channel === 'telegram') {
    const text = input.body ? `${input.title}\n${input.body}` : input.title;
    void telegramNotify(input.userId, `NEXUS: ${text}`).catch(() => {});
  }
  return row!;
}

/** Lista notificaciones del tenant (más recientes primero). */
export async function listNotifications(userId: string, limit = 50): Promise<Notification[]> {
  return db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(Math.min(Math.max(1, limit), 200));
}

/** Cuenta no leídas del tenant (para el badge). */
export async function unreadCount(userId: string): Promise<number> {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
  return row?.n ?? 0;
}

/**
 * Marca una notificación como leída, sólo si pertenece al tenant.
 * Devuelve true si afectó una fila (404 en el handler si false).
 */
export async function markRead(userId: string, id: string): Promise<boolean> {
  const rows = await db
    .update(notifications)
    .set({ readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning({ id: notifications.id });
  return rows.length > 0;
}
