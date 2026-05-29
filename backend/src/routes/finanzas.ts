/**
 * Rutas del Motor Financiero (/api/finanzas, autenticadas + scoped).
 *
 *   GET  /summary?period=YYYY-MM        → balance, top categorías, semanal, próximos.
 *   GET  /transactions?estado&tipo&...   → lista filtrada del tenant.
 *   GET  /transactions/:id               → detalle + evidencia.
 *   POST /transactions                   → crear movimiento manual (Confirmado).
 *   POST /transactions/:id/approve       → Borrador → Confirmado.
 *   POST /transactions/:id/reject        → Borrador → Rechazado.
 *   POST /ingest/email                   → pegar correo bancario → clasifica → Borrador.
 *   POST /upload/receipt                 → subir factura (OCR best-effort) → Borrador.
 *
 * Todo Human-in-the-Loop: ingest/OCR crean Borradores; la aprobación humana es
 * la que mueve el balance.
 */
import { Router, type Request, type Response } from 'express';
import multer from 'multer';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  summary,
  listTransactions,
  getTransaction,
  createManual,
  approve,
  reject,
  FinanceError,
  type ListFilters,
} from '../services/finance/service.js';
import { ingestEmail } from '../services/finance/ingest.js';
import { runOcr } from '../services/finance/ocrClient.js';
import { classifyTransaction } from '../services/finance/classifier.js';
import { createDraft } from '../services/finance/service.js';
import { logUsage } from '../services/usageLog.js';
import type { Transaction, TransactionEmailEvidence } from '../db/schema.js';

export const finanzasRouter = Router();
finanzasRouter.use(authJwt, tenantContext);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
});

// Vista pública de una transacción (números como number para la UI).
function txView(t: Transaction) {
  return {
    id: t.id,
    tipo: t.tipo,
    monto: Number(t.monto),
    currency: t.currency,
    categoria: t.categoria,
    comercioOrigen: t.comercioOrigen,
    fechaHora: t.fechaHora ? new Date(t.fechaHora).toISOString() : null,
    canal: t.canalOrigen,
    estado: t.estado,
    legitimo: t.legitimo,
    confidence: t.confidence,
    evidenceId: t.evidenceId,
    recurrence: t.recurrence,
    note: t.note,
    createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : null,
    confirmedAt: t.confirmedAt ? new Date(t.confirmedAt).toISOString() : null,
    rejectedAt: t.rejectedAt ? new Date(t.rejectedAt).toISOString() : null,
  };
}

function evidenceView(e: TransactionEmailEvidence | null) {
  if (!e) return null;
  return {
    id: e.id,
    gmailMsgId: e.gmailMsgId,
    subject: e.subject,
    fromAddr: e.fromAddr,
    receivedAt: e.receivedAt ? new Date(e.receivedAt).toISOString() : null,
    rawExcerpt: e.rawExcerpt, // YA redactado en persistencia
    classification: e.classification,
  };
}

function param(req: Request, name: string): string {
  const p = req.params[name];
  return Array.isArray(p) ? (p[0] ?? '') : (p ?? '');
}

// ── GET /summary ─────────────────────────────────────────────────────────────
finanzasRouter.get('/summary', async (req: Request, res: Response) => {
  const period = typeof req.query.period === 'string' ? req.query.period : undefined;
  const data = await summary(req.tenant!.userId, period);
  res.json(data);
});

// ── GET /transactions ────────────────────────────────────────────────────────
finanzasRouter.get('/transactions', async (req: Request, res: Response) => {
  const q = req.query;
  const filters: ListFilters = {
    estado: typeof q.estado === 'string' ? q.estado : undefined,
    tipo: typeof q.tipo === 'string' ? q.tipo : undefined,
    canal: typeof q.canal === 'string' ? q.canal : undefined,
    from: typeof q.from === 'string' ? q.from : undefined,
    to: typeof q.to === 'string' ? q.to : undefined,
    limit: typeof q.limit === 'string' ? Number(q.limit) : undefined,
  };
  const rows = await listTransactions(req.tenant!.userId, filters);
  res.json({ transactions: rows.map(txView) });
});

// ── GET /transactions/:id ────────────────────────────────────────────────────
finanzasRouter.get('/transactions/:id', async (req: Request, res: Response) => {
  const found = await getTransaction(req.tenant!.userId, param(req, 'id'));
  if (!found) {
    res.status(404).json({ error: 'Transacción no encontrada.' });
    return;
  }
  res.json({ transaction: txView(found.transaction), evidence: evidenceView(found.evidence) });
});

