/**
 * vaultIndexer.ts — indexación y búsqueda semántica (RAG) del vault por usuario.
 *
 * AISLAMIENTO ESTRICTO (crítico):
 *   - Las rutas de notas son SIEMPRE relativas al vault del usuario y se validan
 *     con assertWithinUserEnv() (anti path-traversal) antes de tocar el FS.
 *   - Toda operación SQL sobre vault_chunks filtra por user_id. ragQuery() NUNCA
 *     ve chunks de otro tenant. Hay test anti-fuga dedicado.
 *
 * CHUNKING:
 *   Trocea el markdown respetando headings (#..######) y luego empaqueta por
 *   tamaño objetivo (~500-800 "tokens" aproximados por longitud de caracteres,
 *   ratio ~4 chars/token) con solapamiento. Heurístico, suficiente para BGE-m3.
 *
 * UPSERT por nota:
 *   indexNote borra los chunks viejos de esa nota (user_id, note_path) y reinserta
 *   los nuevos → idempotente y consistente ante ediciones.
 *
 * TODO-DEUDA(vault-reindex-incremental): reindexar solo notas con mtime > último
 *   indexado (hoy reindexAll reprocesa todo). Requiere columna source_mtime.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { vaultChunks } from '../db/schema.js';
import { resolveUserPaths, assertWithinUserEnv, type UserPaths } from './userEnv.js';
import { embed, embedOne } from './embeddings.js';

// Chunking (aprox: 1 token ~ 4 chars en español).
const CHARS_PER_TOKEN = 4;
const TARGET_TOKENS = 650; // objetivo medio entre 500-800
const MAX_TOKENS = 800;
const OVERLAP_TOKENS = 80;
const TARGET_CHARS = TARGET_TOKENS * CHARS_PER_TOKEN;
const MAX_CHARS = MAX_TOKENS * CHARS_PER_TOKEN;
const OVERLAP_CHARS = OVERLAP_TOKENS * CHARS_PER_TOKEN;

export interface RagHit {
  notePath: string;
  chunk: string;
  score: number; // 0..1, mayor = más relevante (1 - distancia coseno)
}

export interface IndexNoteResult {
  notePath: string;
  chunks: number;
}

export interface ReindexResult {
  notes: number;
  chunks: number;
  skipped: number;
  errors: Array<{ notePath: string; error: string }>;
}

/** Resuelve las rutas del usuario o lanza si su env no está provisionado. */
async function paths(userId: string): Promise<UserPaths> {
  const p = await resolveUserPaths(userId);
  if (!p) throw new Error(`El usuario ${userId} no tiene entorno de vault provisionado.`);
  return p;
}

/** Normaliza una ruta de nota a relativa-segura dentro de vault/. Lanza si escapa. */
function safeVaultAbs(p: UserPaths, notePath: string): string {
  // assertWithinUserEnv valida contra el root del env; anclamos en vault/.
  const rel = notePath.replace(/^\/+/, '');
  const target = path.join('vault', rel);
  const abs = assertWithinUserEnv(p, target); // lanza PathTraversalError si escapa
  // Defensa extra: debe quedar dentro de vault/ concretamente.
  const vaultWithSep = p.vault.endsWith(path.sep) ? p.vault : p.vault + path.sep;
  if (abs !== p.vault && !abs.startsWith(vaultWithSep)) {
    throw new Error(`Ruta fuera del vault: ${notePath}`);
  }
  return abs;
}

// ── Chunking markdown-aware ──────────────────────────────────────────────────

interface Section {
  heading: string; // cadena de headings acumulada (breadcrumb) para contexto
  text: string;
}

