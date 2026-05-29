/**
 * Rutas de facturación (Hito 5 — monetización con MercadoPago, SEAM).
 *
 * Authed (montadas en /api/billing, authJwt + tenantContext):
 *   GET  /plans          → catálogo comercial (precios/features). [público-ok]
 *   GET  /subscription   → suscripción actual del org + uso vs límites.
 *   POST /checkout {tier} → crea preferencia MP y devuelve {checkoutUrl}; si MP
 *                           no está configurado → 503 billing_not_configured.
 *                           En DEV (NODE_ENV!=production) admite ?simulate=1 que
 *                           aplica changeTier directo + registra billing_event.
 *   POST /cancel         → marca cancel_at_period_end.
 *
 * Público (montado en /billing/webhook/mp, SIN authJwt):
 *   POST /  → webhook de MercadoPago. Valida firma (cuando exista secret),
 *             procesa el evento idempotente y aplica el cambio. Si MP no está
 *             configurado, hace ACK 200 pero NO procesa (loggea).
 *
 * El catálogo /plans se expone también sin auth para la landing/pantalla previa
 * al login; el resto exige sesión.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import { setSessionCookie } from '../lib/jwt.js';
import { env } from '../lib/env.js';
import {
  listPlans,
  getCurrentSubscription,
  changeTier,
  cancelAtPeriodEnd,
  processWebhookEvent,
  recordBillingEvent,
  isTier,
  BillingError,
  type Tier,
} from '../services/billing/service.js';
import {
  mpConfigured,
  createCheckoutPreference,
  validateWebhookSignature,
  type BillingTier,
} from '../services/billing/mercadopago.js';
import { db } from '../db/index.js';
import { plans, users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// ── Router PÚBLICO de catálogo (sin auth) ────────────────────────────────────
export const billingPublicRouter = Router();

billingPublicRouter.get('/plans', async (_req: Request, res: Response) => {
  try {
    const rows = await listPlans();
    res.json({ plans: rows, mpConfigured: mpConfigured() });
  } catch (err) {
    console.error('[billing] listPlans error:', err);
    res.status(500).json({ error: 'No se pudo cargar el catálogo de planes.' });
  }
});

// ── Router AUTHED (suscripción/checkout/cancel) ──────────────────────────────
export const billingRouter = Router();
billingRouter.use(authJwt, tenantContext);

// GET /api/billing/subscription
billingRouter.get('/subscription', async (req: Request, res: Response) => {
  try {
    const view = await getCurrentSubscription(req.tenant!.orgId);
    res.json({ subscription: view });
  } catch (err) {
    handle(err, res, 'No se pudo cargar tu suscripción.');
  }
});

const checkoutSchema = z.object({ tier: z.string() });

// POST /api/billing/checkout  body {tier}  ?simulate=1 (solo dev)
billingRouter.post('/checkout', async (req: Request, res: Response) => {
  try {
    const { tier } = checkoutSchema.parse(req.body);
    if (!isTier(tier)) {
      res.status(400).json({ error: 'invalid_tier', message: 'Plan no válido.' });
      return;
    }
    if (tier === 'free') {
      res.status(400).json({ error: 'invalid_tier', message: 'El plan Free no requiere checkout.' });
      return;
    }

    const orgId = req.tenant!.orgId;
    const simulate = req.query.simulate === '1' || req.query.simulate === 'true';

    // DEV/demo: simular el cambio sin MercadoPago real.
    if (simulate && !env.isProd) {
      const result = await changeTier(orgId, tier as Tier, { provider: 'simulated', status: 'active' });
      await recordBillingEvent({
        orgId,
        provider: 'simulated',
        eventType: 'simulated.change',
        payload: { tier, userId: req.tenant!.userId },
        processed: true,
      });
      // Refresca la cookie de sesión para que el nuevo tier surta efecto sin
      // re-login (el JWT lleva el tier; sin esto, el token viejo seguiría free).
      setSessionCookie(req, res, { sub: req.tenant!.userId, orgId, tier });
      res.json({ ok: true, simulated: true, subscription: await getCurrentSubscription(orgId), changed: result });
      return;
    }

    // Camino real: requiere MercadoPago configurado.
    if (!mpConfigured()) {
      res.status(503).json({
        error: 'billing_not_configured',
        message: 'Los pagos con MercadoPago todavía no están activos. Vuelve pronto.',
        canSimulate: !env.isProd,
      });
      return;
    }

    const [plan] = await db.select().from(plans).where(eq(plans.tier, tier)).limit(1);
    const [user] = await db.select().from(users).where(eq(users.id, req.tenant!.userId)).limit(1);
    const pref = await createCheckoutPreference(orgId, tier as BillingTier, {
      priceCop: plan ? plan.priceCop : 0,
      title: `NEXUS ${plan?.name ?? tier}`,
      payerEmail: user?.email,
    });
    if (!pref.ok) {
      res.status(503).json({ error: pref.code, message: pref.message, canSimulate: !env.isProd });
      return;
    }
    await recordBillingEvent({
      orgId,
      provider: 'mercadopago',
      eventType: 'checkout.created',
      payload: { tier, preferenceId: pref.preferenceId },
      processed: false,
    });
    res.json({ ok: true, checkoutUrl: pref.checkoutUrl, preferenceId: pref.preferenceId });
  } catch (err) {
    handle(err, res, 'No se pudo iniciar el pago.');
  }
});

// POST /api/billing/cancel
billingRouter.post('/cancel', async (req: Request, res: Response) => {
  try {
    const view = await cancelAtPeriodEnd(req.tenant!.orgId);
    res.json({ ok: true, subscription: view });
  } catch (err) {
    handle(err, res, 'No se pudo cancelar tu plan.');
  }
});

// ── Webhook PÚBLICO de MercadoPago ────────────────────────────────────────────
export const billingWebhookRouter = Router();

/**
 * POST /billing/webhook/mp
 *
 * MP envía notificaciones (topic/type=payment|subscription). El cuerpo varía;
 * normalizamos lo esencial. Idempotencia por el id del evento/data.
 *
 * Si MP no está configurado (sin token): ACK 200 pero NO procesa (loggea).
 */
