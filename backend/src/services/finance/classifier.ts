/**
 * Clasificador financiero — extrae una transacción estructurada de texto libre
 * (correo bancario, tirilla OCR, nota manual) usando IA del tier del usuario.
 *
 * Pipeline:
 *   1. Heurística antifraude/antispam barata ANTES de la IA (descarta publicidad
 *      obvia, valida remitente plausible). Si es spam claro → no se llama a la IA.
 *   2. TokenGuard.redact() sobre el texto: NUNCA se envía PII bancaria cruda
 *      (tarjetas, cédulas, teléfonos, emails) al modelo. La IA ve placeholders.
 *   3. OpencodeAdapter (modelo del tier vía pickAdapter) con prompt en español
 *      que devuelve JSON estricto {tipo, monto, currency, comercio_origen,
 *      categoria, fecha_hora, legitimo, confidence}.
 *   4. Parseo tolerante (extrae el primer bloque JSON), validación + normalización
 *      (monto decimal, fecha ISO, enums). confidence baja o parseo fallido →
 *      legitimo=false / requiere revisión humana (igual se crea Borrador).
 *
 * El resultado SIEMPRE va a un Borrador para aprobación humana (Human-in-the-Loop);
 * legitimo/confidence sólo informan a la UI, no autoaprueban nada.
 */
import { pickAdapter } from '../ai/agentRunner.js';
import { redact } from '../tokenGuard.js';
import { AdapterError, type ChatMessage } from '../ai/types.js';

export type TxTipo = 'Egreso' | 'Ingreso' | 'Inversion' | 'Deuda';
const TIPOS: TxTipo[] = ['Egreso', 'Ingreso', 'Inversion', 'Deuda'];

export interface SourceMeta {
  /** Canal de origen: condiciona heurísticas (Gmail valida remitente). */
  canal: 'Gmail' | 'OCR' | 'Manual' | 'Sync';
  from?: string;
  subject?: string;
  /** Fecha del correo/comprobante si la conocemos (ISO o parseable). */
  receivedAt?: string;
}

export interface Classification {
  tipo: TxTipo;
  monto: number;
  currency: string;
  comercioOrigen: string | null;
  categoria: string | null;
  /** ISO 8601 (UTC) o null si no se pudo determinar. */
  fechaHora: string | null;
  legitimo: boolean;
  confidence: number; // 0..100
  /** Motivo legible cuando legitimo=false o confianza baja (debug/UI admin). */
  reason?: string;
  /** Si el texto se redactó (TokenGuard tocó algo). */
  redacted: boolean;
  /** Modelo/adaptador usado (telemetría; null si fue heurístico puro). */
  model?: string | null;
}

/** Umbral por debajo del cual marcamos el borrador como "requiere revisión". */
export const LOW_CONFIDENCE = 60;

/**
 * Patrones de publicidad/transaccional. Marketing obvio NO genera transacción.
 * Conservador: ante la duda, deja pasar a la IA (que puede marcar legitimo=false).
 */
const SPAM_HINTS = [
  /\bdescuento[s]?\b/i,
  /\bpromoci[oó]n(es)?\b/i,
  /\bofertas?\b/i,
  /\bnewsletter\b/i,
  /\bsuscr[ií]bete\b/i,
  /\bgana( |r)\b/i,
  /\bcup[oó]n\b/i,
  /\bunsubscribe\b/i,
  /\bdarse de baja\b/i,
];
/** Señales fuertes de transacción real: si están, ignoramos hints de spam. */
const TX_HINTS = [
  /\bcompra\b/i,
  /\bpago\b/i,
  /\btransferencia\b/i,
  /\bdébito|debito\b/i,
  /\bcr[eé]dito\b/i,
  /\bretiro\b/i,
  /\bconsignaci[oó]n\b/i,
  /\baprobad[ao]\b/i,
  /\bcomprobante\b/i,
  /\bfactura\b/i,
  /\bmovimiento\b/i,
  /\$\s?\d/,
];

interface SpamVerdict {
  isSpam: boolean;
  reason?: string;
}

