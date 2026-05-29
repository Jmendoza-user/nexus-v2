/**
 * GmailSync — SEAM del cron de sincronización de Gmail (INACTIVO).
 *
 * Diseño previsto (cuando exista OAuth real de Google, ver connections.ts):
 *   1. Cron cada ~15 min recorre usuarios con fila activa en gmail_oauth_tokens.
 *   2. Por usuario: descifra access/refresh token, refresca si expiró.
 *   3. Query Gmail API por correos de bancos/comercios desde last_synced_msg_id
 *      (q: 'from:(bancolombia OR davivienda OR bbva OR ...) newer_than:1d').
 *   4. Por cada mensaje nuevo: ingestEmail(userId, tier, {rawText, from, subject,
 *      gmailMsgId, receivedAt, canal:'Sync'}) → Borrador (idempotente por msgId).
 *   5. Actualiza last_synced_at / last_synced_msg_id.
 *
 * ESTADO: INACTIVO. No hay credenciales de app Google (GOOGLE_OAUTH_CLIENT_ID/
 * SECRET ausentes), por lo que gmail_oauth_tokens nunca se rellena y este módulo
 * NO se programa ni ejecuta. Las funciones están implementadas como no-op
 * defensivos para que activar el cron sea cambiar un flag, no escribir lógica.
 *
 * ACTIVACIÓN (deuda documentada):
 *   1. Configurar GOOGLE_OAUTH_CLIENT_ID/SECRET + completar el intercambio de
 *      tokens en connections.ts (TODO-DEUDA(oauth-google-real)).
 *   2. Implementar fetchBankEmails() contra la Gmail API (googleapis o REST).
 *   3. Llamar startGmailSyncCron() desde server.ts SÓLO si gmailSyncEnabled().
 */
import { and, eq, isNotNull } from 'drizzle-orm';
import { db } from '../../db/index.js';
import { gmailOauthTokens, users } from '../../db/schema.js';
import { ingestEmail } from './ingest.js';

/** ¿Está habilitado el sync real? Hoy SIEMPRE false (sin OAuth Google). */
export function gmailSyncEnabled(): boolean {
  return Boolean(
    process.env.GOOGLE_OAUTH_CLIENT_ID?.trim() &&
      process.env.GOOGLE_OAUTH_CLIENT_SECRET?.trim() &&
      process.env.GMAIL_SYNC_ENABLED === 'true'
  );
}

export interface SyncReport {
  userId: string;
  processed: number;
  drafts: number;
  skipped: number;
  enabled: boolean;
}

/**
 * Sincroniza un usuario (SEAM). Sin OAuth real devuelve un reporte vacío con
 * enabled=false. Cuando se active, fetchBankEmails() traerá los correos.
 */
export async function syncUser(userId: string): Promise<SyncReport> {
  if (!gmailSyncEnabled()) {
    return { userId, processed: 0, drafts: 0, skipped: 0, enabled: false };
  }

  const [tok] = await db
    .select()
    .from(gmailOauthTokens)
    .where(and(eq(gmailOauthTokens.userId, userId), isNotNull(gmailOauthTokens.refreshTokenEnc)))
    .limit(1);
  if (!tok) return { userId, processed: 0, drafts: 0, skipped: 0, enabled: true };

  const [u] = await db.select({ tier: users.tier }).from(users).where(eq(users.id, userId)).limit(1);
  const tier = u?.tier ?? 'free';

  // TODO-DEUDA(gmail-fetch): implementar fetchBankEmails() contra Gmail API.
  const emails = await fetchBankEmails(userId, tok.lastSyncedMsgId);

  let drafts = 0;
  let skipped = 0;
  for (const email of emails) {
    const r = await ingestEmail(userId, tier, {
      rawText: email.rawText,
      from: email.from,
      subject: email.subject,
      receivedAt: email.receivedAt,
      gmailMsgId: email.gmailMsgId,
      canal: 'Sync',
    });
    if (r.duplicate || !r.draft) skipped++;
    else drafts++;
  }

  const last = emails[emails.length - 1];
  if (last) {
    await db
      .update(gmailOauthTokens)
      .set({ lastSyncedAt: new Date(), lastSyncedMsgId: last.gmailMsgId })
      .where(eq(gmailOauthTokens.userId, userId));
  }

  return { userId, processed: emails.length, drafts, skipped, enabled: true };
}

interface BankEmail {
  gmailMsgId: string;
  from: string;
  subject: string;
  receivedAt: string;
  rawText: string;
}

/**
 * SEAM: descarga correos bancarios nuevos del usuario. Sin Gmail API real
 * devuelve []. Se implementará al activar el OAuth de Google.
 */
async function fetchBankEmails(_userId: string, _sinceMsgId: string | null): Promise<BankEmail[]> {
  // TODO-DEUDA(gmail-fetch): llamar Gmail API users.messages.list/get,
  // decodificar el body, mapear a BankEmail[]. Hoy SEAM vacío.
  return [];
}

/**
 * Arranca el cron (SEAM). No hace nada si gmailSyncEnabled()===false, para que
 * importarlo en server.ts sea seguro. NUNCA se programa sin OAuth real.
 */
export function startGmailSyncCron(): { started: boolean } {
  if (!gmailSyncEnabled()) {
    return { started: false };
  }
  // TODO-DEUDA(gmail-cron): setInterval(15min) → for each user activo: syncUser().
  // Deferido hasta tener OAuth real + fetchBankEmails().
  return { started: false };
}
