/**
 * Hito 4 — capacidades VPS exclusivas + observabilidad.
 *
 * Cubre:
 *  - GET /api/usage refleja cuotas + telemetría IA (ai_usage_log) + ahorro caché.
 *  - Caché semántico (Redis): 2da llamada idéntica devuelve cached=true (ahorro).
 *  - Scraper: extrae de página local (renderAndExtract) + SSRF guard rechaza IPs
 *    internas (assertSafeUrl, scrapeUrl, isPrivateIp).
 *  - Endpoint /api/scrape/run: free → 402 (tier gate); SSRF interna → 400.
 *  - Monitor: detecta cambio y crea notification (runMonitor sobre servidor local).
 *  - Notifications: GET lista + unread; POST :id/read; aislamiento cross-tenant.
 *  - Monitors CRUD + aislamiento cross-tenant.
 *
 * REAL vs SIMULADO:
 *  - REAL: usage SQL, logUsage, promptCache Redis, scraper Playwright (chromium
 *    del cache), SSRF guard, monitor evaluación + notificación, CRUD scoped.
 *  - TOLERANTE A RED: el cache hit del endpoint /assistant/chat depende de
 *    OpenCode (red). El test de caché usa el promptCache directamente (Redis
 *    real) para no depender de la IA externa; además verifica logUsage.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { eq, like } from 'drizzle-orm';
import { app, loginAndGetCookie } from './helpers.js';
import { db, pool } from '../src/db/index.js';
import { users, monitors, notifications, aiUsageLog, organizations } from '../src/db/schema.js';
import { seedTierPolicies } from '../src/db/seedTierPolicies.js';
import {
  renderAndExtract,
  scrapeUrl,
  assertSafeUrl,
  isPrivateIp,
  ScrapeError,
} from '../src/services/scrape/scraper.js';
import { runMonitor, evaluateCriteria, extractNumber } from '../src/services/scrape/monitor.js';
import { cacheKey, getCached, setCached, cacheHealthy, closeCache } from '../src/services/promptCache.js';
import { logUsage } from '../src/services/usageLog.js';
import { createNotification, unreadCount } from '../src/services/notifications.js';

const EMAIL_A = `h4-a-${Date.now()}@nexus.test`;
const EMAIL_B = `h4-b-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';

let userA: string;
let orgA: string;
let cookieA: string;
let userB: string;
let cookieB: string;

let staticServer: http.Server;
let staticUrl: string;
let pageState = { price: '$ 4.250,75' };

async function register(email: string): Promise<string> {
  const res = await request(app).post('/api/auth/register').send({ email, password: PASSWORD, displayName: 'H4 Test' });
  expect(res.status).toBe(201);
  return res.body.userId;
}

/** Sube a 'pro' el tier del user + su org (para tier gate de scraping). */
async function upgradeToPro(userId: string): Promise<void> {
  const [u] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  await db.update(users).set({ tier: 'pro' }).where(eq(users.id, userId));
  if (u?.defaultOrgId) {
    await db.update(organizations).set({ tier: 'pro' }).where(eq(organizations.id, u.defaultOrgId));
  }
}

async function wipeTestData() {
  const testUsers = await db.select({ id: users.id }).from(users).where(like(users.email, '%@nexus.test'));
  for (const u of testUsers) {
    await db.delete(monitors).where(eq(monitors.userId, u.id));
    await db.delete(notifications).where(eq(notifications.userId, u.id));
    await db.delete(aiUsageLog).where(eq(aiUsageLog.userId, u.id));
  }
}

beforeAll(async () => {
  await seedTierPolicies();

  // Servidor estático local para scraping/monitor (no depende de internet).
  staticServer = http.createServer((req, res) => {
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(
      `<!doctype html><html><head><title>Precio Dolar</title></head>` +
        `<body><h1>Cotizacion</h1><span id="precio">${pageState.price}</span></body></html>`
    );
  });
  await new Promise<void>((r) => staticServer.listen(0, '127.0.0.1', () => r()));
  const addr = staticServer.address() as AddressInfo;
  staticUrl = `http://127.0.0.1:${addr.port}/`;

  userA = await register(EMAIL_A);
  await upgradeToPro(userA); // A es pro (puede scrapear / crear monitores)
  cookieA = await loginAndGetCookie(EMAIL_A, PASSWORD);
  const [ua] = await db.select().from(users).where(eq(users.id, userA)).limit(1);
  orgA = ua!.defaultOrgId!;

  userB = await register(EMAIL_B); // B se queda free
  cookieB = await loginAndGetCookie(EMAIL_B, PASSWORD);

  await wipeTestData();
}, 60_000);

