/**
 * embeddings.ts — cliente del servicio local BGE-m3 (1024-dim).
 *
 * Contrato real del endpoint (verificado por curl, 2026-05-29):
 *   POST {BGE_LOCAL_URL}   (default http://127.0.0.1:8100/embed)
 *   body: { "input": "texto" }            → un texto
 *      o: { "input": ["t1", "t2", ...] }  → varios textos (batch)
 *   resp: { "data": [ { "embedding": [..1024..] }, ... ],
 *           "model": "BAAI/bge-m3", "dimensions": 1024, "elapsed_ms": N }
 *   El orden de `data` respeta el orden de `input`. La clave `texts`/`inputs`
 *   NO funciona (devuelve data:[]); SOLO `input` es válida.
 *
 * embed(texts) trocea en micro-batches (~32) para no saturar el servicio ni
 * mandar payloads gigantes, y concatena preservando el orden global.
 *
 * Si el servicio está caído o devuelve algo inesperado, lanza EmbeddingError
 * con un mensaje claro (sin reventar el proceso).
 */
import { env } from '../lib/env.js';

export const EMBEDDING_DIM = 1024;
// Configurable por env para throttlear BGE bajo carga (evita OOM en indexado masivo).
const BATCH_SIZE = Number(process.env.BGE_BATCH_SIZE) || 32;
const BATCH_DELAY_MS = Number(process.env.BGE_BATCH_DELAY_MS) || 0;
const TIMEOUT_MS = 60_000;
// Reintentos ante fallos transitorios del servicio BGE (caídas/saturación
// momentánea durante reindexados masivos). Backoff exponencial suave.
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 2_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export class EmbeddingError extends Error {
  constructor(
    message: string,
    public status: number | null = null,
    public detail?: string
  ) {
    super(message);
    this.name = 'EmbeddingError';
  }
}

interface BgeResponse {
  data?: Array<{ embedding?: number[] }>;
  model?: string;
  dimensions?: number;
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const url = env.BGE_LOCAL_URL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ input: texts }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      throw new EmbeddingError(
        `El servicio de embeddings (BGE) respondió HTTP ${res.status}.`,
        res.status,
        detail.slice(0, 400)
      );
    }

    const data = (await res.json()) as BgeResponse;
    const rows = data.data;
    if (!Array.isArray(rows) || rows.length !== texts.length) {
      throw new EmbeddingError(
        `BGE devolvió ${rows?.length ?? 0} embeddings para ${texts.length} textos.`,
        res.status,
        JSON.stringify(data).slice(0, 400)
      );
    }

    return rows.map((r, i) => {
      const v = r.embedding;
      if (!Array.isArray(v) || v.length !== EMBEDDING_DIM) {
        throw new EmbeddingError(
          `BGE devolvió un vector de dimensión ${v?.length ?? 0} (se esperaban ${EMBEDDING_DIM}) en la posición ${i}.`
        );
      }
      return v;
    });
  } catch (err) {
    if (err instanceof EmbeddingError) throw err;
    if ((err as Error)?.name === 'AbortError') {
      throw new EmbeddingError(`El servicio de embeddings (BGE) excedió el timeout (${TIMEOUT_MS} ms).`);
    }
    throw new EmbeddingError(
      `No se pudo contactar el servicio de embeddings en ${url}: ${(err as Error).message}. ` +
        `¿Está corriendo el servicio BGE?`
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** embedBatch con reintentos ante fallos transitorios (timeout/red/5xx). */
async function embedBatchResilient(texts: string[]): Promise<number[][]> {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await embedBatch(texts);
    } catch (err) {
      lastErr = err;
      // No reintentar errores de contrato (dimensión/conteo) — son deterministas.
      const e = err as EmbeddingError;
      const retriable = !(e instanceof EmbeddingError) || e.status === null || (e.status ?? 0) >= 500;
      if (!retriable || attempt === MAX_RETRIES) break;
      const wait = RETRY_BASE_MS * 2 ** attempt;
      console.warn(`[embeddings] intento ${attempt + 1} falló (${(err as Error).message}); reintento en ${wait}ms`);
      await sleep(wait);
    }
  }
  throw lastErr;
}

/**
 * Embebe una lista de textos → matriz de vectores 1024-dim, mismo orden.
 * Micro-batching automático con reintentos. Lista vacía → [].
 */
export async function embed(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const vectors = await embedBatchResilient(batch);
    out.push(...vectors);
    if (BATCH_DELAY_MS > 0 && i + BATCH_SIZE < texts.length) {
      await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
    }
  }
  return out;
}

/** Atajo para un solo texto (p.ej. la query de RAG). */
export async function embedOne(text: string): Promise<number[]> {
  const [v] = await embed([text]);
  if (!v) throw new EmbeddingError('BGE no devolvió embedding para el texto.');
  return v;
}
