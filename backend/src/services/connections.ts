/**
 * Servicio de Conexiones externas (OAuth SEAM).
 *
 * Estado por proveedor en la tabla `connections` (scoped). Los tokens NUNCA
 * viven en la DB: se cifran con AES-256-GCM (lib/crypto, ENCRYPTION_KEY) y se
 * guardan en ${env}/connections/<provider>.enc. La DB solo guarda `secret_ref`
 * (ruta relativa al .enc) + metadata no sensible en `config`.
 *
 * OAuth REAL diferido: el flujo (start/callback) está estructurado, pero sin
 * GOOGLE_OAUTH_CLIENT_ID/SECRET devuelve 503 con mensaje claro. Telegram se
 * integra como provider leyendo users.telegram_chat_id (Hito 1C ya lo provee).
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { connections, users, type Connection } from '../db/schema.js';
import { encrypt, decrypt } from '../lib/crypto.js';
import { resolveUserPaths, provisionUserEnv, assertWithinUserEnv } from './userEnv.js';
import { env } from '../lib/env.js';

export const PROVIDERS = ['google', 'gmail', 'gcal', 'meta', 'telegram', 'mercadopago'] as const;
export type Provider = (typeof PROVIDERS)[number];

/**
 * Scopes solicitados por la conexión unificada `google` (un solo consent →
 * Gmail + Calendar + Drive). Amplios para "control total": la IA puede leer y
 * crear libremente; las acciones DESTRUCTIVAS (enviar, borrar) se gatean en la
 * capa de aplicación con aprobación humana (no por scope).
 */
export const GOOGLE_SCOPES = [
  'openid',
  'email',
  'profile',
  'https://www.googleapis.com/auth/gmail.modify', // leer, etiquetar, papelera
  'https://www.googleapis.com/auth/gmail.send', // enviar (gateado por aprobación)
  'https://www.googleapis.com/auth/calendar', // agenda r/w
  'https://www.googleapis.com/auth/drive', // archivos r/w
];

export type ConnectionStatus = 'active' | 'disconnected' | 'expired' | 'pending';

export class ConnectionError extends Error {
  constructor(
    public code: 'invalid_provider' | 'not_configured' | 'env_unavailable',
    message: string
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export function isProvider(p: string): p is Provider {
  return (PROVIDERS as readonly string[]).includes(p);
}

/** Providers cuyo OAuth depende de credenciales de app de Google. */
const GOOGLE_PROVIDERS: Provider[] = ['google', 'gmail', 'gcal'];

/** ¿Hay credenciales de Google app configuradas para el OAuth real? */
export function googleOAuthConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() && process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim()
  );
}

/** Vista pública de una conexión (sin exponer secretos ni la ruta .enc cruda). */
export interface ConnectionView {
  provider: Provider;
  status: ConnectionStatus;
  config: Record<string, unknown>;
  hasSecret: boolean;
  updatedAt: string | null;
}