/** Heurística barata previa a la IA. */
export function looksLikeSpam(text: string, meta: SourceMeta): SpamVerdict {
  if (!text || text.trim().length < 4) {
    return { isSpam: true, reason: 'Texto vacío o demasiado corto.' };
  }
  // Manual: el humano lo escribió, jamás es spam.
  if (meta.canal === 'Manual') return { isSpam: false };

  const hasTx = TX_HINTS.some((r) => r.test(text));
  if (hasTx) return { isSpam: false };

  const spamHit = SPAM_HINTS.some((r) => r.test(text)) || (meta.subject ? SPAM_HINTS.some((r) => r.test(meta.subject!)) : false);
  if (spamHit) {
    return { isSpam: true, reason: 'Parece publicidad/marketing sin señales de transacción.' };
  }
  return { isSpam: false };
}

/**
 * Remitente plausible para un correo bancario/comercio. No bloquea (la IA decide
 * legitimo); sólo baja la confianza si el dominio parece personal/genérico.
 */
function senderPlausibility(from?: string): { plausible: boolean; reason?: string } {
  if (!from) return { plausible: true };
  const lower = from.toLowerCase();
  const personalDomains = ['gmail.com', 'hotmail.com', 'outlook.com', 'yahoo.com', 'icloud.com'];
  const m = lower.match(/@([a-z0-9.-]+)/);
  const domain = m?.[1];
  if (domain && personalDomains.includes(domain)) {
    return { plausible: false, reason: `Remitente desde dominio personal (${domain}), no banco/comercio.` };
  }
  return { plausible: true };
}

const SYSTEM_PROMPT = `Eres un extractor de transacciones financieras para Colombia (COP por defecto).
Recibes el texto de un correo bancario, una tirilla/recibo OCR o una nota.
Algunos datos sensibles vienen reemplazados por marcadores como <CARD_1>, <EMAIL_1>; ignóralos, no son montos.
Devuelve EXCLUSIVAMENTE un objeto JSON (sin texto antes ni después, sin markdown) con esta forma exacta:
{
  "tipo": "Egreso" | "Ingreso" | "Inversion" | "Deuda",
  "monto": number,                // valor positivo, sin separadores de miles ni símbolo
  "currency": "COP" | "USD" | ...,// ISO; COP si no se indica
  "comercio_origen": string | null,// nombre del comercio/contraparte
  "categoria": string | null,     // p.ej. Alimentación, Transporte, Servicios, Suscripciones, Salud, Ingresos, Otros
  "fecha_hora": string | null,    // ISO 8601 si aparece, si no null
  "legitimo": boolean,            // false si parece publicidad, phishing o no es una transacción
  "confidence": number            // 0 a 100, qué tan seguro estás de la extracción
}
Reglas:
- Egreso: compras, pagos, débitos. Ingreso: nómina, transferencias recibidas, consignaciones. Deuda: pago/cuota de crédito/tarjeta/préstamo. Inversion: aportes a inversión/ahorro programado.
- Si no logras hallar un monto numérico claro, pon monto 0, legitimo false y confidence bajo.
- monto SIEMPRE positivo (el signo lo da el tipo).
- No inventes comercio ni categoría; usa null si no hay evidencia.`;

/** Extrae el primer objeto JSON balanceado del texto del modelo. */
function extractJson(text: string): unknown | null {
  const start = text.indexOf('{');
  if (start < 0) return null;
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < text.length; i++) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') inStr = true;
    else if (ch === '{') depth++;
    else if (ch === '}') {
      depth--;
      if (depth === 0) {
        try {
          return JSON.parse(text.slice(start, i + 1));
        } catch {
          return null;
        }
      }
    }
  }
  return null;
}

/** Normaliza un monto que puede venir como número o string "38.500" / "1,234.56". */
function normalizeMonto(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) return Math.abs(raw);
  if (typeof raw === 'string') {
    let s = raw.replace(/[^\d.,-]/g, '').trim();
    if (!s) return 0;
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    // Si la coma está más a la derecha que el punto → coma decimal (es-CO/EU).
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      // Punto decimal (en-US) o sólo separadores de miles con coma.
      s = s.replace(/,/g, '');
    }
    const n = Number(s);
    return Number.isFinite(n) ? Math.abs(n) : 0;
  }
  return 0;
}

