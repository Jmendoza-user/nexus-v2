/**
 * vault.ts — API del Vault (segundo cerebro) + RAG, scoped por tenant.
 *
 * Todos los endpoints: authJwt + tenantContext. El acceso a archivos se valida
 * SIEMPRE con assertWithinUserEnv (anti path-traversal) y se ancla en vault/.
 * El RAG y la búsqueda full-text operan SOLO sobre el vault/chunks del user_id
 * del tenant (aislamiento estricto, con test anti-fuga).
 *
 * Endpoints:
 *   GET    /api/vault/tree              → árbol de carpetas/notas (.md)
 *   GET    /api/vault/note?path=...     → contenido + frontmatter + backlinks
 *   PUT    /api/vault/note              → guarda + reindexa (async)
 *   POST   /api/vault/note              → crea (template diaria/concepto/libre) + indexa
 *   DELETE /api/vault/note?path=...     → borra archivo + chunks
 *   POST   /api/vault/search            → full-text simple (ILIKE en memoria sobre .md)
 *   POST   /api/vault/rag/query         → RAG con citas (quotaCheck messages)
 *   POST   /api/vault/reindex           → reindexAll del user
 *
 * TODO-DEUDA(vault-editor-rico): editor TipTap/Lexical en frontend (este hito usa
 *   markdown plano). TODO-DEUDA(vault-search-fts): índice tsvector para full-text
 *   en vez de escaneo ILIKE en memoria.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { quotaCheck, recordUsage } from '../middleware/quota.js';
import { assertWithinUserEnv, type UserPaths } from '../services/userEnv.js';
import { indexNote, removeNote, reindexAll, ragQuery } from '../services/vaultIndexer.js';
import { pickAdapter } from '../services/ai/agentRunner.js';
import { AdapterError, type ChatMessage } from '../services/ai/types.js';

export const vaultRouter = Router();
vaultRouter.use(authJwt, tenantContext);

// ── Helpers de path seguro ───────────────────────────────────────────────────

/** Devuelve los userPaths del tenant o responde 409 si no hay env provisionado. */
function requirePaths(req: Request, res: Response): UserPaths | null {
  const p = req.tenant?.userPaths;
  if (!p) {
    res.status(409).json({ error: 'Tu vault aún no está disponible.' });
    return null;
  }
  return p;
}

/**
 * Resuelve una ruta de nota relativa al vault del usuario, validando traversal y
 * que termine en .md. Lanza (PathTraversalError o Error) si es inválida.
 * Devuelve { abs, rel }.
 */
function resolveNote(p: UserPaths, notePath: string): { abs: string; rel: string } {
  if (typeof notePath !== 'string' || notePath.trim() === '') {
    throw new Error('Ruta de nota vacía.');
  }
  const cleaned = notePath.replace(/^\/+/, '').trim();
  if (!cleaned.toLowerCase().endsWith('.md')) {
    throw new Error('Solo se permiten notas .md.');
  }
  const target = path.join('vault', cleaned);
  const abs = assertWithinUserEnv(p, target); // PathTraversalError si escapa
  const vaultWithSep = p.vault.endsWith(path.sep) ? p.vault : p.vault + path.sep;
  if (!abs.startsWith(vaultWithSep)) {
    throw new Error('Ruta fuera del vault.');
  }
  return { abs, rel: path.relative(p.vault, abs) };
}

// ── Frontmatter + backlinks ──────────────────────────────────────────────────

/**
 * Parser mínimo de frontmatter YAML. Soporta:
 *   - clave: valor (con comillas opcionales)
 *   - clave: [a, b, c]            (lista inline)
 *   - clave:\n  - a\n  - b       (lista multilínea, estilo Obsidian)
 * Sin deps. No es un parser YAML completo (suficiente para notas de vault).
 */
function unquote(s: string): string {
  return s.replace(/^["']|["']$/g, '');
}

function parseFrontmatter(raw: string): { frontmatter: Record<string, unknown>; body: string } {
  const m = /^---\n([\s\S]*?)\n---\n?/.exec(raw);
  if (!m) return { frontmatter: {}, body: raw };
  const fm: Record<string, unknown> = {};
  const lines = m[1]!.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const kv = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1]!;
    const rawVal = kv[2]!.trim();

    // Lista multilínea: clave seguida de líneas "  - item".
    if (rawVal === '') {
      const items: string[] = [];
      while (i + 1 < lines.length && /^\s*-\s+/.test(lines[i + 1]!)) {
        items.push(unquote(lines[++i]!.replace(/^\s*-\s+/, '').trim()));
      }
      fm[key] = items.length ? items : '';
      continue;
    }

    if (rawVal.startsWith('[') && rawVal.endsWith(']')) {
      fm[key] = rawVal
        .slice(1, -1)
        .split(',')
        .map((s) => unquote(s.trim()))
        .filter((s) => s.length > 0);
    } else {
      fm[key] = unquote(rawVal);
    }
  }
  return { frontmatter: fm, body: raw.slice(m[0].length) };
}

