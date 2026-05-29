/**
 * Herramientas de Google para el asistente (Gmail + Calendar + Drive).
 *
 * El gateway opencode-go NO soporta function-calling nativo confiable, así que
 * usamos un protocolo por prompt: el modelo emite {"tool","args"} y aquí lo
 * ejecutamos. Acciones de LECTURA/CREACIÓN se ejecutan directo; las
 * DESTRUCTIVAS (enviar correo, borrar) exigen args.confirmed===true (HITL):
 * si falta, devolvemos requires_confirmation para que el asistente pregunte.
 */
import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { getGoogleClient, GoogleNotConnectedError } from './client.js';

export const GOOGLE_TOOL_NAMES = [
  'gmail_search',
  'gmail_read',
  'gmail_create_draft',
  'gmail_send',
  'calendar_list_events',
  'calendar_create_event',
  'calendar_delete_event',
  'drive_search',
  'drive_read_file',
  'drive_create_file',
  'drive_delete_file',
] as const;
export type GoogleToolName = (typeof GOOGLE_TOOL_NAMES)[number];

const DESTRUCTIVE = new Set<GoogleToolName>(['gmail_send', 'calendar_delete_event', 'drive_delete_file']);

export function isGoogleTool(name: string): name is GoogleToolName {
  return (GOOGLE_TOOL_NAMES as readonly string[]).includes(name);
}

type Args = Record<string, unknown>;
const str = (v: unknown): string => (typeof v === 'string' ? v : v == null ? '' : String(v));
const num = (v: unknown, d: number): number => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 50) : d;
};

