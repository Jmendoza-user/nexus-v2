/**
 * Cliente del OCR worker (best-effort). Llama al FastAPI workers-py/ocr.
 *
 * El core de finanzas NO depende de esto: si el worker no responde o devuelve
 * 501 (OCR no disponible), el caller degrada pidiendo texto manual. Sin
 * OCR_WORKER_URL configurada, se considera no disponible (no se intenta).
 */
export interface OcrResult {
  ok: boolean;
  text?: string;
  /** 'unavailable' = worker caído/sin configurar; '501' = OCR no instalado. */
  status: 'ok' | 'unavailable' | 'not_installed' | 'error';
  reason?: string;
}

const OCR_TIMEOUT_MS = 20_000;

function workerUrl(): string | null {
  const u = process.env.OCR_WORKER_URL?.trim();
  return u && u.length > 0 ? u : null;
}

/** Envía un archivo (imagen/PDF) al worker OCR. Tolerante a fallos. */
export async function runOcr(file: { buffer: Buffer; mimetype?: string; originalname?: string }): Promise<OcrResult> {
  const url = workerUrl();
  if (!url) {
    return { ok: false, status: 'unavailable', reason: 'OCR_WORKER_URL no configurada.' };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OCR_TIMEOUT_MS);
  try {
    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: file.mimetype || 'application/octet-stream' });
    form.append('file', blob, file.originalname || 'receipt');
    const res = await fetch(url, { method: 'POST', body: form, signal: controller.signal });

    if (res.status === 501) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, status: 'not_installed', reason: (body as { reason?: string }).reason };
    }
    if (!res.ok) {
      return { ok: false, status: 'error', reason: `OCR worker HTTP ${res.status}` };
    }
    const data = (await res.json()) as { text?: string };
    return { ok: true, status: 'ok', text: (data.text ?? '').trim() };
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      return { ok: false, status: 'unavailable', reason: 'OCR worker timeout.' };
    }
    return { ok: false, status: 'unavailable', reason: `OCR worker inalcanzable: ${(err as Error).message}` };
  } finally {
    clearTimeout(timer);
  }
}