/** Extrae los targets de [[wikilinks]] de un texto (sin alias |). */
function extractWikilinks(text: string): string[] {
  const out = new Set<string>();
  const re = /\[\[([^\]]+)\]\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    const target = m[1]!.split('|')[0]!.split('#')[0]!.trim();
    if (target) out.add(target);
  }
  return [...out];
}

/** Lista recursiva de notas .md (rutas relativas), ignorando ocultos. */
async function listMarkdown(vaultDir: string): Promise<string[]> {
  const out: string[] = [];
  async function walk(dir: string): Promise<void> {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const full = path.join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(path.relative(vaultDir, full));
    }
  }
  await walk(vaultDir);
  return out;
}

/**
 * Detecta backlinks: notas del vault cuyo cuerpo enlaza a `targetTitle` (el
 * basename sin extensión) vía [[...]]. Escaneo en memoria; aceptable a esta escala.
 */
async function findBacklinks(vaultDir: string, relPath: string): Promise<string[]> {
  const title = path.basename(relPath).replace(/\.md$/i, '');
  const all = await listMarkdown(vaultDir);
  const hits: string[] = [];
  for (const rel of all) {
    if (rel === relPath) continue;
    try {
      const content = await fs.readFile(path.join(vaultDir, rel), 'utf8');
      const links = extractWikilinks(content);
      if (links.some((l) => l === title || l === relPath.replace(/\.md$/i, ''))) hits.push(rel);
    } catch {
      /* ignora notas ilegibles */
    }
  }
  return hits;
}

// ── Árbol del vault ──────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  path: string; // relativo al vault
  type: 'folder' | 'note';
  size?: number;
  mtime?: number;
  children?: TreeNode[];
}

async function buildTree(vaultDir: string, dir: string): Promise<TreeNode[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const nodes: TreeNode[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(vaultDir, full);
    if (e.isDirectory()) {
      const children = await buildTree(vaultDir, full);
      nodes.push({ name: e.name, path: rel, type: 'folder', children });
    } else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      const st = await fs.stat(full).catch(() => null);
      nodes.push({
        name: e.name.replace(/\.md$/i, ''),
        path: rel,
        type: 'note',
        size: st?.size ?? 0,
        mtime: st?.mtimeMs ?? 0,
      });
    }
  }
  // Carpetas primero, luego notas; alfabético dentro de cada grupo.
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
    return a.name.localeCompare(b.name, 'es');
  });
  return nodes;
}

vaultRouter.get('/tree', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  try {
    const tree = await buildTree(p.vault, p.vault);
    const countNotes = (nodes: TreeNode[]): number =>
      nodes.reduce((acc, n) => acc + (n.type === 'note' ? 1 : countNotes(n.children ?? [])), 0);
    res.json({ tree, totalNotes: countNotes(tree) });
  } catch (err) {
    console.error('[vault] tree error:', err);
    res.status(500).json({ error: 'No se pudo leer el vault.' });
  }
});

// ── Leer nota ────────────────────────────────────────────────────────────────

vaultRouter.get('/note', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const notePath = String(req.query.path ?? '');
  let resolved: { abs: string; rel: string };
  try {
    resolved = resolveNote(p, notePath);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!existsSync(resolved.abs)) {
    res.status(404).json({ error: 'Nota no encontrada.' });
    return;
  }
  try {
    const raw = await fs.readFile(resolved.abs, 'utf8');
    const st = await fs.stat(resolved.abs).catch(() => null);
    const { frontmatter, body } = parseFrontmatter(raw);
    const backlinks = await findBacklinks(p.vault, resolved.rel);
    res.json({
      path: resolved.rel,
      title: path.basename(resolved.rel).replace(/\.md$/i, ''),
      content: raw,
      body,
      frontmatter,
      links: extractWikilinks(body),
      backlinks,
      size: st?.size ?? 0,
      mtime: st?.mtimeMs ?? 0,
    });
  } catch (err) {
    console.error('[vault] note read error:', err);
    res.status(500).json({ error: 'No se pudo leer la nota.' });
  }
});