function toView(provider: Provider, row: Connection | null): ConnectionView {
  if (!row) {
    return { provider, status: 'disconnected', config: {}, hasSecret: false, updatedAt: null };
  }
  return {
    provider,
    status: row.status as ConnectionStatus,
    config: (row.config as Record<string, unknown>) ?? {},
    hasSecret: Boolean(row.secretRef),
    updatedAt: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

/**
 * Lista TODOS los providers conocidos con su estado actual.
 * Telegram se deriva de users.telegram_chat_id (no requiere fila en connections).
 */
export async function listConnections(userId: string): Promise<ConnectionView[]> {
  const rows = await db.select().from(connections).where(eq(connections.userId, userId));
  const byProvider = new Map(rows.map((r) => [r.provider as Provider, r]));

  // Telegram: estado real desde el usuario (Hito 1C).
  const [u] = await db
    .select({ chatId: users.telegramChatId })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const telegramLinked = Boolean(u?.chatId);

  return PROVIDERS.map((p) => {
    if (p === 'telegram') {
      const row = byProvider.get('telegram') ?? null;
      return {
        provider: 'telegram',
        status: (telegramLinked ? 'active' : 'disconnected') as ConnectionStatus,
        config: row ? ((row.config as Record<string, unknown>) ?? {}) : {},
        hasSecret: false,
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).toISOString() : null,
      };
    }
    return toView(p, byProvider.get(p) ?? null);
  });
}

export async function getStatus(userId: string, provider: Provider): Promise<ConnectionView> {
  const all = await listConnections(userId);
  return all.find((c) => c.provider === provider)!;
}

/** Upsert del estado de una conexión (sin tocar secreto). */
export async function upsertConnection(
  userId: string,
  provider: Provider,
  patch: { status?: ConnectionStatus; config?: Record<string, unknown>; secretRef?: string | null }
): Promise<Connection> {
  const [row] = await db
    .insert(connections)
    .values({
      userId,
      provider,
      status: patch.status ?? 'pending',
      config: patch.config ?? {},
      secretRef: patch.secretRef ?? null,
    })
    .onConflictDoUpdate({
      target: [connections.userId, connections.provider],
      set: {
        ...(patch.status ? { status: patch.status } : {}),
        ...(patch.config ? { config: patch.config } : {}),
        ...(patch.secretRef !== undefined ? { secretRef: patch.secretRef } : {}),
        updatedAt: sql`now()`,
      },
    })
    .returning();
  return row!;
}

/**
 * Persiste tokens cifrados de un provider en ${env}/connections/<provider>.enc
 * y marca la conexión como active. Devuelve la conexión actualizada.
 *
 * Se llama cuando llegan tokens reales (callback OAuth). Hoy queda detrás del
 * SEAM 503; el cifrado/escritura está implementado y probado vía roundtrip.
 */
export async function saveSecret(
  userId: string,
  provider: Provider,
  tokens: Record<string, unknown>,
  config: Record<string, unknown> = {}
): Promise<Connection> {
  let paths = await resolveUserPaths(userId);
  if (!paths) {
    const [u] = await db
      .select({ orgId: users.defaultOrgId, tier: users.tier })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);
    if (!u?.orgId) throw new ConnectionError('env_unavailable', 'Usuario sin entorno aislado.');
    paths = await provisionUserEnv({ userId, orgId: u.orgId, tier: u.tier });
  }

  const relPath = path.join('connections', `${provider}.enc`);
  const absPath = assertWithinUserEnv(paths, relPath);
  await fs.mkdir(path.dirname(absPath), { recursive: true, mode: 0o750 });
  const blob = encrypt(JSON.stringify(tokens));
  await fs.writeFile(absPath, blob, { mode: 0o600 });

  return upsertConnection(userId, provider, { status: 'active', config, secretRef: relPath });
}

/** Lee y descifra los tokens guardados de un provider (o null si no hay). */
export async function loadSecret(
  userId: string,
  provider: Provider
): Promise<Record<string, unknown> | null> {
  const paths = await resolveUserPaths(userId);
  if (!paths) return null;
  const absPath = assertWithinUserEnv(paths, path.join('connections', `${provider}.enc`));
  if (!existsSync(absPath)) return null;
  const blob = await fs.readFile(absPath, 'utf8');
  return JSON.parse(decrypt(blob)) as Record<string, unknown>;
}

/** Desconecta: borra el .enc y marca disconnected (idempotente). */
export async function disconnect(userId: string, provider: Provider): Promise<void> {
  const paths = await resolveUserPaths(userId);
  if (paths) {
    const absPath = assertWithinUserEnv(paths, path.join('connections', `${provider}.enc`));
    if (existsSync(absPath)) await fs.rm(absPath, { force: true });
  }
  const existing = await db
    .select({ id: connections.id })
    .from(connections)
    .where(and(eq(connections.userId, userId), eq(connections.provider, provider)))
    .limit(1);
  if (existing.length) {
    await upsertConnection(userId, provider, { status: 'disconnected', secretRef: null });
  }
}

/**
 * Construye la URL de autorización OAuth de Google (gmail/gcal).
 * Lanza ConnectionError('not_configured') si faltan las credenciales → 503.
 */
export function buildGoogleAuthUrl(provider: Provider, state: string): string {
  if (!GOOGLE_PROVIDERS.includes(provider)) {
    throw new ConnectionError('invalid_provider', `Provider sin OAuth Google: ${provider}`);
  }
  if (!googleOAuthConfigured()) {
    throw new ConnectionError(
      'not_configured',
      'La conexión con Google aún no está configurada en este servidor.'
    );
  }
  const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID!;
  const redirectUri = googleRedirectUri(provider);
  const scopes =
    provider === 'google'
      ? GOOGLE_SCOPES
      : provider === 'gmail'
        ? ['https://www.googleapis.com/auth/gmail.readonly']
        : ['https://www.googleapis.com/auth/calendar'];
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    access_type: 'offline', // pide refresh_token
    prompt: 'consent', // fuerza refresh_token aunque ya haya consentido antes
    include_granted_scopes: 'true',
    state,
    scope: scopes.join(' '),
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Redirect URI canónico para el provider (debe coincidir EXACTO en Google Cloud). */
export function googleRedirectUri(provider: Provider): string {
  return (
    process.env.GOOGLE_OAUTH_REDIRECT_URI ??
    `${process.env.PUBLIC_BASE_URL ?? `http://localhost:${env.PORT}`}/api/connections/${provider}/oauth/callback`
  );
}