afterAll(async () => {
  await wipeTestData();
  await new Promise<void>((r) => staticServer.close(() => r()));
  await closeCache();
  await pool.end();
});

// ── Scraper + SSRF guard ──────────────────────────────────────────────────────
describe('Scraper headless (Playwright)', () => {
  it('isPrivateIp clasifica IPs internas y públicas', () => {
    expect(isPrivateIp('127.0.0.1')).toBe(true);
    expect(isPrivateIp('10.1.2.3')).toBe(true);
    expect(isPrivateIp('172.16.0.1')).toBe(true);
    expect(isPrivateIp('172.31.255.255')).toBe(true);
    expect(isPrivateIp('192.168.0.1')).toBe(true);
    expect(isPrivateIp('169.254.169.254')).toBe(true); // metadata cloud
    expect(isPrivateIp('::1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
    expect(isPrivateIp('1.1.1.1')).toBe(false);
  });

  it('assertSafeUrl rechaza localhost / IP privada / no-http', async () => {
    await expect(assertSafeUrl('http://127.0.0.1:8100/embed')).rejects.toThrow(ScrapeError);
    await expect(assertSafeUrl('http://localhost/')).rejects.toThrow(ScrapeError);
    await expect(assertSafeUrl('http://10.0.0.5/')).rejects.toThrow(ScrapeError);
    await expect(assertSafeUrl('http://192.168.1.1/')).rejects.toThrow(ScrapeError);
    await expect(assertSafeUrl('ftp://example.com/')).rejects.toThrow(ScrapeError);
    await expect(assertSafeUrl('not a url')).rejects.toThrow(ScrapeError);
  });

  it('scrapeUrl bloquea una URL interna del VPS (SSRF)', async () => {
    await expect(scrapeUrl(staticUrl)).rejects.toMatchObject({ code: 'ssrf_blocked' });
    // No deja browsers colgados: si fallara antes de lanzar, igual no abre uno.
  });

  it('renderAndExtract extrae título, texto y selector de página local', async () => {
    const r = await renderAndExtract(staticUrl, { selector: '#precio' });
    expect(r.title).toContain('Precio Dolar');
    expect(r.extracted).toContain('4.250');
    expect(r.text).toContain('Cotizacion');
  }, 30_000);
});

// ── Endpoint /api/scrape/run (tier gate + SSRF) ─────────────────────────────────
describe('POST /api/scrape/run', () => {
  it('free → 402 feature_locked', async () => {
    const res = await request(app).post('/api/scrape/run').set('Cookie', cookieB).send({ url: 'https://example.com' });
    expect(res.status).toBe(402);
    expect(res.body.error).toBe('feature_locked');
    expect(res.body.upgradeUrl).toBeTruthy();
  });

  it('pro + URL interna → 400 ssrf_blocked (no se navega a servicios del VPS)', async () => {
    const res = await request(app).post('/api/scrape/run').set('Cookie', cookieA).send({ url: staticUrl });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe('ssrf_blocked');
  });

  it('400 si falta url', async () => {
    const res = await request(app).post('/api/scrape/run').set('Cookie', cookieA).send({});
    expect(res.status).toBe(400);
  });
});

// ── Caché semántico (Redis) ─────────────────────────────────────────────────────
describe('Caché semántico de prompts (Redis)', () => {
  it('Redis está disponible (PONG)', async () => {
    expect(await cacheHealthy()).toBe(true);
  });

  it('miss en 1ra, hit en 2da llamada idéntica', async () => {
    const key = cacheKey('test|model|sys', `prompt único ${Date.now()}`);
    expect(await getCached(key)).toBeNull(); // miss
    await setCached(key, 'respuesta cacheada', 60);
    expect(await getCached(key)).toBe('respuesta cacheada'); // hit
  });

  it('clave estable ante espacios/casing (normalización)', () => {
    const a = cacheKey('ns', '  Hola   MUNDO ');
    const b = cacheKey('ns', 'hola mundo');
    expect(a).toBe(b);
  });
});

// ── Observabilidad /api/usage ───────────────────────────────────────────────────
describe('GET /api/usage', () => {
  it('refleja cuotas + telemetría IA + ahorro por caché', async () => {
    // Siembra telemetría: 2 llamadas reales (tokens) + 1 cache hit (ahorro).
    await logUsage({ userId: userA, orgId: orgA, kind: 'chat', model: 'qwen', tokensPrompt: 100, tokensCompletion: 50 });
    await logUsage({ userId: userA, orgId: orgA, kind: 'rag', model: 'qwen', tokensPrompt: 200, tokensCompletion: 80 });
    await logUsage({ userId: userA, orgId: orgA, kind: 'chat', model: 'qwen', cacheHit: true });

    const res = await request(app).get('/api/usage').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(res.body.tier).toBe('pro');
    expect(Array.isArray(res.body.quotas)).toBe(true);
    const metrics = res.body.quotas.map((q: { metric: string }) => q.metric);
    expect(metrics).toContain('messages');
    expect(metrics).toContain('voice_seconds');
    expect(metrics).toContain('vault_bytes');

    expect(res.body.ai.totalCalls).toBeGreaterThanOrEqual(3);
    expect(res.body.ai.cacheHits).toBeGreaterThanOrEqual(1);
    expect(res.body.ai.totalTokens).toBeGreaterThanOrEqual(430);
    // Ahorro estimado > 0 (hubo al menos 1 cache hit con tokens promedio > 0).
    expect(res.body.ai.savings.tokensSaved).toBeGreaterThan(0);
    expect(res.body.ai.savings.usdSaved).toBeGreaterThan(0);
  });

  it('usage de B no incluye telemetría de A (aislamiento)', async () => {
    const res = await request(app).get('/api/usage').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    expect(res.body.ai.totalCalls).toBe(0);
    expect(res.body.ai.totalTokens).toBe(0);
  });
});

// ── Monitor: detección de cambio + notificación ─────────────────────────────────
describe('Monitor proactivo', () => {
  it('extractNumber parsea montos es-CO', () => {
    expect(extractNumber('$ 4.250,75')).toBeCloseTo(4250.75, 2);
    expect(extractNumber('1,234.56')).toBeCloseTo(1234.56, 2);
    expect(extractNumber('sin numero')).toBeNull();
  });

  it('evaluateCriteria: changed dispara solo si difiere', () => {
    const r1 = evaluateCriteria({ op: 'changed' }, 'viejo', { text: 'nuevo', extracted: null });
    expect(r1.triggered).toBe(true);
    const r2 = evaluateCriteria({ op: 'changed' }, 'igual', { text: 'igual', extracted: null });
    expect(r2.triggered).toBe(false);
    const r3 = evaluateCriteria({ op: 'lt', value: 5000 }, null, { text: '', extracted: '$ 4.250,75' });
    expect(r3.triggered).toBe(true); // 4250.75 < 5000
  });

  it('runMonitor detecta cambio en página local y crea notification', async () => {
    // Crea un monitor con last_value previo distinto al actual → dispara 'changed'.
    const [m] = await db
      .insert(monitors)
      .values({
        userId: userA,
        orgId: orgA,
        title: 'Precio dólar',
        kind: 'price',
        targetUrl: staticUrl,
        selector: '#precio',
        criteria: { op: 'changed' },
        lastValue: 'valor-viejo-distinto',
      })
      .returning();

    const before = await unreadCount(userA);
    // Inyecta el motor sin guard (servidor local) — el guard SSRF de producción
    // sigue intacto en scrapeUrl; aquí probamos el flujo de detección.
    const r = await runMonitor(m!, renderAndExtract);
    expect(r.triggered).toBe(true);
    const after = await unreadCount(userA);
    expect(after).toBe(before + 1);

    // La notification quedó scoped a A con los datos del monitor.
    const notifs = await db.select().from(notifications).where(eq(notifications.userId, userA));
    const n = notifs.find((x) => (x.data as { monitorId?: string }).monitorId === m!.id);
    expect(n).toBeTruthy();
    expect(n!.kind).toBe('monitor');
    expect(n!.title).toContain('Precio dólar');

    // last_value se actualizó al valor extraído.
    const [fresh] = await db.select().from(monitors).where(eq(monitors.id, m!.id));
    expect(fresh!.lastValue).toContain('4.250');

    // Segunda corrida SIN cambios → no dispara, no crea nueva notif.
    const r2 = await runMonitor(fresh!, renderAndExtract);
    expect(r2.triggered).toBe(false);
    expect(await unreadCount(userA)).toBe(after);
  }, 30_000);
});

// ── Monitors CRUD + aislamiento ─────────────────────────────────────────────────
describe('Monitors CRUD', () => {
  it('free no puede crear monitor (402)', async () => {
    const res = await request(app)
      .post('/api/monitors')
      .set('Cookie', cookieB)
      .send({ title: 'X', targetUrl: 'https://example.com', criteria: { op: 'changed' } });
    expect(res.status).toBe(402);
  });

  it('pro crea, lista y borra; rechaza URL interna al crear', async () => {
    // URL interna → 400 SSRF en la creación.
    const bad = await request(app)
      .post('/api/monitors')
      .set('Cookie', cookieA)
      .send({ title: 'malo', targetUrl: 'http://127.0.0.1:5432/', criteria: { op: 'changed' } });
    expect(bad.status).toBe(400);
    expect(bad.body.code).toBe('ssrf_blocked');

    const create = await request(app)
      .post('/api/monitors')
      .set('Cookie', cookieA)
      .send({ title: 'Dólar BCV', kind: 'price', targetUrl: 'https://example.com', criteria: { op: 'lt', value: 100 } });
    expect(create.status).toBe(201);
    const id = create.body.monitor.id;

    const list = await request(app).get('/api/monitors').set('Cookie', cookieA);
    expect(list.body.monitors.some((m: { id: string }) => m.id === id)).toBe(true);

    const patch = await request(app).patch(`/api/monitors/${id}`).set('Cookie', cookieA).send({ enabled: false });
    expect(patch.status).toBe(200);
    expect(patch.body.monitor.enabled).toBe(false);

    const del = await request(app).delete(`/api/monitors/${id}`).set('Cookie', cookieA);
    expect(del.status).toBe(200);
  });

  it('B no ve ni borra monitores de A (404, aislamiento)', async () => {
    const [m] = await db
      .insert(monitors)
      .values({ userId: userA, orgId: orgA, title: 'solo-A', targetUrl: 'https://example.com', criteria: { op: 'changed' } })
      .returning();

    const list = await request(app).get('/api/monitors').set('Cookie', cookieB);
    expect(list.body.monitors.find((x: { id: string }) => x.id === m!.id)).toBeUndefined();

    const del = await request(app).delete(`/api/monitors/${m!.id}`).set('Cookie', cookieB);
    expect(del.status).toBe(404);

    await db.delete(monitors).where(eq(monitors.id, m!.id));
  });
});

// ── Notifications endpoints + aislamiento ───────────────────────────────────────
describe('Notifications', () => {
  it('GET lista + unread; POST :id/read marca leída', async () => {
    const n = await createNotification({ userId: userA, orgId: orgA, kind: 'system', title: 'Hola A' });
    const list = await request(app).get('/api/notifications').set('Cookie', cookieA);
    expect(list.status).toBe(200);
    expect(list.body.notifications.some((x: { id: string }) => x.id === n.id)).toBe(true);
    expect(list.body.unread).toBeGreaterThanOrEqual(1);

    const read = await request(app).post(`/api/notifications/${n.id}/read`).set('Cookie', cookieA);
    expect(read.status).toBe(200);

    const after = await request(app).get('/api/notifications').set('Cookie', cookieA);
    const updated = after.body.notifications.find((x: { id: string }) => x.id === n.id);
    expect(updated.read).toBe(true);
  });

  it('B no puede marcar leída una notificación de A (404)', async () => {
    const n = await createNotification({ userId: userA, orgId: orgA, kind: 'system', title: 'Privado A' });
    const res = await request(app).post(`/api/notifications/${n.id}/read`).set('Cookie', cookieB);
    expect(res.status).toBe(404);
  });
});
