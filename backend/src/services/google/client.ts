/**
 * Cliente OAuth de Google (conexión unificada `google`: Gmail + Calendar + Drive).
 *
 * - exchangeCode(code): canjea el code del callback por tokens.
 * - getGoogleClient(userId): OAuth2Client autorizado y con AUTO-REFRESH que
 *   re-persiste los tokens refrescados (el access_token caduca ~1h; el
 *   refresh_token se conserva). Lanza GoogleNotConnectedError si no hay conexión.
 *
 * Los tokens se guardan cifrados (AES-256-GCM) en connections/google.enc vía
 * connections.saveSecret. El email del usuario Google se guarda dentro del blob
 * y en config (no sensible) para mostrarlo en la UI.
 */
import { google } from 'googleapis';
import type { OAuth2Client, Credentials } from 'google-auth-library';
import { loadSecret, saveSecret, googleRedirectUri } from '../connections.js';

export class GoogleNotConnectedError extends Error {
  constructor() {
    super('El usuario no tiene Google conectado.');
    this.name = 'GoogleNotConnectedError';
  }
}

export function baseClient(): OAuth2Client {
  return new google.auth.OAuth2(
    process.env.GOOGLE_OAUTH_CLIENT_ID,
    process.env.GOOGLE_OAUTH_CLIENT_SECRET,
    googleRedirectUri('google')
  );
}

/** Canjea el authorization code por tokens (access + refresh + id_token). */
export async function exchangeCode(code: string): Promise<Credentials> {
  const client = baseClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

/** Email de la cuenta Google autorizada (para mostrar la conexión). */
export async function fetchGoogleEmail(client: OAuth2Client): Promise<string | null> {
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: client });
    const { data } = await oauth2.userinfo.get();
    return data.email ?? null;
  } catch {
    return null;
  }
}

/**
 * OAuth2Client autorizado para el usuario, con auto-refresh persistente.
 * googleapis refresca el access_token solo usando el refresh_token; el evento
 * 'tokens' nos entrega los nuevos y los re-guardamos cifrados.
 */
export async function getGoogleClient(userId: string): Promise<OAuth2Client> {
  const stored = (await loadSecret(userId, 'google')) as (Credentials & { email?: string }) | null;
  if (!stored || (!stored.refresh_token && !stored.access_token)) {
    throw new GoogleNotConnectedError();
  }
  const client = baseClient();
  client.setCredentials(stored);

  client.on('tokens', (fresh) => {
    const merged: Credentials & { email?: string } = { ...stored, ...fresh };
    // El refresh suele NO reenviar el refresh_token: conservar el original.
    if (!fresh.refresh_token && stored.refresh_token) merged.refresh_token = stored.refresh_token;
    void saveSecret(userId, 'google', merged as unknown as Record<string, unknown>, {
      email: stored.email ?? null,
    }).catch((e) =>
      console.error('[google] no se pudo persistir token refrescado:', (e as Error).message)
    );
  });

  return client;
}

/** ¿El usuario tiene Google conectado (hay tokens)? */
export async function isGoogleConnected(userId: string): Promise<boolean> {
  const stored = await loadSecret(userId, 'google');
  return Boolean(stored && (stored.refresh_token || stored.access_token));
}