function normalizeFecha(raw: unknown, fallback?: string): string | null {
  const candidate = typeof raw === 'string' && raw.trim() ? raw : fallback;
  if (!candidate) return null;
  const d = new Date(candidate);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function normalizeTipo(raw: unknown): TxTipo {
  if (typeof raw === 'string') {
    const found = TIPOS.find((t) => t.toLowerCase() === raw.trim().toLowerCase());
    if (found) return found;
  }
  return 'Egreso';
}

function clampConfidence(raw: unknown): number {
  const n = typeof raw === 'number' ? raw : Number(raw);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

/**
 * Clasifica un texto en una transacción estructurada.
 *
 * @param text  texto crudo (se redacta antes de la IA).
 * @param meta  canal + metadata del origen.
 * @param tier  tier del usuario (selecciona el modelo).
 */
export async function classifyTransaction(
  text: string,
  meta: SourceMeta,
  tier: string
): Promise<Classification> {
  const spam = looksLikeSpam(text, meta);
  if (spam.isSpam) {
    return {
      tipo: 'Egreso',
      monto: 0,
      currency: 'COP',
      comercioOrigen: null,
      categoria: null,
      fechaHora: meta.receivedAt ? normalizeFecha(meta.receivedAt) : null,
      legitimo: false,
      confidence: 0,
      reason: spam.reason,
      redacted: false,
      model: null,
    };
  }

  // 2. Redacción PII ANTES de la IA.
  const { redacted, map } = redact(text);
  const wasRedacted = Object.keys(map).length > 0;

  // 3. IA del tier.
  const { adapter, model } = await pickAdapter(tier, { requestedAdapter: 'opencode' });
  const messages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content:
        `Canal: ${meta.canal}\n` +
        (meta.from ? `Remitente: ${meta.from}\n` : '') +
        (meta.subject ? `Asunto: ${meta.subject}\n` : '') +
        `\nTexto:\n${redacted}`,
    },
  ];

  let parsed: Record<string, unknown> | null = null;
  let modelUsed: string | null = model;
  try {
    const res = await adapter.chat(messages, { model, temperature: 0.1, maxTokens: 400 });
    parsed = extractJson(res.text) as Record<string, unknown> | null;
    modelUsed = res.model;
  } catch (err) {
    // Falla de IA/red: NO se pierde el movimiento; se crea Borrador para revisión.
    const detail = err instanceof AdapterError ? err.message : (err as Error).message;
    return {
      tipo: 'Egreso',
      monto: 0,
      currency: 'COP',
      comercioOrigen: meta.subject ?? null,
      categoria: null,
      fechaHora: meta.receivedAt ? normalizeFecha(meta.receivedAt) : null,
      legitimo: false,
      confidence: 0,
      reason: `Clasificación IA no disponible: ${detail}`,
      redacted: wasRedacted,
      model: modelUsed,
    };
  }

  if (!parsed) {
    return {
      tipo: 'Egreso',
      monto: 0,
      currency: 'COP',
      comercioOrigen: meta.subject ?? null,
      categoria: null,
      fechaHora: meta.receivedAt ? normalizeFecha(meta.receivedAt) : null,
      legitimo: false,
      confidence: 0,
      reason: 'La IA no devolvió un JSON parseable.',
      redacted: wasRedacted,
      model: modelUsed,
    };
  }

  const monto = normalizeMonto(parsed.monto);
  let confidence = clampConfidence(parsed.confidence);
  let legitimo = parsed.legitimo !== false;
  const reasons: string[] = [];

  // Ajustes antifraude posteriores.
  const sender = senderPlausibility(meta.from);
  if (!sender.plausible) {
    confidence = Math.min(confidence, 55);
    reasons.push(sender.reason!);
  }
  if (monto <= 0) {
    legitimo = false;
    confidence = Math.min(confidence, 20);
    reasons.push('Sin monto numérico detectable.');
  }
  if (confidence < LOW_CONFIDENCE) {
    legitimo = false; // marca para revisión, no autoaprobable
    if (!reasons.length) reasons.push('Confianza por debajo del umbral.');
  }

  return {
    tipo: normalizeTipo(parsed.tipo),
    monto,
    currency: (typeof parsed.currency === 'string' && parsed.currency.trim()) || 'COP',
    comercioOrigen:
      typeof parsed.comercio_origen === 'string' && parsed.comercio_origen.trim()
        ? parsed.comercio_origen.trim()
        : null,
    categoria:
      typeof parsed.categoria === 'string' && parsed.categoria.trim() ? parsed.categoria.trim() : null,
    fechaHora: normalizeFecha(parsed.fecha_hora, meta.receivedAt),
    legitimo,
    confidence,
    reason: reasons.length ? reasons.join(' ') : undefined,
    redacted: wasRedacted,
    model: modelUsed,
  };
}
