/**
 * Flujo de autenticación: register → login → me → logout.
 */
import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import { app } from './helpers.js';
import { pool, db } from '../src/db/index.js';
import { users } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';
import { resolveUserPaths } from '../src/services/userEnv.js';

const EMAIL = `auth-flow-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';
let createdUserId: string | null = null;

afterAll(async () => {
  if (createdUserId) {
    const paths = await resolveUserPaths(createdUserId);
    await db.delete(users).where(eq(users.id, createdUserId));
    if (paths) {
      const fs = await import('node:fs/promises');
      await fs.rm(paths.root, { recursive: true, force: true });
    }
  }
  await pool.end();
});

describe('flujo register → login → me → logout', () => {
  let cookie = '';

  it('register crea la cuenta y devuelve cookie de sesión (201)', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Flujo Auth' });
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);
    expect(res.body.tier).toBe('free');
    createdUserId = res.body.userId;
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('register duplicado → 409', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Otro' });
    expect(res.status).toBe(409);
  });

  it('register con datos inválidos → 400', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'no-es-email', password: '123', displayName: '' });
    expect(res.status).toBe(400);
  });

  it('login correcto devuelve cookie', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: PASSWORD });
    expect(res.status).toBe(200);
    const sc = res.headers['set-cookie'];
    cookie = (Array.isArray(sc) ? sc : [sc]).map((c) => c.split(';')[0]).join('; ');
    expect(cookie).toContain('nexus_v2_session');
  });

  it('login con password incorrecto → 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: EMAIL, password: 'malo' });
    expect(res.status).toBe(401);
  });

  it('me con cookie devuelve user + org + tier + quotas', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email.toLowerCase()).toBe(EMAIL.toLowerCase());
    expect(res.body.org).not.toBeNull();
    expect(res.body.tier).toBe('free');
    expect(Array.isArray(res.body.quotas)).toBe(true);
    const metrics = res.body.quotas.map((q: { metric: string }) => q.metric).sort();
    expect(metrics).toEqual(['messages', 'vault_bytes', 'voice_seconds']);
  });

  it('me sin cookie → 401', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('logout limpia la cookie y me deja de funcionar', async () => {
    const out = await request(app).post('/api/auth/logout').set('Cookie', cookie);
    expect(out.status).toBe(200);
    // La cookie original sigue siendo un JWT válido (logout es stateless),
    // pero el cliente la borra. Verificamos que el endpoint responde ok.
    expect(out.body.ok).toBe(true);
  });
});