// ── POST /transactions (manual) ──────────────────────────────────────────────
finanzasRouter.post('/transactions', async (req: Request, res: Response) => {
  try {
    const tx = await createManual(req.tenant!.userId, req.body ?? {});
    res.status(201).json({ transaction: txView(tx) });
  } catch (err) {
    if (err instanceof FinanceError) {
      res.status(err.code === 'invalid' ? 400 : 409).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// ── POST /transactions/:id/approve ───────────────────────────────────────────
finanzasRouter.post('/transactions/:id/approve', async (req: Request, res: Response) => {
  try {
    const tx = await approve(req.tenant!.userId, param(req, 'id'));
    res.json({ transaction: txView(tx) });
  } catch (err) {
    if (err instanceof FinanceError && err.code === 'not_found') {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// ── POST /transactions/:id/reject ────────────────────────────────────────────
finanzasRouter.post('/transactions/:id/reject', async (req: Request, res: Response) => {
  try {
    const tx = await reject(req.tenant!.userId, param(req, 'id'));
    res.json({ transaction: txView(tx) });
  } catch (err) {
    if (err instanceof FinanceError && err.code === 'not_found') {
      res.status(404).json({ error: err.message });
      return;
    }
    throw err;
  }
});

// ── POST /ingest/email ───────────────────────────────────────────────────────
// Pegar el texto de un correo bancario → clasifica → Borrador. Permite demostrar
// TODO el flujo sin Gmail OAuth.
finanzasRouter.post('/ingest/email', async (req: Request, res: Response) => {
  const body = req.body ?? {};
  const rawText = typeof body.rawText === 'string' ? body.rawText : '';
  if (!rawText.trim()) {
    res.status(400).json({ error: 'Falta rawText (el texto del correo).' });
    return;
  }
  const result = await ingestEmail(req.tenant!.userId, req.tenant!.tier, {
    rawText,
    from: typeof body.from === 'string' ? body.from : undefined,
    subject: typeof body.subject === 'string' ? body.subject : undefined,
    receivedAt: typeof body.receivedAt === 'string' ? body.receivedAt : undefined,
    gmailMsgId: typeof body.gmailMsgId === 'string' ? body.gmailMsgId : undefined,
    canal: 'Gmail',
    orgId: req.tenant!.orgId,
  });
  res.status(result.draft ? 201 : 200).json({
    draft: result.draft ? txView(result.draft) : null,
    classification: result.classification,
    evidenceId: result.evidenceId,
    duplicate: result.duplicate,
    message: result.message,
  });
});

// ── POST /upload/receipt ─────────────────────────────────────────────────────
// OCR best-effort: si el worker responde, clasifica → Borrador (canal OCR). Si
// no está disponible, mensaje claro. El core NO depende de esto.
finanzasRouter.post('/upload/receipt', upload.single('file'), async (req: Request, res: Response) => {
  if (!req.file) {
    res.status(400).json({ error: 'Falta el archivo (campo multipart "file").' });
    return;
  }
  const ocr = await runOcr({
    buffer: req.file.buffer,
    mimetype: req.file.mimetype,
    originalname: req.file.originalname,
  });

  if (!ocr.ok) {
    // 200 con flag ocrAvailable=false: la UI muestra "sube el texto manualmente".
    res.status(200).json({
      draft: null,
      ocrAvailable: false,
      message:
        ocr.status === 'not_installed'
          ? 'El OCR no está disponible en el servidor todavía. Sube el texto manualmente por ahora.'
          : 'No se pudo leer la imagen automáticamente. Sube el texto manualmente por ahora.',
      reason: ocr.reason,
    });
    return;
  }
  if (!ocr.text) {
    res.status(200).json({
      draft: null,
      ocrAvailable: true,
      message: 'No se extrajo texto legible de la imagen. Sube el texto manualmente.',
    });
    return;
  }

  const classification = await classifyTransaction(
    ocr.text,
    { canal: 'OCR', subject: req.file.originalname },
    req.tenant!.tier
  );
  if (classification.model) {
    void logUsage({ userId: req.tenant!.userId, orgId: req.tenant!.orgId, kind: 'classify', model: classification.model });
  }
  if (classification.monto <= 0 && !classification.legitimo) {
    res.status(200).json({
      draft: null,
      ocrAvailable: true,
      classification,
      message: classification.reason ?? 'No se detectó una transacción en la imagen.',
    });
    return;
  }
  const draft = await createDraft(req.tenant!.userId, { classification, canal: 'OCR' });
  res.status(201).json({ draft: txView(draft), ocrAvailable: true, classification });
});