/** Parte el markdown en secciones por headings, conservando el breadcrumb. */
function splitByHeadings(md: string): Section[] {
  const lines = md.split('\n');
  const sections: Section[] = [];
  const headingStack: { level: number; text: string }[] = [];
  let buf: string[] = [];

  const breadcrumb = () => headingStack.map((h) => h.text).join(' › ');

  const flush = () => {
    const text = buf.join('\n').trim();
    if (text) sections.push({ heading: breadcrumb(), text });
    buf = [];
  };

  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line);
    if (m) {
      flush();
      const level = m[1]!.length;
      const title = m[2]!.trim();
      while (headingStack.length && headingStack[headingStack.length - 1]!.level >= level) {
        headingStack.pop();
      }
      headingStack.push({ level, text: title });
    } else {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

/** Empaqueta el texto de una sección en trozos por tamaño con solapamiento. */
function packText(text: string): string[] {
  if (text.length <= MAX_CHARS) return [text];
  const out: string[] = [];
  // Trocea por párrafos y acumula hasta TARGET_CHARS; si un párrafo es enorme,
  // lo corta por ventanas con solapamiento.
  const paras = text.split(/\n{2,}/);
  let cur = '';
  const pushCur = () => {
    const t = cur.trim();
    if (t) out.push(t);
    cur = '';
  };
  for (const para of paras) {
    if (para.length > MAX_CHARS) {
      pushCur();
      for (let i = 0; i < para.length; i += MAX_CHARS - OVERLAP_CHARS) {
        out.push(para.slice(i, i + MAX_CHARS).trim());
      }
      continue;
    }
    if ((cur + '\n\n' + para).length > TARGET_CHARS && cur) {
      pushCur();
    }
    cur = cur ? cur + '\n\n' + para : para;
  }
  pushCur();
  return out.filter((c) => c.length > 0);
}

/**
 * Convierte el contenido de una nota en chunks de texto listos para embeber.
 * Prefija cada chunk con el breadcrumb de headings para dar contexto al modelo.
 */
export function chunkMarkdown(notePath: string, content: string): string[] {
  const title = path.basename(notePath).replace(/\.md$/i, '');
  const sections = splitByHeadings(content);
  const chunks: string[] = [];
  for (const sec of sections) {
    for (const piece of packText(sec.text)) {
      const ctx = sec.heading ? `${title} › ${sec.heading}` : title;
      chunks.push(`# ${ctx}\n\n${piece}`);
    }
  }
  // Nota sin contenido útil → al menos un chunk con el título (evita huecos).
  if (chunks.length === 0 && content.trim()) chunks.push(`# ${title}\n\n${content.trim()}`);
  return chunks;
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Indexa una nota: lee el .md (validando traversal), trocea, embebe y hace
 * upsert (borra chunks viejos de esa nota y reinserta). Idempotente.
 */
export async function indexNote(userId: string, notePath: string): Promise<IndexNoteResult> {
  const p = await paths(userId);
  const abs = safeVaultAbs(p, notePath);
  const rel = path.relative(p.vault, abs);

  const content = await fs.readFile(abs, 'utf8');
  const chunks = chunkMarkdown(rel, content);

  if (chunks.length === 0) {
    // Nota vacía: borra cualquier chunk previo y sale.
    await db.delete(vaultChunks).where(and(eq(vaultChunks.userId, userId), eq(vaultChunks.notePath, rel)));
    return { notePath: rel, chunks: 0 };
  }

  const vectors = await embed(chunks);
  const stat = await fs.stat(abs).catch(() => null);

  await db.transaction(async (tx) => {
    await tx.delete(vaultChunks).where(and(eq(vaultChunks.userId, userId), eq(vaultChunks.notePath, rel)));
    await tx.insert(vaultChunks).values(
      chunks.map((c, i) => ({
        userId,
        notePath: rel,
        chunkIdx: i,
        content: c,
        embedding: vectors[i]!,
        metadata: { mtime: stat?.mtimeMs ?? null } as Record<string, unknown>,
      }))
    );
  });

  return { notePath: rel, chunks: chunks.length };
}

/** Borra todos los chunks de una nota (p.ej. al eliminar el archivo). */
export async function removeNote(userId: string, notePath: string): Promise<void> {
  const p = await paths(userId);
  const abs = safeVaultAbs(p, notePath);
  const rel = path.relative(p.vault, abs);
  await db.delete(vaultChunks).where(and(eq(vaultChunks.userId, userId), eq(vaultChunks.notePath, rel)));
}

/** Recorre recursivamente el vault del usuario y devuelve rutas .md relativas. */
async function listMarkdown(vaultDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue; // ignora ocultos (.gitkeep, .obsidian, etc.)
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
        out.push(path.relative(vaultDir, full));
      }
    }
  }
  await walk(vaultDir);
  return out;
}

/**
 * Reindexa TODO el vault del usuario. Idempotente. Reporta progreso.
 * Continúa ante errores puntuales por nota (los acumula en `errors`).
 */
export async function reindexAll(
  userId: string,
  opts: { onProgress?: (done: number, total: number, notePath: string) => void } = {}
): Promise<ReindexResult> {
  const p = await paths(userId);
  const notes = await listMarkdown(p.vault);
  let chunks = 0;
  let skipped = 0;
  const errors: Array<{ notePath: string; error: string }> = [];

  for (let i = 0; i < notes.length; i++) {
    const notePath = notes[i]!;
    try {
      const r = await indexNote(userId, notePath);
      chunks += r.chunks;
      if (r.chunks === 0) skipped++;
    } catch (err) {
      errors.push({ notePath, error: (err as Error).message });
    }
    opts.onProgress?.(i + 1, notes.length, notePath);
  }

  return { notes: notes.length, chunks, skipped, errors };
}

/**
 * RAG: embebe la query y busca los top-k chunks por similitud coseno DENTRO del
 * user_id dado (aislamiento estricto). Devuelve [{notePath, chunk, score}].
 *
 * score = 1 - distancia_coseno (operador `<=>` de pgvector). Mayor = más cerca.
 */
export async function ragQuery(userId: string, query: string, k = 6): Promise<RagHit[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];
  const qv = await embedOne(trimmed);
  const literal = `[${qv.join(',')}]`;

  const rows = await db.execute<{ note_path: string; content: string; score: number }>(sql`
    SELECT note_path, content, 1 - (embedding <=> ${literal}::vector) AS score
    FROM vault_chunks
    WHERE user_id = ${userId}
    ORDER BY embedding <=> ${literal}::vector
    LIMIT ${k}
  `);

  const data = (rows as unknown as { rows: { note_path: string; content: string; score: number }[] }).rows;
  return data.map((r) => ({ notePath: r.note_path, chunk: r.content, score: Number(r.score) }));
}