// ── Gmail helpers ───────────────────────────────────────────────────────────
function decodeB64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}
/* Extrae el primer text/plain (o text/html como fallback) del payload. */
function extractBody(payload: unknown): string {
  const walk = (part: { mimeType?: string; body?: { data?: string }; parts?: unknown[] } | undefined): string => {
    if (!part) return '';
    if (part.mimeType === 'text/plain' && part.body?.data) return decodeB64Url(part.body.data);
    if (Array.isArray(part.parts)) {
      for (const p of part.parts) {
        const t = walk(p as never);
        if (t) return t;
      }
    }
    if (part.mimeType === 'text/html' && part.body?.data) {
      return decodeB64Url(part.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
    }
    return '';
  };
  return walk(payload as never).slice(0, 8000);
}
function header(
  headers: Array<{ name?: string | null; value?: string | null }> | undefined,
  name: string
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? '';
}
/* Construye un mensaje RFC822 base64url para drafts/send. */
function buildRaw(to: string, subject: string, body: string): string {
  const lines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${Buffer.from(subject).toString('base64')}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    '',
    body,
  ];
  return Buffer.from(lines.join('\r\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Ejecutor ────────────────────────────────────────────────────────────────
export interface ToolResult {
  ok: boolean;
  [k: string]: unknown;
}

export async function runGoogleTool(userId: string, name: string, rawArgs: unknown): Promise<ToolResult> {
  if (!isGoogleTool(name)) return { ok: false, error: `Herramienta desconocida: ${name}` };
  const args: Args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Args;

  // HITL: acciones destructivas requieren confirmación explícita.
  if (DESTRUCTIVE.has(name) && args.confirmed !== true) {
    return {
      ok: false,
      requires_confirmation: true,
      message:
        'Esta acción es destructiva (envía o borra). Pide confirmación explícita al usuario y vuelve a llamar la herramienta con "confirmed": true.',
    };
  }

  let auth: OAuth2Client;
  try {
    auth = await getGoogleClient(userId);
  } catch (e) {
    if (e instanceof GoogleNotConnectedError) {
      return { ok: false, not_connected: true, message: 'El usuario no tiene Google conectado (Cuenta → Conexiones → Google).' };
    }
    throw e;
  }

  try {
    switch (name) {
      case 'gmail_search': {
        const gmail = google.gmail({ version: 'v1', auth });
        const list = await gmail.users.messages.list({ userId: 'me', q: str(args.query), maxResults: num(args.max, 8) });
        const ids = (list.data.messages ?? []).map((m) => m.id!).filter(Boolean);
        const items = await Promise.all(
          ids.map(async (id) => {
            const m = await gmail.users.messages.get({ userId: 'me', id, format: 'metadata', metadataHeaders: ['From', 'Subject', 'Date'] });
            const h = m.data.payload?.headers;
            return { id, from: header(h, 'From'), subject: header(h, 'Subject'), date: header(h, 'Date'), snippet: m.data.snippet ?? '' };
          })
        );
        return { ok: true, count: items.length, messages: items };
      }
      case 'gmail_read': {
        const gmail = google.gmail({ version: 'v1', auth });
        const m = await gmail.users.messages.get({ userId: 'me', id: str(args.id), format: 'full' });
        const h = m.data.payload?.headers;
        return {
          ok: true,
          from: header(h, 'From'),
          to: header(h, 'To'),
          subject: header(h, 'Subject'),
          date: header(h, 'Date'),
          body: extractBody(m.data.payload),
        };
      }
      case 'gmail_create_draft': {
        const gmail = google.gmail({ version: 'v1', auth });
        const raw = buildRaw(str(args.to), str(args.subject), str(args.body));
        const d = await gmail.users.drafts.create({ userId: 'me', requestBody: { message: { raw } } });
        return { ok: true, draftId: d.data.id, message: 'Borrador creado (no enviado).' };
      }
      case 'gmail_send': {
        const gmail = google.gmail({ version: 'v1', auth });
        const raw = buildRaw(str(args.to), str(args.subject), str(args.body));
        const s = await gmail.users.messages.send({ userId: 'me', requestBody: { raw } });
        return { ok: true, id: s.data.id, message: `Correo enviado a ${str(args.to)}.` };
      }
      case 'calendar_list_events': {
        const cal = google.calendar({ version: 'v3', auth });
        let timeMin: string, timeMax: string;
        if (args.date) {
          const d = str(args.date);
          timeMin = new Date(`${d}T00:00:00`).toISOString();
          timeMax = new Date(`${d}T23:59:59`).toISOString();
        } else {
          timeMin = new Date().toISOString();
          timeMax = new Date(Date.now() + 7 * 864e5).toISOString();
        }
        const ev = await cal.events.list({ calendarId: 'primary', timeMin, timeMax, singleEvents: true, orderBy: 'startTime', maxResults: num(args.max, 15) });
        const items = (ev.data.items ?? []).map((e) => ({
          id: e.id, summary: e.summary ?? '(sin título)', start: e.start?.dateTime ?? e.start?.date, end: e.end?.dateTime ?? e.end?.date, location: e.location ?? null,
        }));
        return { ok: true, count: items.length, events: items };
      }
      case 'calendar_create_event': {
        const cal = google.calendar({ version: 'v3', auth });
        const e = await cal.events.insert({
          calendarId: 'primary',
          requestBody: {
            summary: str(args.summary),
            description: args.description ? str(args.description) : undefined,
            start: { dateTime: str(args.start) },
            end: { dateTime: str(args.end || args.start) },
          },
        });
        return { ok: true, id: e.data.id, htmlLink: e.data.htmlLink, message: 'Evento creado.' };
      }
      case 'calendar_delete_event': {
        const cal = google.calendar({ version: 'v3', auth });
        await cal.events.delete({ calendarId: 'primary', eventId: str(args.eventId) });
        return { ok: true, message: 'Evento eliminado.' };
      }
      case 'drive_search': {
        const drive = google.drive({ version: 'v3', auth });
        const q = args.query ? `name contains '${str(args.query).replace(/'/g, "\\'")}' and trashed=false` : 'trashed=false';
        const r = await drive.files.list({ q, pageSize: num(args.max, 10), fields: 'files(id,name,mimeType,modifiedTime,webViewLink)', orderBy: 'modifiedTime desc' });
        return { ok: true, count: (r.data.files ?? []).length, files: r.data.files ?? [] };
      }
      case 'drive_read_file': {
        const drive = google.drive({ version: 'v3', auth });
        const fileId = str(args.fileId);
        const meta = await drive.files.get({ fileId, fields: 'id,name,mimeType' });
        const mime = meta.data.mimeType ?? '';
        let content = '';
        if (mime.startsWith('application/vnd.google-apps.')) {
          // Documentos nativos de Google → exportar a texto plano.
          const exp = await drive.files.export({ fileId, mimeType: 'text/plain' }, { responseType: 'text' });
          content = String(exp.data);
        } else if (mime.startsWith('text/') || mime === 'application/json') {
          const dl = await drive.files.get({ fileId, alt: 'media' }, { responseType: 'text' });
          content = String(dl.data);
        } else {
          return { ok: true, name: meta.data.name, mimeType: mime, body: `(archivo binario ${mime}, no se puede leer como texto)` };
        }
        return { ok: true, name: meta.data.name, mimeType: mime, body: content.slice(0, 8000) };
      }
      case 'drive_create_file': {
        const drive = google.drive({ version: 'v3', auth });
        const f = await drive.files.create({
          requestBody: { name: str(args.name) || 'nuevo-archivo.txt' },
          media: { mimeType: str(args.mimeType) || 'text/plain', body: str(args.content) },
          fields: 'id,name,webViewLink',
        });
        return { ok: true, id: f.data.id, webViewLink: f.data.webViewLink, message: 'Archivo creado.' };
      }
      case 'drive_delete_file': {
        const drive = google.drive({ version: 'v3', auth });
        await drive.files.delete({ fileId: str(args.fileId) });
        return { ok: true, message: 'Archivo eliminado.' };
      }
      default:
        return { ok: false, error: `Herramienta no implementada: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: `Fallo en ${name}: ${(e as Error).message}` };
  }
}