// ── Guardar nota (editar) ────────────────────────────────────────────────────

const putSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(1_000_000),
});

vaultRouter.put('/note', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const parsed = putSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  let resolved: { abs: string; rel: string };
  try {
    resolved = resolveNote(p, parsed.data.path);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!existsSync(resolved.abs)) {
    res.status(404).json({ error: 'Nota no encontrada. Usa POST para crear.' });
    return;
  }
  try {
    await fs.mkdir(path.dirname(resolved.abs), { recursive: true });
    await fs.writeFile(resolved.abs, parsed.data.content, { mode: 0o640 });
    // Reindex async (no bloquea la respuesta).
    indexNote(req.tenant!.userId, resolved.rel).catch((e) =>
      console.error(`[vault] reindex async falló para ${resolved.rel}:`, (e as Error).message)
    );
    res.json({ ok: true, path: resolved.rel });
  } catch (err) {
    console.error('[vault] note write error:', err);
    res.status(500).json({ error: 'No se pudo guardar la nota.' });
  }
});

// ── Crear nota ───────────────────────────────────────────────────────────────

const postSchema = z.object({
  path: z.string().min(1),
  content: z.string().max(1_000_000).optional(),
  template: z.enum(['diaria', 'concepto', 'libre']).optional(),
});

function templateContent(template: string | undefined, title: string): string {
  const today = new Date().toISOString().slice(0, 10);
  switch (template) {
    case 'diaria':
      return `---\ntipo: diaria\nfecha: ${today}\n---\n\n# ${title}\n\n## Notas del día\n\n`;
    case 'concepto':
      return `---\ntipo: concepto\ntags: []\n---\n\n# ${title}\n\n`;
    default:
      return `# ${title}\n\n`;
  }
}

vaultRouter.post('/note', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Datos inválidos.', issues: parsed.error.flatten().fieldErrors });
    return;
  }
  let resolved: { abs: string; rel: string };
  try {
    resolved = resolveNote(p, parsed.data.path);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (existsSync(resolved.abs)) {
    res.status(409).json({ error: 'Ya existe una nota con esa ruta.' });
    return;
  }
  try {
    const title = path.basename(resolved.rel).replace(/\.md$/i, '');
    const content = parsed.data.content ?? templateContent(parsed.data.template, title);
    await fs.mkdir(path.dirname(resolved.abs), { recursive: true });
    await fs.writeFile(resolved.abs, content, { mode: 0o640 });
    indexNote(req.tenant!.userId, resolved.rel).catch((e) =>
      console.error(`[vault] index async falló para ${resolved.rel}:`, (e as Error).message)
    );
    res.status(201).json({ ok: true, path: resolved.rel, title });
  } catch (err) {
    console.error('[vault] note create error:', err);
    res.status(500).json({ error: 'No se pudo crear la nota.' });
  }
});

// ── Borrar nota ──────────────────────────────────────────────────────────────

vaultRouter.delete('/note', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const notePath = String(req.query.path ?? '');
  let resolved: { abs: string; rel: string };
  try {
    resolved = resolveNote(p, notePath);
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
    return;
  }
  if (!existsSync(resolved.abs)) {
    res.status(404).json({ error: 'Nota no encontrada.' });
    return;
  }
  try {
    await fs.rm(resolved.abs, { force: true });
    await removeNote(req.tenant!.userId, resolved.rel);
    res.json({ ok: true, path: resolved.rel });
  } catch (err) {
    console.error('[vault] note delete error:', err);
    res.status(500).json({ error: 'No se pudo borrar la nota.' });
  }
});

// ── Búsqueda full-text simple ────────────────────────────────────────────────

const searchSchema = z.object({ query: z.string().trim().min(1).max(200) });

vaultRouter.post('/search', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const parsed = searchSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Escribe algo para buscar.' });
    return;
  }
  const q = parsed.data.query.toLowerCase();
  try {
    const all = await listMarkdown(p.vault);
    const results: Array<{ path: string; title: string; excerpt: string }> = [];
    for (const rel of all) {
      const title = path.basename(rel).replace(/\.md$/i, '');
      let content = '';
      try {
        content = await fs.readFile(path.join(p.vault, rel), 'utf8');
      } catch {
        continue;
      }
      const titleHit = title.toLowerCase().includes(q);
      const idx = content.toLowerCase().indexOf(q);
      if (!titleHit && idx < 0) continue;
      let excerpt = '';
      if (idx >= 0) {
        const start = Math.max(0, idx - 60);
        excerpt = (start > 0 ? '…' : '') + content.slice(start, idx + 120).replace(/\s+/g, ' ').trim() + '…';
      } else {
        excerpt = content.replace(/^---[\s\S]*?---/, '').replace(/[#>*`]/g, '').replace(/\s+/g, ' ').trim().slice(0, 160);
      }
      results.push({ path: rel, title, excerpt });
      if (results.length >= 50) break;
    }
    res.json({ query: parsed.data.query, results });
  } catch (err) {
    console.error('[vault] search error:', err);
    res.status(500).json({ error: 'La búsqueda falló.' });
  }
});

