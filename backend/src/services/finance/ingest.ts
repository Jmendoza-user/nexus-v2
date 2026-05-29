/**
 * Ingesta de transacciones desde texto (correo bancario pegado / OCR / sync).
 *
 * Orquesta: clasificar (con TokenGuard) → guardar evidencia redactada
 * (idempotente por gmail_msg_id) → crear Borrador. Es el seam común que usan
 * tanto el endpoint POST /api/finanzas/ingest/email (demo manual) como el cron
 * GmailSync (inactivo). Mantiene el core de finanzas desacoplado de Gmail.
 */
import crypto from 'node:crypto';
import { redact } from '../tokenGuard.js';
import { classifyTransaction, type SourceMeta } from './classifier.js';
import { createDraft, upsertEvidence, evidenceExists } from './service.js';
import type { Transaction } from '../../db/schema.js';

export interface IngestEmailInput {
  rawText: string;
  from?: string;
  subject?: string;
  receivedAt?: string;
  /** Id estable del mensaje (Gmail). Si falta, se deriva un hash del contenido. */
  gmailMsgId?: string;
  canal?: 'Gmail' | 'OCR' | 'Sync';
}

export interface IngestResult {
  /** Borrador creado (null si la clasificación lo descartó como no-transacción). */
  draft: Transaction | null;
  classification: Awaited<ReturnType<typeof classifyTransaction>>;
  evidenceId: string | null;
  /** true si ya existía evidencia para ese gmail_msg_id (no se duplicó). */
  duplicate: boolean;
  /** Mensaje legible cuando no se creó borrador. */
  message?: string;
}

/** Deriva un id estable a partir del contenido cuando no hay gmail_msg_id. */
function deriveMsgId(input: IngestEmailInput): string {
  const h = crypto.createHash('sha256');
  h.update(`${input.from ?? ''}|${input.subject ?? ''}|${input.rawText}`);
  return `paste-${h.digest('hex').slice(0, 24)}`;
}

/**
 * Ingiere un correo/recibo: clasifica, persiste evidencia redactada y crea el
 * Borrador si parece una transacción legítima. Idempotente por gmail_msg_id:
 * re-ingestar el mismo mensaje no crea un segundo borrador.
 */
export async function ingestEmail(userId: string, tier: string, input: IngestEmailInput): Promise<IngestResult> {
  const canal = input.canal ?? 'Gmail';
  const meta: SourceMeta = {
    canal,
    from: input.from,
    subject: input.subject,
    receivedAt: input.receivedAt,
  };
  const msgId = input.gmailMsgId?.trim() || deriveMsgId(input);

  // Idempotencia: si ya procesamos este mensaje, no dupliques.
  const existing = await evidenceExists(userId, msgId);
  if (existing) {
    return {
      draft: null,
      classification: {
        tipo: 'Egreso',
        monto: 0,
        currency: 'COP',
        comercioOrigen: null,
        categoria: null,
        fechaHora: null,
        legitimo: false,
        confidence: 0,
        reason: 'Mensaje ya procesado anteriormente.',
        redacted: false,
        model: null,
      },
      evidenceId: existing.id,
      duplicate: true,
      message: 'Este correo ya fue procesado.',
    };
  }

  const classification = await classifyTransaction(input.rawText, meta, tier);

  // Evidencia: SIEMPRE redactada antes de persistir (no guardar PII cruda).
  const { redacted } = redact(input.rawText);
  const evidence = await upsertEvidence(userId, {
    gmailMsgId: msgId,
    subject: input.subject ?? null,
    fromAddr: input.from ?? null,
    receivedAt: input.receivedAt ?? null,
    rawExcerptRedacted: redacted,
    classification: {
      tipo: classification.tipo,
      monto: classification.monto,
      currency: classification.currency,
      confidence: classification.confidence,
      legitimo: classification.legitimo,
      reason: classification.reason ?? null,
      model: classification.model ?? null,
    },
  });

  // Si la clasificación dice que NO es una transacción (monto 0 + ilegítima por
  // spam/phishing), guardamos evidencia pero no creamos borrador "ruidoso".
  if (classification.monto <= 0 && !classification.legitimo) {
    return {
      draft: null,
      classification,
      evidenceId: evidence.id,
      duplicate: false,
      message: classification.reason ?? 'No se detectó una transacción en el texto.',
    };
  }

  const draft = await createDraft(userId, {
    classification,
    canal,
    evidenceId: evidence.id,
  });

  return { draft, classification, evidenceId: evidence.id, duplicate: false };
}
