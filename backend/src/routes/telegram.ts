/**
 * Rutas de Telegram.
 *
 *  - telegramApiRouter (montado en /api/telegram, AUTENTICADO):
 *      POST /pair            → genera un código de vinculación (6 chars, 15 min).
 *      GET  /pairing-status  → indica si el usuario ya tiene chat vinculado.
 *
 *  - telegramWebhookRouter (montado en /tg/webhook, PÚBLICO, sin authJwt):
 *      POST /:secret  → recibe updates de Telegram. Procesa "/start <codigo>":
 *                       valida el código y vincula el chat al usuario.
 *
 * ⛔ INFRA: el webhook NO está activo hasta que Jerson configure el bot
 * dedicado (TELEGRAM_BOT_TOKEN_V2) y registre setWebhook. Si el bot no está
 * configurado, el webhook responde 503 (no procesa). NO hay polling en ningún
 * punto del arranque del backend.
 */
import { Router, type Request, type Response } from 'express';
import { env } from '../lib/env.js';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  createPairingCode,
  consumePairingCode,
  getPairingStatus,
} from '../services/telegramPairing.js';
import { sendMessage, isTelegramEnabled } from '../services/telegramNotifier.js';

// ── API autenticada (PWA) ────────────────────────────────────────────────────
export const telegramApiRouter = Router();
telegramApiRouter.use(authJwt, tenantContext);

telegramApiRouter.post('/pair', async (req: Request, res: Response) => {
  const userId = req.tenant!.userId;
  const { code, expiresAt, ttlSeconds } = await createPairingCode(userId);
  const botUsername = env.TELEGRAM_BOT_USERNAME;
  res.status(201).json({
    code,
    expiresAt: expiresAt.toISOString(),
    ttlSeconds,
    botUsername,
    instructions: `Abre @${botUsername}, envía /start ${code}`,
  });
});

telegramApiRouter.get('/pairing-status', async (req: Request, res: Response) => {
  const status = await getPairingStatus(req.tenant!.userId);
  res.json({
    linked: status.linked,
    pairedAt: status.pairedAt ? status.pairedAt.toISOString() : null,
  });
});

// ── Webhook público de Telegram ──────────────────────────────────────────────
export const telegramWebhookRouter = Router();

/**
 * Extrae el comando /start <arg> de un update de Telegram (mensaje de texto).
 * Devuelve { chatId, arg } o null si el update no es un /start con argumento.
 */
function parseStart(update: unknown): { chatId: number; arg: string } | null {
  const msg = (update as { message?: { chat?: { id?: number }; text?: string } })?.message;
  const chatId = msg?.chat?.id;
  const text = msg?.text;
  if (typeof chatId !== 'number' || typeof text !== 'string') return null;
  const m = text.trim().match(/^\/start(?:@\w+)?\s+(\S+)/i);
  if (!m) return null;
  return { chatId, arg: m[1]! };
}

function paramSecret(req: Request): string {
  const s = req.params.secret;
  return Array.isArray(s) ? (s[0] ?? '') : (s ?? '');
}

async function handleWebhook(req: Request, res: Response): Promise<void> {
  // Bot dedicado no configurado → webhook inactivo. NO procesa nada.
  if (!isTelegramEnabled() || !env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(503).json({ ok: false, error: 'Webhook de Telegram no configurado.' });
    return;
  }

  // Valida el secret del path o el header de Telegram (setWebhook secret_token).
  const headerSecret = req.get('x-telegram-bot-api-secret-token');
  const pathSecret = paramSecret(req);
  const provided = pathSecret || headerSecret || '';
  if (provided !== env.TELEGRAM_WEBHOOK_SECRET) {
    res.status(403).json({ ok: false });
    return;
  }

  // Responder 200 SIEMPRE a Telegram (para que no reintente); el resultado de
  // negocio se comunica al usuario por chat, no por el status HTTP.
  const start = parseStart(req.body);
  if (!start) {
    res.json({ ok: true });
    return;
  }

  try {
    const result = await consumePairingCode(start.arg, start.chatId);
    if (result.ok) {
      await sendMessage(start.chatId, 'Vinculado a NEXUS ✓');
    } else {
      const reply =
        result.reason === 'expired'
          ? 'Ese código ya expiró. Genera uno nuevo desde la app.'
          : result.reason === 'already_consumed'
            ? 'Ese código ya se usó. Genera uno nuevo desde la app.'
            : 'No reconozco ese código. Revísalo y vuelve a intentarlo.';
      await sendMessage(start.chatId, reply);
    }
  } catch (err) {
    console.error('[telegram] webhook error procesando /start:', err);
  }
  res.json({ ok: true });
}

// Acepta el secret en el path (/tg/webhook/<secret>) o por header en /tg/webhook.
telegramWebhookRouter.post('/:secret', handleWebhook);
telegramWebhookRouter.post('/', handleWebhook);