billingWebhookRouter.post('/', async (req: Request, res: Response) => {
  // Inactivo sin token: ACK para que MP no reintente, pero no se procesa.
  if (!mpConfigured()) {
    console.warn('[billing:webhook] recibido sin procesar: billing no configurado (sin MERCADOPAGO_ACCESS_TOKEN).');
    res.status(200).json({ received: true, processed: false, reason: 'billing_not_configured' });
    return;
  }

  // Validación de firma (cuando hay secret). Sin secret → validated:false (no bloquea).
  const dataId = (req.body?.data?.id ?? req.query['data.id'] ?? req.query.id) as string | undefined;
  const sig = validateWebhookSignature({
    xSignature: req.headers['x-signature'] as string | undefined,
    xRequestId: req.headers['x-request-id'] as string | undefined,
    dataId,
  });
  if (!sig.valid) {
    console.warn('[billing:webhook] firma inválida — rechazado');
    res.status(401).json({ received: true, processed: false, reason: 'invalid_signature' });
    return;
  }

  try {
    // Normaliza el evento. MP manda { type|topic, data:{id}, ... }. El mapeo a
    // org/tier real se resuelve consultando la API de MP por el id del recurso
    // (pendiente de activar); aquí aceptamos org/tier en metadata si vienen.
    const type: string = req.body?.type ?? req.body?.action ?? req.body?.topic ?? 'unknown';
    const meta = req.body?.metadata ?? req.body?.data?.metadata ?? {};
    const providerEventId: string | null =
      req.body?.id?.toString() ?? (dataId ? `data:${dataId}` : null);

    const outcome = await processWebhookEvent({
      providerEventId,
      type,
      orgId: meta.org_id ?? meta.orgId ?? null,
      tier: meta.tier ?? null,
      raw: req.body,
    });

    // Siempre ACK 200 a MP (incluso unhandled/duplicate) para evitar reintentos.
    res.status(200).json({ received: true, ...outcome });
  } catch (err) {
    console.error('[billing:webhook] error procesando:', err);
    // 200 igual: registramos el fallo pero no pedimos reintento infinito.
    res.status(200).json({ received: true, processed: false, reason: 'error' });
  }
});

// ── Helper de errores ─────────────────────────────────────────────────────────
function handle(err: unknown, res: Response, fallback: string): void {
  if (err instanceof BillingError) {
    res.status(err.status).json({ error: err.code, message: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'invalid_input', issues: err.flatten().fieldErrors });
    return;
  }
  console.error('[billing] error:', err);
  res.status(500).json({ error: 'server_error', message: fallback });
}
