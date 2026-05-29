/**
 * Rutas de Conexiones (montadas en /api/connections, autenticadas + scoped).
 *
 *   GET    /                              → todas las conexiones del usuario.
 *   GET    /:provider                     → estado de una conexión.
 *   POST   /:provider/oauth/start         → inicia OAuth (503 si no configurado).
 *   GET    /:provider/oauth/callback      → callback OAuth (503 si no configurado).
 *   DELETE /:provider                     → desconecta (borra .enc + estado).
 *
 * OAuth REAL diferido: sin GOOGLE_OAUTH_CLIENT_ID/SECRET, start/callback
 * responden 503 con mensaje claro ("conexión no configurada todavía"). El
 * cifrado de tokens (saveSecret) ya está implementado para cuando lleguen.
 */
import { Router, type Request, type Response } from 'express';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  listConnections,
  getStatus,
  disconnect,
  buildGoogleAuthUrl,
  isProvider,
  googleOAuthConfigured,
  saveSecret,
  ConnectionError,
  type Provider,
} from '../services/connections.js';
import { exchangeCode, fetchGoogleEmail, baseClient } from '../services/google/client.js';
import { env } from '../lib/env.js';

export const connectionsRouter = Router();
connectionsRouter.use(authJwt, tenantContext);

function paramProvider(req: Request): string {
  const p = req.params.provider;
  return Array.isArray(p) ? (p[0] ?? '') : (p ?? '');
}

function requireProvider(req: Request, res: Response): Provider | null {
  const raw = paramProvider(req);
  if (!isProvider(raw)) {
    res.status(404).json({ error: 'Proveedor no soportado.' });
    return null;
  }
  return raw;
}

// GET /api/connections
connectionsRouter.get('/', async (req: Request, res: Response) => {
  const conns = await listConnections(req.tenant!.userId);
  res.json({ connections: conns, googleConfigured: googleOAuthConfigured() });
});

// GET /api/connections/:provider
connectionsRouter.get('/:provider', async (req: Request, res: Response) => {
  const provider = requireProvider(req, res);
  if (!provider) return;
  const status = await getStatus(req.tenant!.userId, provider);
  res.json({ connection: status });
});

// POST /api/connections/:provider/oauth/start
connectionsRouter.post('/:provider/oauth/start', async (req: Request, res: Response) => {
  const provider = requireProvider(req, res);
  if (!provider) return;

  // Telegram no usa OAuth: se vincula por /api/telegram/pair.
  if (provider === 'telegram') {
    res.status(409).json({
      error: 'Telegram se vincula desde la sección de Telegram, no por OAuth.',
      code: 'use_telegram_pair',
    });
    return;
  }
  // MercadoPago: SEAM, aún no implementado.
  if (provider === 'mercadopago' || provider === 'meta') {
    res.status(503).json({
      error: 'Esta conexión todavía no está disponible. Próximamente.',
      code: 'not_configured',
    });
    return;
  }

  try {
    // state firma el userId + provider para validar en el callback (deuda: firmar/CSRF).
    const state = Buffer.from(JSON.stringify({ u: req.tenant!.userId, p: provider })).toString('base64url');
    const url = buildGoogleAuthUrl(provider, state);
    res.json({ authUrl: url });
  } catch (err) {
    if (err instanceof ConnectionError && err.code === 'not_configured') {
      res.status(503).json({ error: err.message, code: 'not_configured' });
      return;
    }
    console.error('[connections] oauth/start error:', err);
    res.status(500).json({ error: 'No se pudo iniciar la conexión.' });
  }
});

// GET /api/connections/:provider/oauth/callback
connectionsRouter.get('/:provider/oauth/callback', async (req: Request, res: Response) => {
  const provider = requireProvider(req, res);
  if (!provider) return;

  const appUrl = process.env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`;
  const back = (status: string) => res.redirect(`${appUrl}/?google=${status}`);

  if (!googleOAuthConfigured()) {
    return back('not_configured');
  }

  // El usuario canceló el consentimiento.
  const oauthErr = typeof req.query.error === 'string' ? req.query.error : null;
  if (oauthErr) return back('denied');

  const code = typeof req.query.code === 'string' ? req.query.code : '';
  const stateRaw = typeof req.query.state === 'string' ? req.query.state : '';
  if (!code || !stateRaw) return back('error');

  // Validar state (CSRF): el userId firmado debe coincidir con la sesión.
  let stateUser = '';
  try {
    const parsed = JSON.parse(Buffer.from(stateRaw, 'base64url').toString('utf8')) as { u?: string };
    stateUser = parsed.u ?? '';
  } catch {
    return back('error');
  }
  if (!stateUser || stateUser !== req.tenant!.userId) {
    return back('error');
  }

  try {
    const tokens = await exchangeCode(code);
    // Email de la cuenta autorizada (para mostrar la conexión).
    const client = baseClient();
    client.setCredentials(tokens);
    const email = await fetchGoogleEmail(client);
    // Guarda como conexión unificada `google` (Gmail + Calendar + Drive).
    await saveSecret(req.tenant!.userId, 'google', { ...tokens, email }, { email });
    return back('connected');
  } catch (err) {
    console.error('[connections] google oauth callback error:', (err as Error).message);
    return back('error');
  }
});

// DELETE /api/connections/:provider
connectionsRouter.delete('/:provider', async (req: Request, res: Response) => {
  const provider = requireProvider(req, res);
  if (!provider) return;
  await disconnect(req.tenant!.userId, provider);
  res.json({ ok: true });
});
