/**
 * Vault + RAG (Hito 1 — Track B).
 *
 * Cubre:
 *  - tree / note CRUD (crear, leer, editar, borrar) sobre el vault aislado.
 *  - path traversal en `path` → rechazado (400), nunca toca fuera de vault/.
 *  - búsqueda full-text simple.
 *  - AISLAMIENTO CRÍTICO: ragQuery de A NUNCA devuelve chunks de B (anti-fuga),
 *    y A no puede leer/listar notas de B (cada quien su env).
 *
 * Los embeddings se mockean (vector determinista por texto) para no depender del
 * servicio BGE en CI y para construir un escenario de aislamiento controlado.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';

// Mock del servicio de embeddings: vector 1024-dim determinista por texto.
// Si el texto contiene 'ALPHA' apunta a una dirección; 'BETA' a otra ortogonal.
vi.mock('../src/services/embeddings.js', () => {
  const DIM = 1024;
  function vecFor(text: string): number[] {
    const v = new Array(DIM).fill(0);
    if (text.includes('ALPHA')) v[0] = 1;
    else if (text.includes('BETA')) v[1] = 1;
    else v[2] = 1; // neutro
    return v;
  }
  return {
    EMBEDDING_DIM: DIM,
    EmbeddingError: class extends Error {},
    embed: async (texts: string[]) => texts.map(vecFor),
    embedOne: async (text: string) => vecFor(text),
  };
});

const { app, loginAndGetCookie } = await import('./helpers.js');
const { runSeed } = await import('../src/db/seed.js');
const { db, pool } = await import('../src/db/index.js');
const { vaultChunks } = await import('../src/db/schema.js');
const { resolveUserPaths } = await import('../src/services/userEnv.js');
const { ragQuery, indexNote } = await import('../src/services/vaultIndexer.js');

type Seeded = Awaited<ReturnType<typeof runSeed>>['A'];

let A: Seeded;
let B: Seeded;
let cookieA: string;
let cookieB: string;

beforeAll(async () => {
  const seeded = await runSeed();
  A = seeded.A;
  B = seeded.B;
  cookieA = await loginAndGetCookie(A.email, A.password);
  cookieB = await loginAndGetCookie(B.email, B.password);

  // Limpia chunks previos de A y B.
  await db.delete(vaultChunks).where(eq(vaultChunks.userId, A.userId));
  await db.delete(vaultChunks).where(eq(vaultChunks.userId, B.userId));

  // Crea notas controladas en cada vault.
  const pa = (await resolveUserPaths(A.userId))!;
  const pb = (await resolveUserPaths(B.userId))!;
  await fs.writeFile(path.join(pa.vault, 'SecretoA.md'), '# SecretoA\n\nEsto es ALPHA, contenido confidencial de A.');
  await fs.writeFile(path.join(pb.vault, 'SecretoB.md'), '# SecretoB\n\nEsto es BETA, contenido confidencial de B.');

  // Indexa ambas (usa el embed mockeado).
  await indexNote(A.userId, 'SecretoA.md');
  await indexNote(B.userId, 'SecretoB.md');
});

afterAll(async () => {
  await db.delete(vaultChunks).where(eq(vaultChunks.userId, A.userId));
  await db.delete(vaultChunks).where(eq(vaultChunks.userId, B.userId));
  await pool.end();
});

describe('vault — árbol y lectura', () => {
  it('GET /api/vault/tree devuelve notas del propio vault', async () => {
    const res = await request(app).get('/api/vault/tree').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const names = JSON.stringify(res.body.tree);
    expect(names).toContain('SecretoA');
    expect(names).not.toContain('SecretoB'); // jamás ve notas de B
    expect(res.body.totalNotes).toBeGreaterThan(0);
  });

  it('GET /api/vault/note lee contenido + frontmatter + backlinks', async () => {
    const res = await request(app)
      .get('/api/vault/note')
      .query({ path: 'SecretoA.md' })
      .set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(res.body.content).toContain('ALPHA');
    expect(res.body.title).toBe('SecretoA');
    expect(Array.isArray(res.body.backlinks)).toBe(true);
  });

  it('sin cookie → 401', async () => {
    const res = await request(app).get('/api/vault/tree');
    expect(res.status).toBe(401);
  });
});

describe('vault — path traversal', () => {
  it('GET /note con ../ → 400 (no escapa del vault)', async () => {
    const res = await request(app)
      .get('/api/vault/note')
      .query({ path: '../../../user_000001_env/vault/HOME.md' })
      .set('Cookie', cookieA);
    expect(res.status).toBe(400);
  });

  it('GET /note con ruta absoluta → 400', async () => {
    const res = await request(app)
      .get('/api/vault/note')
      .query({ path: '/etc/passwd' })
      .set('Cookie', cookieA);
    expect(res.status).toBe(400);
  });

  it('PUT /note con traversal → 400 y no escribe fuera', async () => {
    const res = await request(app)
      .put('/api/vault/note')
      .set('Cookie', cookieA)
      .send({ path: '../../escape.md', content: 'malicioso' });
    expect(res.status).toBe(400);
  });

  it('rechaza rutas que no terminan en .md', async () => {
    const res = await request(app)
      .get('/api/vault/note')
      .query({ path: 'SecretoA.txt' })
      .set('Cookie', cookieA);
    expect(res.status).toBe(400);
  });
});

describe('vault — CRUD', () => {
  const notePath = 'Conceptos/Prueba CRUD.md';

  it('POST crea una nota con template concepto', async () => {
    const res = await request(app)
      .post('/api/vault/note')
      .set('Cookie', cookieA)
      .send({ path: notePath, template: 'concepto' });
    expect(res.status).toBe(201);
    expect(res.body.path).toBe(notePath);
  });

  it('POST sobre nota existente → 409', async () => {
    const res = await request(app)
      .post('/api/vault/note')
      .set('Cookie', cookieA)
      .send({ path: notePath });
    expect(res.status).toBe(409);
  });

  it('PUT edita el contenido', async () => {
    const res = await request(app)
      .put('/api/vault/note')
      .set('Cookie', cookieA)
      .send({ path: notePath, content: '# Prueba CRUD\n\nContenido editado.' });
    expect(res.status).toBe(200);
    const read = await request(app).get('/api/vault/note').query({ path: notePath }).set('Cookie', cookieA);
    expect(read.body.content).toContain('Contenido editado');
  });

  it('DELETE borra archivo y chunks', async () => {
    const res = await request(app)
      .delete('/api/vault/note')
      .query({ path: notePath })
      .set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const read = await request(app).get('/api/vault/note').query({ path: notePath }).set('Cookie', cookieA);
    expect(read.status).toBe(404);
  });
});

describe('vault — búsqueda full-text', () => {
  it('POST /search encuentra por contenido en el propio vault', async () => {
    const res = await request(app)
      .post('/api/vault/search')
      .set('Cookie', cookieA)
      .send({ query: 'ALPHA' });
    expect(res.status).toBe(200);
    expect(res.body.results.some((r: { path: string }) => r.path === 'SecretoA.md')).toBe(true);
  });

  it('A no encuentra contenido exclusivo de B vía /search', async () => {
    const res = await request(app)
      .post('/api/vault/search')
      .set('Cookie', cookieA)
      .send({ query: 'BETA' });
    expect(res.status).toBe(200);
    // 'BETA' solo existe en el vault de B → A no debe encontrarlo.
    expect(res.body.results.some((r: { path: string }) => r.path === 'SecretoB.md')).toBe(false);
  });
});

describe('vault — RAG aislamiento (anti-fuga cross-tenant)', () => {
  it('ragQuery de A SOLO devuelve chunks de A (nunca de B)', async () => {
    // Query "ALPHA" apunta al chunk de A; aun así verificamos que NINGÚN hit sea de B.
    const hitsA = await ragQuery(A.userId, 'ALPHA', 10);
    expect(hitsA.length).toBeGreaterThan(0);
    for (const h of hitsA) expect(h.notePath).not.toBe('SecretoB.md');
    expect(hitsA.some((h) => h.notePath === 'SecretoA.md')).toBe(true);
  });

  it('ragQuery de A con vector que apunta a BETA NO trae el chunk de B', async () => {
    // Aunque la query apunte semánticamente a 'BETA', el filtro user_id impide ver B.
    const hits = await ragQuery(A.userId, 'BETA', 10);
    for (const h of hits) expect(h.notePath).not.toBe('SecretoB.md');
  });

  it('los chunks de B existen en la tabla pero son invisibles para A', async () => {
    const bChunks = await db
      .select()
      .from(vaultChunks)
      .where(and(eq(vaultChunks.userId, B.userId), eq(vaultChunks.notePath, 'SecretoB.md')));
    expect(bChunks.length).toBeGreaterThan(0); // B tiene sus chunks
    const hitsA = await ragQuery(A.userId, 'BETA', 10);
    expect(hitsA.every((h) => h.notePath !== 'SecretoB.md')).toBe(true);
  });

  it('POST /api/vault/rag/query responde 200 con citations array (mock embed)', async () => {
    const res = await request(app)
      .post('/api/vault/rag/query')
      .set('Cookie', cookieA)
      .send({ query: 'ALPHA', k: 3 });
    // Puede ser 200 (IA respondió) o 502 (gateway IA caído en CI). Nunca fuga.
    expect([200, 502]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body.citations)).toBe(true);
      const cited = JSON.stringify(res.body.citations);
      expect(cited).not.toContain('SecretoB');
    }
  });
});
