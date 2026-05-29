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
  ConnectionError,
  type Provider,
} from '../services/connections.js';

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

  if (!googleOAuthConfigured()) {
    res.status(503).json({
      error: 'La conexión con Google aún no está configurada en este servidor.',
      code: 'not_configured',
    });
    return;
  }
  // TODO-DEUDA(oauth-google-real): canjear `code` por tokens contra Google,
  // validar `state`, y llamar a saveSecret(userId, provider, tokens). Hoy el
  // intercambio queda detrás del SEAM por falta de credenciales de app.
  res.status(501).json({
    error: 'Intercambio de tokens OAuth pendiente de implementación.',
    code: 'not_implemented',
  });
});

// DELETE /api/connections/:provider
connectionsRouter.delete('/:provider', async (req: Request, res: Response) => {
  const provider = requireProvider(req, res);
  if (!provider) return;
  await disconnect(req.tenant!.userId, provider);
  res.json({ ok: true });
});