// ── RAG query (con citas) ────────────────────────────────────────────────────

const ragSchema = z.object({
  query: z.string().trim().min(1).max(2000),
  k: z.number().int().min(1).max(12).optional(),
});

const RAG_SYSTEM = `Eres el segundo cerebro del usuario en NEXUS. Respondes ÚNICAMENTE con base en los fragmentos de sus notas del vault que se te entregan. Reglas:
- Si la respuesta no está en las notas, dilo con honestidad ("No encontré eso en tus notas") y no inventes.
- Cita los títulos de las notas que usaste, entre comillas.
- Español neutro (LATAM), tono cálido y conciso. Sin listas largas salvo que ayuden.`;

vaultRouter.post('/rag/query', quotaCheck('messages'), async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const parsed = ragSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Escribe una pregunta.' });
    return;
  }
  const tenant = req.tenant!;
  const { query, k } = parsed.data;

  try {
    const hits = await ragQuery(tenant.userId, query, k ?? 6);

    if (hits.length === 0) {
      res.json({
        answer: 'No encontré nada relacionado en tus notas todavía. Prueba a indexar tu vault o reformula la pregunta.',
        citations: [],
        used: 0,
      });
      return;
    }

    // Contexto: numera los fragmentos con su nota de origen.
    const context = hits
      .map((h, i) => {
        const title = path.basename(h.notePath).replace(/\.md$/i, '');
        return `[${i + 1}] Nota: "${title}" (${h.notePath})\n${h.chunk}`;
      })
      .join('\n\n---\n\n');

    const cliContext = tenant.userPaths
      ? { home: tenant.userPaths.root, workdir: tenant.userPaths.workdir }
      : null;
    const picked = await pickAdapter(tenant.tier, { cliContext });

    const messages: ChatMessage[] = [
      { role: 'system', content: RAG_SYSTEM },
      {
        role: 'user',
        content: `Fragmentos de mis notas:\n\n${context}\n\n---\n\nPregunta: ${query}`,
      },
    ];

    const result = await picked.adapter.chat(messages, { model: picked.model });
    await recordUsage(tenant.orgId, tenant.tier, 'messages', 1);

    // Citas: notas únicas (con el mejor score), preservando orden de aparición.
    const seen = new Map<string, number>();
    for (const h of hits) {
      const prev = seen.get(h.notePath);
      if (prev === undefined || h.score > prev) seen.set(h.notePath, h.score);
    }
    const citations = [...seen.entries()].map(([notePath, score]) => ({
      notePath,
      title: path.basename(notePath).replace(/\.md$/i, ''),
      score: Number(score.toFixed(4)),
    }));

    res.json({ answer: result.text, citations, used: hits.length, model: picked.model });
  } catch (err) {
    if (err instanceof AdapterError) {
      console.error(`[vault] rag adapter error: ${err.message}`, err.detail ?? '');
      res.status(502).json({ error: 'El asistente no está disponible en este momento.' });
      return;
    }
    console.error('[vault] rag error:', err);
    res.status(500).json({ error: 'No se pudo responder con tu vault.' });
  }
});

// ── Reindex (manual) ─────────────────────────────────────────────────────────

// Anti-spam: un reindex en curso por usuario a la vez.
const reindexing = new Set<string>();

vaultRouter.post('/reindex', async (req: Request, res: Response) => {
  const p = requirePaths(req, res);
  if (!p) return;
  const userId = req.tenant!.userId;
  if (reindexing.has(userId)) {
    res.status(429).json({ error: 'Ya hay una reindexación en curso.' });
    return;
  }
  reindexing.add(userId);
  try {
    const result = await reindexAll(userId);
    res.json({
      ok: true,
      notes: result.notes,
      chunks: result.chunks,
      skipped: result.skipped,
      errors: result.errors.length,
    });
  } catch (err) {
    console.error('[vault] reindex error:', err);
    res.status(500).json({ error: 'No se pudo reindexar el vault.' });
  } finally {
    reindexing.delete(userId);
  }
});
