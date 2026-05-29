/**
 * notifications.ts — avisos del usuario (Hito 4), scoped por tenant.
 *
 *   GET  /api/notifications            → lista + unreadCount (para el badge).
 *   POST /api/notifications/:id/read   → marca leída (404 si no es del tenant).
 */
import { Router, type Request, type Response } from 'express';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { listNotifications, unreadCount, markRead } from '../services/notifications.js';
import type { Notification } from '../db/schema.js';

export const notificationsRouter = Router();
notificationsRouter.use(authJwt, tenantContext);

function view(n: Notification) {
  return {
    id: n.id,
    channel: n.channel,
    kind: n.kind,
    title: n.title,
    body: n.body,
    data: n.data,
    read: n.readAt !== null,
    readAt: n.readAt,
    createdAt: n.createdAt,
  };
}

notificationsRouter.get('/', async (req: Request, res: Response) => {
  const userId = req.tenant!.userId;
  const [list, unread] = await Promise.all([listNotifications(userId), unreadCount(userId)]);
  res.json({ notifications: list.map(view), unread });
});

notificationsRouter.post('/:id/read', async (req: Request, res: Response) => {
  const ok = await markRead(req.tenant!.userId, String(req.params.id));
  if (!ok) {
    res.status(404).json({ error: 'Notificación no encontrada.' });
    return;
  }
  res.json({ ok: true });
});
