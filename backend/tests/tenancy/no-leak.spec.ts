/**
 * Test maestro permanente anti-fuga cross-tenant.
 * Riesgo #2 del plan: fuga por olvido de where(user_id). Este test debe estar
 * SIEMPRE verde en CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import { runSeed, type SeededUser } from '../../src/db/seed.js';
import { pool } from '../../src/db/index.js';
import { app, loginAndGetCookie } from '../helpers.js';
import {
  provisionUserEnv,
  resolveUserPaths,
  assertWithinUserEnv,
  PathTraversalError,
} from '../../src/services/userEnv.js';

let A: SeededUser;
let B: SeededUser;
let cookieA: string;
let cookieB: string;

beforeAll(async () => {
  const seeded = await runSeed();
  A = seeded.A;
  B = seeded.B;
  cookieA = await loginAndGetCookie(A.email, A.password);
  cookieB = await loginAndGetCookie(B.email, B.password);
});

afterAll(async () => {
  await pool.end();
});

describe('aislamiento cross-tenant en /api/agents', () => {
  it('GET /api/agents como A solo devuelve agentes de A (ningún id de B)', async () => {
    const res = await request(app).get('/api/agents').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const ids = res.body.agents.map((a: { id: string }) => a.id);
    expect(ids.sort()).toEqual([...A.agentIds].sort());
    for (const bId of B.agentIds) expect(ids).not.toContain(bId);
  });

  it('GET /api/agents como B solo devuelve agentes de B (ningún id de A)', async () => {
    const res = await request(app).get('/api/agents').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    const ids = res.body.agents.map((a: { id: string }) => a.id);
    expect(ids.sort()).toEqual([...B.agentIds].sort());
    for (const aId of A.agentIds) expect(ids).not.toContain(aId);
  });

  it('A intenta PATCH un agente de B → 404 (no 403)', async () => {
    const res = await request(app)
      .patch(`/api/agents/${B.agentIds[0]}`)
      .set('Cookie', cookieA)
      .send({ displayName: 'hackeado' });
    expect(res.status).toBe(404);
  });

  it('A intenta GET un agente de B → 404 (no 403)', async () => {
    const res = await request(app).get(`/api/agents/${B.agentIds[0]}`).set('Cookie', cookieA);
    expect(res.status).toBe(404);
  });

  it('A intenta DELETE un agente de B → 404 y el agente sigue vivo para B', async () => {
    const del = await request(app).delete(`/api/agents/${B.agentIds[1]}`).set('Cookie', cookieA);
    expect(del.status).toBe(404);
    const stillThere = await request(app)
      .get(`/api/agents/${B.agentIds[1]}`)
      .set('Cookie', cookieB);
    expect(stillThere.status).toBe(200);
  });

  it('PATCH propio funciona y no permite reasignar user_id/org_id', async () => {
    const res = await request(app)
      .patch(`/api/agents/${A.agentIds[0]}`)
      .set('Cookie', cookieA)
      .send({ displayName: 'Renombrado', userId: B.userId, orgId: B.orgId });
    expect(res.status).toBe(200);
    expect(res.body.agent.displayName).toBe('Renombrado');
    expect(res.body.agent.userId).toBe(A.userId); // no se reasignó
  });

  it('sin cookie → 401', async () => {
    const res = await request(app).get('/api/agents');
    expect(res.status).toBe(401);
  });
});

describe('aislamiento de filesystem (path traversal)', () => {
  it('resolveUserPaths devuelve un env aislado para cada usuario', async () => {
    const pa = await resolveUserPaths(A.userId);
    const pb = await resolveUserPaths(B.userId);
    expect(pa).not.toBeNull();
    expect(pb).not.toBeNull();
    expect(pa!.root).not.toBe(pb!.root);
  });

  it('assertWithinUserEnv permite rutas internas legítimas', async () => {
    const pa = (await resolveUserPaths(A.userId))!;
    const ok = assertWithinUserEnv(pa, 'vault/Diarios/2026-05-28.md');
    expect(ok.startsWith(pa.root)).toBe(true);
  });

  it('assertWithinUserEnv bloquea traversal hacia el env de otro usuario', async () => {
    const pa = (await resolveUserPaths(A.userId))!;
    expect(() =>
      assertWithinUserEnv(pa, '../../../user_000002_env/vault/Preferencias.md')
    ).toThrow(PathTraversalError);
    expect(() => assertWithinUserEnv(pa, '../../etc/passwd')).toThrow(PathTraversalError);
    expect(() => assertWithinUserEnv(pa, '/etc/passwd')).toThrow(PathTraversalError);
  });
});

describe('provisión de env en registro', () => {
  it('un registro nuevo crea su directorio env con plantillas de vault', async () => {
    const email = `nuevo-${Date.now()}@nexus.test`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email, password: 'password123', displayName: 'Nuevo Usuario' });
    expect(res.status).toBe(201);
    const userId = res.body.userId as string;

    const paths = await resolveUserPaths(userId);
    expect(paths).not.toBeNull();

    const fs = await import('node:fs/promises');
    // subdirs presentes
    for (const sub of ['skills', 'mcp', 'connections', 'vault', 'workdir', 'runs', 'uploads']) {
      const st = await fs.stat(path.join(paths!.root, sub));
      expect(st.isDirectory()).toBe(true);
    }
    // plantillas de vault
    const pref = await fs.readFile(path.join(paths!.vault, 'Preferencias.md'), 'utf8');
    expect(pref).toContain('# Preferencias');
    const apr = await fs.readFile(path.join(paths!.vault, 'Aprendizajes_Repetitivos.md'), 'utf8');
    expect(apr).toContain('# Aprendizajes repetitivos');
    const meta = JSON.parse(await fs.readFile(paths!.meta, 'utf8'));
    expect(meta.userId).toBe(userId);
    expect(typeof meta.seq).toBe('number');

    // limpieza del usuario de prueba
    const { db } = await import('../../src/db/index.js');
    const { users } = await import('../../src/db/schema.js');
    const { eq } = await import('drizzle-orm');
    await db.delete(users).where(eq(users.id, userId));
    await fs.rm(paths!.root, { recursive: true, force: true });
  });

  it('provisionUserEnv es idempotente (reusa el mismo seq)', async () => {
    const first = await provisionUserEnv({ userId: A.userId, orgId: A.orgId, tier: A.tier });
    const second = await provisionUserEnv({ userId: A.userId, orgId: A.orgId, tier: A.tier });
    expect(first.root).toBe(second.root);
  });
});
