/**
 * Hito 5 — Monetización (MercadoPago SEAM) + flujo de upgrade + ciclo de
 * suscripción.
 *
 * Cubre:
 *  - GET /api/billing/plans → catálogo con precios/features (público).
 *  - GET /api/billing/subscription → suscripción + uso vs límites.
 *  - changeTier (free→pro) re-siembra usage_quotas con los nuevos límites
 *    PRESERVANDO lo ya consumido, y actualiza tier de org + users.
 *  - POST /api/billing/checkout sin MP → 503 billing_not_configured.
 *  - POST /api/billing/checkout?simulate=1 aplica el cambio (DEV).
 *  - POST /api/billing/cancel marca cancel_at_period_end.
 *  - Webhook idempotente (mismo provider_event_id no re-aplica).
 *  - Aislamiento: el checkout/cancel de A no toca el plan de B.
 *
 * REAL vs SIMULADO:
 *  - REAL: toda la lógica de DB (subscriptions, usage_quotas, plans,
 *    billing_events), changeTier transaccional, idempotencia del webhook.
 *  - SEAM: MercadoPago sin token → checkout real responde 503; el webhook se
 *    prueba llamando processWebhookEvent() directamente (la red de MP no se
 *    toca). El path ?simulate=1 ejercita el flujo de cambio end-to-end sin MP.
 *
 * NO toca al usuario Jerson (tier team) ni su org. Limpia usuarios @nexus.test.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { eq, like } from 'drizzle-orm';
import { app, loginAndGetCookie } from './helpers.js';
import { db, pool } from '../src/db/index.js';
import {
  users,
  organizations,
  subscriptions,
  usageQuotas,
  billingEvents,
} from '../src/db/schema.js';
import { seedTierPolicies } from '../src/db/seedTierPolicies.js';
import { seedPlans } from '../src/db/seedPlans.js';
import { recordUsage, currentPeriod } from '../src/middleware/quota.js';
import {
  changeTier,
  getCurrentSubscription,
  processWebhookEvent,
} from '../src/services/billing/service.js';

const EMAIL_A = `bill-a-${Date.now()}@nexus.test`;
const EMAIL_B = `bill-b-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';

let userA: string;
let orgA: string;
let cookieA: string;
let userB: string;
let orgB: string;
let cookieB: string;

async function register(email: string): Promise<{ userId: string; orgId: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: PASSWORD, displayName: 'Billing Test' });
  expect(res.status).toBe(201);
  return { userId: res.body.userId, orgId: res.body.orgId };
}

async function wipeTestData() {
  const testUsers = await db.select({ id: users.id, org: users.defaultOrgId }).from(users).where(like(users.email, '%@nexus.test'));
  for (const u of testUsers) {
    if (u.org) {
      await db.delete(billingEvents).where(eq(billingEvents.orgId, u.org));
      await db.delete(subscriptions).where(eq(subscriptions.orgId, u.org));
      await db.delete(usageQuotas).where(eq(usageQuotas.orgId, u.org));
    }
  }
}

beforeAll(async () => {
  await seedTierPolicies();
  await seedPlans();

  const a = await register(EMAIL_A);
  userA = a.userId; orgA = a.orgId;
  cookieA = await loginAndGetCookie(EMAIL_A, PASSWORD);

  const b = await register(EMAIL_B);
  userB = b.userId; orgB = b.orgId;
  cookieB = await loginAndGetCookie(EMAIL_B, PASSWORD);

  await wipeTestData();
}, 60_000);

afterAll(async () => {
  await wipeTestData();
  await pool.end();
});

// ── Catálogo ────────────────────────────────────────────────────────────────────
describe('GET /api/billing/plans', () => {
  it('devuelve free/pro/team con precios y features (público, sin cookie)', async () => {
    const res = await request(app).get('/api/billing/plans');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.plans)).toBe(true);
    const tiers = res.body.plans.map((p: { tier: string }) => p.tier);
    expect(tiers).toEqual(['free', 'pro', 'team']);

    const pro = res.body.plans.find((p: { tier: string }) => p.tier === 'pro');
    expect(pro.priceCop).toBe(45000);
    expect(pro.popular).toBe(true);
    expect(Array.isArray(pro.features)).toBe(true);
    expect(pro.features.length).toBeGreaterThan(0);

    const free = res.body.plans.find((p: { tier: string }) => p.tier === 'free');
    expect(free.priceCop).toBe(0);

    // SEAM: sin token, mpConfigured=false.
    expect(res.body.mpConfigured).toBe(false);
  });
});

// ── Suscripción actual ────────────────────────────────────────────────────────────
describe('GET /api/billing/subscription', () => {
  it('un usuario nuevo (free) ve su suscripción + uso vs límites', async () => {
    const res = await request(app).get('/api/billing/subscription').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const sub = res.body.subscription;
    expect(sub.tier).toBe('free');
    expect(sub.status).toBe('active');
    expect(sub.cancelAtPeriodEnd).toBe(false);
    expect(sub.plan.tier).toBe('free');
    const metrics = sub.quotas.map((q: { metric: string }) => q.metric);
    expect(metrics).toContain('messages');
    expect(metrics).toContain('voice_seconds');
    expect(metrics).toContain('vault_bytes');
  });

  it('requiere autenticación (401 sin cookie)', async () => {
    const res = await request(app).get('/api/billing/subscription');
    expect(res.status).toBe(401);
  });
});

// ── changeTier re-siembra cuotas preservando uso ────────────────────────────────
describe('changeTier (free → pro)', () => {
  it('actualiza tier de org + users y ajusta límites preservando lo consumido', async () => {
    // Consume algo en el periodo actual con el tier free.
    await recordUsage(orgA, 'free', 'messages', 50);
    const period = currentPeriod();

    // Límite free de messages (200) y consumo 50.
    const before = await getCurrentSubscription(orgA);
    const msgBefore = before.quotas.find((q) => q.metric === 'messages')!;
    expect(msgBefore.limit).toBe(200);
    expect(msgBefore.used).toBe(50);

    const result = await changeTier(orgA, 'pro', { provider: 'simulated' });
    expect(result.tier).toBe('pro');

    // org.tier y users.tier actualizados.
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgA)).limit(1);
    expect(org!.tier).toBe('pro');
    const [u] = await db.select().from(users).where(eq(users.id, userA)).limit(1);
    expect(u!.tier).toBe('pro');

    // usage_quotas: limit subió a pro (5000) PERO used se preserva (50).
    const after = await getCurrentSubscription(orgA);
    const msgAfter = after.quotas.find((q) => q.metric === 'messages')!;
    expect(msgAfter.limit).toBe(5000);
    expect(msgAfter.used).toBe(50);

    // Voz: free=0 → pro=18000.
    const voiceAfter = after.quotas.find((q) => q.metric === 'voice_seconds')!;
    expect(voiceAfter.limit).toBe(18000);

    // La fila de la DB refleja el nuevo límite del periodo.
    const dbRows = await db
      .select()
      .from(usageQuotas)
      .where(eq(usageQuotas.orgId, orgA));
    const msgRow = dbRows.find((r) => r.metric === 'messages' && r.period === period && r.userId === null)!;
    expect(Number(msgRow.limitValue)).toBe(5000);
    expect(Number(msgRow.usedValue)).toBe(50);
  });

  it('downgrade pro → free baja el techo pero NO borra el consumo', async () => {
    // Aún hay 50 usados de la prueba anterior; baja a free (limit 200).
    await changeTier(orgA, 'free', { provider: 'simulated', status: 'active' });
    const after = await getCurrentSubscription(orgA);
    const msg = after.quotas.find((q) => q.metric === 'messages')!;
    expect(msg.limit).toBe(200);
    expect(msg.used).toBe(50); // se preserva
    // Vuelve a pro para el resto de pruebas de A no dependientes.
    await changeTier(orgA, 'free', { provider: 'simulated' });
  });
});

// ── Checkout SEAM + simulate ──────────────────────────────────────────────────────
describe('POST /api/billing/checkout', () => {
  it('sin MercadoPago configurado → 503 billing_not_configured', async () => {
    const res = await request(app).post('/api/billing/checkout').set('Cookie', cookieB).send({ tier: 'pro' });
    expect(res.status).toBe(503);
    expect(res.body.error).toBe('billing_not_configured');
    expect(res.body.canSimulate).toBe(true); // dev/test
  });

  it('tier inválido → 400', async () => {
    const res = await request(app).post('/api/billing/checkout').set('Cookie', cookieB).send({ tier: 'enterprise' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid_tier');
  });

  it('free no requiere checkout → 400', async () => {
    const res = await request(app).post('/api/billing/checkout').set('Cookie', cookieB).send({ tier: 'free' });
    expect(res.status).toBe(400);
  });

  it('?simulate=1 aplica el cambio (B free → team) y refresca cuotas', async () => {
    const res = await request(app)
      .post('/api/billing/checkout?simulate=1')
      .set('Cookie', cookieB)
      .send({ tier: 'team' });
    expect(res.status).toBe(200);
    expect(res.body.simulated).toBe(true);
    expect(res.body.subscription.tier).toBe('team');

    // org.tier de B actualizado a team.
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgB)).limit(1);
    expect(org!.tier).toBe('team');

    // Quedó un billing_event simulado.
    const evts = await db.select().from(billingEvents).where(eq(billingEvents.orgId, orgB));
    expect(evts.some((e) => e.eventType === 'simulated.change')).toBe(true);
  });
});

// ── Cancel ──────────────────────────────────────────────────────────────────────
describe('POST /api/billing/cancel', () => {
  it('marca cancel_at_period_end en la suscripción de B (team)', async () => {
    const res = await request(app).post('/api/billing/cancel').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    expect(res.body.subscription.cancelAtPeriodEnd).toBe(true);
    // Sigue siendo team hasta fin de periodo (no degrada al instante).
    expect(res.body.subscription.tier).toBe('team');
  });
});

// ── Webhook idempotente ────────────────────────────────────────────────────────────
describe('Webhook MercadoPago (idempotencia)', () => {
  it('procesa payment.approved una vez; el mismo event id NO re-aplica', async () => {
    // Reset A a free para tener un punto de partida claro.
    await changeTier(orgA, 'free', { provider: 'simulated' });

    const evtId = `mp-evt-${Date.now()}`;
    const event = {
      providerEventId: evtId,
      type: 'payment.approved' as const,
      orgId: orgA,
      tier: 'pro',
      raw: { id: evtId, metadata: { org_id: orgA, tier: 'pro' } },
    };

    const first = await processWebhookEvent(event);
    expect(first.processed).toBe(true);
    if (first.processed) expect(first.tier).toBe('pro');

    const [orgAfter1] = await db.select().from(organizations).where(eq(organizations.id, orgA)).limit(1);
    expect(orgAfter1!.tier).toBe('pro');

    // Reenvío del MISMO evento → duplicate, no re-procesa.
    const second = await processWebhookEvent(event);
    expect(second.processed).toBe(false);
    if (!second.processed) expect(second.reason).toBe('duplicate');

    // Solo una fila de billing_event con ese provider_event_id.
    const evts = await db.select().from(billingEvents).where(eq(billingEvents.providerEventId, evtId));
    expect(evts.length).toBe(1);
  });

  it('subscription.cancelled degrada a free', async () => {
    const evtId = `mp-cancel-${Date.now()}`;
    const out = await processWebhookEvent({
      providerEventId: evtId,
      type: 'subscription.cancelled',
      orgId: orgA,
      tier: null,
      raw: { id: evtId },
    });
    expect(out.processed).toBe(true);
    const [org] = await db.select().from(organizations).where(eq(organizations.id, orgA)).limit(1);
    expect(org!.tier).toBe('free');
  });
});

// ── Aislamiento cross-tenant ──────────────────────────────────────────────────────
describe('Aislamiento de facturación', () => {
  it('el cambio de plan de A no afecta el de B', async () => {
    // A pasa a pro vía simulate; B debe conservar su estado.
    const bBefore = await getCurrentSubscription(orgB);
    await request(app).post('/api/billing/checkout?simulate=1').set('Cookie', cookieA).send({ tier: 'pro' });
    const bAfter = await getCurrentSubscription(orgB);
    expect(bAfter.tier).toBe(bBefore.tier);
    expect(bAfter.cancelAtPeriodEnd).toBe(bBefore.cancelAtPeriodEnd);

    const [orgBRow] = await db.select().from(organizations).where(eq(organizations.id, orgB)).limit(1);
    const [orgARow] = await db.select().from(organizations).where(eq(organizations.id, orgA)).limit(1);
    expect(orgARow!.tier).toBe('pro');
    expect(orgBRow!.tier).toBe(bBefore.tier);
  });
});
