/**
 * Perfil del usuario autenticado: GET/PATCH /api/users/me.
 *
 * Devuelve y actualiza datos de perfil que viven en `users` (displayName,
 * locale, timezone) y en `user_settings` (ui_theme, primary_agent_prompt).
 * Todo scoped al usuario de la sesión (authJwt). No expone ni toca otros tenants.
 *
 * Nota: GET /api/auth/me sigue siendo el endpoint "rico" (user+org+tier+quotas)
 * que la app usa al bootear. /api/users/me es el endpoint de PERFIL editable.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users, userSettings } from '../db/schema.js';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';

export const usersRouter = Router();

usersRouter.use(authJwt, tenantContext);

const patchSchema = z
  .object({
    displayName: z.string().trim().min(1).max(120).optional(),
    locale: z.string().trim().min(2).max(20).optional(),
    timezone: z.string().trim().min(1).max(64).optional(),
    uiTheme: z.enum(['dark', 'light', 'auto']).optional(),
    primaryAgentPrompt: z.string().trim().max(8000).optional(),
  })
  .strict();

/** Forma del perfil devuelto por GET y PATCH. */
async function loadProfile(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [settings] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, userId))
    .limit(1);

  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    locale: user.locale,
    timezone: user.timezone,
    tier: user.tier,
    telegramChatId: user.telegramChatId,
    uiTheme: settings?.uiTheme ?? 'dark',
    primaryAgentId: settings?.primaryAgentId ?? null,
    primaryAgentPrompt: settings?.primaryAgentPrompt ?? null,
  };
}

usersRouter.get('/me', async (req: Request, res: Response) => {
  const profile = await loadProfile(req.tenant!.userId);
  if (!profile) {
    res.status(404).json({ error: 'Usuario no encontrado.' });
    return;
  }
  res.json({ user: profile });
});

usersRouter.patch('/me', async (req: Request, res: Response) => {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  const userId = req.tenant!.userId;
  const { displayName, locale, timezone, uiTheme, primaryAgentPrompt } = parsed.data;

  // Campos de `users`.
  const userPatch: Record<string, unknown> = {};
  if (displayName !== undefined) userPatch.displayName = displayName;
  if (locale !== undefined) userPatch.locale = locale;
  if (timezone !== undefined) userPatch.timezone = timezone;
  if (Object.keys(userPatch).length > 0) {
    await db.update(users).set(userPatch).where(eq(users.id, userId));
  }

  // Campos de `user_settings` (existe siempre: lo crea registerUser).
  const settingsPatch: Record<string, unknown> = {};
  if (uiTheme !== undefined) settingsPatch.uiTheme = uiTheme;
  if (primaryAgentPrompt !== undefined) settingsPatch.primaryAgentPrompt = primaryAgentPrompt;
  if (Object.keys(settingsPatch).length > 0) {
    settingsPatch.updatedAt = sql`now()`;
    await db.update(userSettings).set(settingsPatch).where(eq(userSettings.userId, userId));
  }

  const profile = await loadProfile(userId);
  res.json({ user: profile });
});
