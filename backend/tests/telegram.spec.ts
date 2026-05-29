/**
 * Vinculación Telegram (Hito 1 — Track C). SIN poller: solo pairing + webhook.
 *
 * Cubre:
 *  - POST /api/telegram/pair genera un código de 6 chars (15 min).
 *  - webhook "/start CODIGO" vincula telegram_chat_id al usuario.
 *  - código inválido/expirado/ya-consumido → NO vincula.
 *  - GET /api/telegram/pairing-status refleja el estado.
 *
 * El bot dedicado se simula vía env (TELEGRAM_BOT_TOKEN_V2 + WEBHOOK_SECRET) y
 * sendMessage se mockea para no llamar a la Bot API real. NO se inicia polling.
 *
 * Limpieza: borra SOLO el usuario de prueba por email exacto.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import { eq, sql } from 'drizzle-orm';

// Mock del notifier: sendMessage no-op exitoso (no toca la Bot API real).
vi.mock('../src/services/telegramNotifier.js', () => ({
  isTelegramEnabled: () => true,
  sendMessage: vi.fn(async () => true),
  notify: vi.fn(async () => true),
}));

// El webhook exige bot configurado + secret. Los seteamos ANTES de importar env.
process.env.TELEGRAM_BOT_TOKEN_V2 = 'test:DEDICATED_V2_TOKEN';
process.env.TELEGRAM_WEBHOOK_SECRET = 'test_webhook_secret_abc123';

const { app, loginAndGetCookie } = await import('./helpers.js');
const { pool, db } = await import('../src/db/index.js');
const { users, telegramPairings } = await import('../src/db/schema.js');
const { resolveUserPaths } = await import('../src/services/userEnv.js');
const { seedTierPolicies } = await import('../src/db/seedTierPolicies.js');

const SECRET = 'test_webhook_secret_abc123';
const EMAIL = `tg-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';
const CHAT_ID = 987654321;
let userId: string | null = null;
let cookie = '';

beforeAll(async () => {
  await seedTierPolicies();
  const reg = await request(app)
    .post('/api/auth/register')
    .send({ email: EMAIL, password: PASSWORD, displayName: 'TG User' });
  userId = reg.body.userId;
  cookie = await loginAndGetCookie(EMAIL, PASSWORD);
});

afterAll(async () => {
  if (userId) {
    const paths = await resolveUserPaths(userId);
    await db.delete(users).where(eq(users.id, userId));
    if (paths) await fs.rm(paths.root, { recursive: true, force: true });
  }
  await pool.end();
});

function startUpdate(code: string, chatId = CHAT_ID) {
  return { update_id: 1, message: { chat: { id: chatId }, text: `/start ${code}` } };
}

describe('telegram pairing', () => {
  let code = '';

  it('POST /api/telegram/pair genera código de 6 chars con TTL', async () => {
    const res = await request(app).post('/api/telegram/pair').set('Cookie', cookie);
    expect(res.status).toBe(201);
    expect(res.body.code).toMatch(/^[A-Z2-9]{6}$/);
    expect(res.body.ttlSeconds).toBe(900);
    expect(res.body.instructions).toContain('/start');
    code = res.body.code;
  });

  it('pairing-status: aún NO vinculado', async () => {
    const res = await request(app).get('/api/telegram/pairing-status').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.linked).toBe(false);
  });

  it('webhook con secret incorrecto → 403', async () => {
    const res = await request(app).post('/tg/webhook/secreto-malo').send(startUpdate(code));
    expect(res.status).toBe(403);
  });

  it('webhook "/start CODIGO" vincula el chat_id al usuario', async () => {
    const res = await request(app).post(`/tg/webhook/${SECRET}`).send(startUpdate(code));
    expect(res.status).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
    expect(u?.telegramChatId).toBe(CHAT_ID);
    expect(u?.telegramPairedAt).toBeTruthy();
  });

  it('pairing-status: ahora SÍ vinculado', async () => {
    const res = await request(app).get('/api/telegram/pairing-status').set('Cookie', cookie);
    expect(res.body.linked).toBe(true);
  });

  it('reusar el MISMO código (ya consumido) NO re-vincula a otro chat', async () => {
    const res = await request(app).post(`/tg/webhook/${SECRET}`).send(startUpdate(code, 111));
    expect(res.status).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
    expect(u?.telegramChatId).toBe(CHAT_ID); // sigue el chat original
  });

  it('código inválido (inexistente) NO vincula', async () => {
    // Usuario fresco sin vincular, para aislar el efecto.
    const email2 = `tg2-${Date.now()}@nexus.test`;
    const reg = await request(app)
      .post('/api/auth/register')
      .send({ email: email2, password: PASSWORD, displayName: 'TG2' });
    const id2 = reg.body.userId as string;
    try {
      const res = await request(app).post(`/tg/webhook/${SECRET}`).send(startUpdate('ZZZZZZ', 222));
      expect(res.status).toBe(200);
      const [u] = await db.select().from(users).where(eq(users.id, id2)).limit(1);
      expect(u?.telegramChatId).toBeNull();
    } finally {
      const paths = await resolveUserPaths(id2);
      await db.delete(users).where(eq(users.id, id2));
      if (paths) await fs.rm(paths.root, { recursive: true, force: true });
    }
  });

  it('código EXPIRADO NO vincula', async () => {
    const pair = await request(app).post('/api/telegram/pair').set('Cookie', cookie);
    const expiredCode = pair.body.code as string;
    // Forzamos expiración en el pasado.
    await db
      .update(telegramPairings)
      .set({ expiresAt: sql`now() - interval '1 hour'` })
      .where(eq(telegramPairings.pairingCode, expiredCode));
    // Desvinculamos el chat para detectar si (erróneamente) se re-vincula.
    await db.update(users).set({ telegramChatId: null }).where(eq(users.id, userId!));
    const res = await request(app).post(`/tg/webhook/${SECRET}`).send(startUpdate(expiredCode, 333));
    expect(res.status).toBe(200);
    const [u] = await db.select().from(users).where(eq(users.id, userId!)).limit(1);
    expect(u?.telegramChatId).toBeNull();
  });
});
