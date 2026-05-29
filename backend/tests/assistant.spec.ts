/**
 * Asistente + cuotas (Hito 1).
 *
 * - chat REAL contra OpenCode: si la red/gateway falla, el test NO rompe el
 *   suite; lo reporta como skip-soft (console.warn) y solo afirma que el uso
 *   no se incrementó en fallo. Si responde, verifica reply no vacío + uso +1.
 * - quota: agota messages (used = limit) y verifica 402 con upgradeUrl.
 *
 * Crea su propio usuario temporal y lo borra al final (cascade).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { and, eq, isNull } from 'drizzle-orm';
import { app, loginAndGetCookie } from './helpers.js';
import { db, pool } from '../src/db/index.js';
import { users, usageQuotas } from '../src/db/schema.js';
import { seedTierPolicies } from '../src/db/seedTierPolicies.js';
import { currentPeriod } from '../src/middleware/quota.js';
import { resolveUserPaths } from '../src/services/userEnv.js';

const EMAIL = `assistant-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';
let userId: string;
let orgId: string;
let cookie: string;

async function usedMessages(): Promise<number> {
  const [row] = await db
    .select()
    .from(usageQuotas)
    .where(
      and(
        eq(usageQuotas.orgId, orgId),
        isNull(usageQuotas.userId),
        eq(usageQuotas.period, currentPeriod()),
        eq(usageQuotas.metric, 'messages')
      )
    )
    .limit(1);
  return row ? Number(row.usedValue) : -1;
}

beforeAll(async () => {
  await seedTierPolicies();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: EMAIL, password: PASSWORD, displayName: 'Asistente Test' });
  expect(reg.status).toBe(201);
  userId = reg.body.userId;
  orgId = reg.body.orgId;
  cookie = await loginAndGetCookie(EMAIL, PASSWORD);
});

afterAll(async () => {
  if (userId) {
    const paths = await resolveUserPaths(userId);
    await db.delete(users).where(eq(users.id, userId));
    if (paths) {
      const fs = await import('node:fs/promises');
      await fs.rm(paths.root, { recursive: true, force: true });
    }
  }
  await pool.end();
});

describe('POST /api/assistant/chat', () => {
  it('rechaza body inválido con 400', async () => {
    const res = await request(app).post('/api/assistant/chat').set('Cookie', cookie).send({ message: '' });
    expect(res.status).toBe(400);
  });

  it('chat REAL: responde con reply no vacío e incrementa uso (tolerante a fallo de red)', async () => {
    const before = await usedMessages();
    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', cookie)
      .send({ message: 'Hola, responde solo con la palabra: listo' });

    if (res.status === 200) {
      expect(typeof res.body.reply).toBe('string');
      expect(res.body.reply.trim().length).toBeGreaterThan(0);
      expect(res.body.model).toBeTruthy();
      const after = await usedMessages();
      expect(after).toBe(before + 1);
    } else {
      // Fallo del gateway IA: NO rompe el suite, pero el uso NO debe haber subido.
      console.warn(`[assistant.spec] chat real no disponible (HTTP ${res.status}): ${JSON.stringify(res.body)}`);
      expect([502, 500]).toContain(res.status);
      const after = await usedMessages();
      expect(after).toBe(before);
    }
  });

  it('cuota agotada → 402 quota_exceeded con upgradeUrl', async () => {
    // Fuerza used = limit para messages en el periodo actual.
    const { sql } = await import('drizzle-orm');
    await db
      .update(usageQuotas)
      .set({ usedValue: sql`${usageQuotas.limitValue}` })
      .where(
        and(
          eq(usageQuotas.orgId, orgId),
          isNull(usageQuotas.userId),
          eq(usageQuotas.period, currentPeriod()),
          eq(usageQuotas.metric, 'messages')
        )
      );

    const res = await request(app)
      .post('/api/assistant/chat')
      .set('Cookie', cookie)
      .send({ message: 'hola' });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('quota_exceeded');
    expect(res.body.metric).toBe('messages');
    expect(res.body.upgradeUrl).toBe('/m/upgrade');
  });
});

describe('POST /api/voice/transcribe (cuota voz)', () => {
  it('free tier (voice_seconds=0) → 402 antes de procesar audio', async () => {
    const res = await request(app)
      .post('/api/voice/transcribe')
      .set('Cookie', cookie)
      .attach('audio', Buffer.from('fake'), 'a.webm');
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('quota_exceeded');
    expect(res.body.metric).toBe('voice_seconds');
  });
});
