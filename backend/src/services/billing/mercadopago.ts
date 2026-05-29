/**
 * mercadopago.ts — cliente SEAM de MercadoPago (Hito 5).
 *
 * ────────────────────────────────────────────────────────────────────────────
 * ESTADO: INACTIVO mientras MERCADOPAGO_ACCESS_TOKEN esté vacío (lo está hoy).
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Mientras no haya token, TODAS las funciones de red devuelven un resultado
 * explícito { ok: false, code: 'billing_not_configured' } en vez de lanzar o
 * llamar a la API real. La estructura está lista para activarse:
 *
 *   - createCheckoutPreference(): pago único (Checkout Pro / preference).
 *   - createPreapproval(): suscripción recurrente (preapproval/preapproval_plan).
 *   - validateWebhookSignature(): valida el x-signature de MP (HMAC) con
 *     MERCADOPAGO_WEBHOOK_SECRET cuando exista.
 *
 * ── CÓMO ACTIVAR (pasos para Jerson) ──────────────────────────────────────────
 *  1. Crear app en https://www.mercadopago.com.co/developers/panel
 *  2. SANDBOX: copiar el Access Token de PRUEBA (TEST-...) →
 *     MERCADOPAGO_ACCESS_TOKEN en .env. Probar con tarjetas de test de MP.
 *  3. PROD: reemplazar por el Access Token de PRODUCCIÓN (APP_USR-...).
 *  4. Crear los preapproval_plan (Pro / Team) en MP y poner sus ids en
 *     plans.mp_preapproval_plan_id (env MP_PLAN_PRO / MP_PLAN_TEAM o UPDATE).
 *  5. Configurar Webhooks en el panel de MP apuntando a:
 *       {PUBLIC_BASE_URL}/billing/webhook/mp
 *     y copiar el "Secret" del webhook → MERCADOPAGO_WEBHOOK_SECRET.
 *  6. Reiniciar el backend para releer el env.
 *
 * NOTA: este módulo NO importa el SDK oficial todavía (evita una dependencia
 * pesada inactiva). Cuando se active, sustituir los TODO por fetch a la API REST
 * de MP (https://api.mercadopago.com) o `mercadopago` npm. La firma de las
 * funciones públicas no cambiará.
 */
import crypto from 'node:crypto';
import { env } from '../../lib/env.js';

export type BillingTier = 'pro' | 'team';

export interface MpNotConfigured {
  ok: false;
  code: 'billing_not_configured';
  message: string;
}

export interface MpCheckoutResult {
  ok: true;
  checkoutUrl: string;
  preferenceId: string;
}

export interface MpPreapprovalResult {
  ok: true;
  preapprovalId: string;
  initPoint: string;
}

const NOT_CONFIGURED_MSG =
  'Los pagos con MercadoPago todavía no están activos en este servidor.';

/** ¿Está MercadoPago configurado (hay access token)? */
export function mpConfigured(): boolean {
  return env.MERCADOPAGO_ACCESS_TOKEN.trim().length > 0;
}

function notConfigured(): MpNotConfigured {
  return { ok: false, code: 'billing_not_configured', message: NOT_CONFIGURED_MSG };
}

/**
 * Crea una preferencia de Checkout Pro (pago único) para un plan.
 * SEAM: sin token devuelve billing_not_configured. Estructura lista para la API.
 */
export async function createCheckoutPreference(
  orgId: string,
  tier: BillingTier,
  opts: { priceCop: number; title: string; payerEmail?: string }
): Promise<MpCheckoutResult | MpNotConfigured> {
  if (!mpConfigured()) return notConfigured();

  // TODO-ACTIVAR-MP(preference): POST https://api.mercadopago.com/checkout/preferences
  //   headers: { Authorization: `Bearer ${env.MERCADOPAGO_ACCESS_TOKEN}` }
  //   body: {
  //     items: [{ title: opts.title, quantity: 1, currency_id: 'COP', unit_price: opts.priceCop }],
  //     metadata: { org_id: orgId, tier },
  //     back_urls: {
  //       success: `${env.PUBLIC_BASE_URL}/m/cuenta?billing=success`,
  //       failure: `${env.PUBLIC_BASE_URL}/m/upgrade?billing=failure`,
  //       pending: `${env.PUBLIC_BASE_URL}/m/cuenta?billing=pending`,
  //     },
  //     auto_return: 'approved',
  //     notification_url: `${env.PUBLIC_BASE_URL}/billing/webhook/mp`,
  //   }
  //   → { id, init_point } ; checkoutUrl = init_point
  void orgId;
  void tier;
  void opts;
  throw new Error('[mercadopago] createCheckoutPreference: activación pendiente (token presente pero API no integrada).');
}

/**
 * Crea una suscripción recurrente (preapproval) ligada a un preapproval_plan.
 * SEAM: sin token devuelve billing_not_configured.
 */
export async function createPreapproval(
  orgId: string,
  tier: BillingTier,
  opts: { preapprovalPlanId: string; payerEmail: string }
): Promise<MpPreapprovalResult | MpNotConfigured> {
  if (!mpConfigured()) return notConfigured();

  // TODO-ACTIVAR-MP(preapproval): POST https://api.mercadopago.com/preapproval
  //   body: {
  //     preapproval_plan_id: opts.preapprovalPlanId,
  //     payer_email: opts.payerEmail,
  //     external_reference: orgId,
  //     back_url: `${env.PUBLIC_BASE_URL}/m/cuenta?billing=success`,
  //   }
  //   → { id, init_point } ; preapprovalId = id
  void orgId;
  void tier;
  void opts;
  throw new Error('[mercadopago] createPreapproval: activación pendiente (token presente pero API no integrada).');
}

/**
 * Valida la firma del webhook de MercadoPago.
 *
 * MP envía cabeceras `x-signature` (ts=...,v1=...) y `x-request-id`. La firma se
 * valida como HMAC-SHA256 sobre `id:{dataId};request-id:{xRequestId};ts:{ts};`
 * usando MERCADOPAGO_WEBHOOK_SECRET.
 *
 * Política SEAM:
 *  - Sin secret configurado → devuelve { valid: true, validated: false } para
 *    no bloquear en entornos sin firma (el webhook igual hace ACK e idempotencia
 *    por event id). En producción con secret, una firma inválida → valid:false.
 */
export function validateWebhookSignature(input: {
  xSignature?: string;
  xRequestId?: string;
  dataId?: string;
}): { valid: boolean; validated: boolean } {
  const secret = env.MERCADOPAGO_WEBHOOK_SECRET.trim();
  if (!secret) return { valid: true, validated: false };

  const { xSignature, xRequestId, dataId } = input;
  if (!xSignature || !dataId) return { valid: false, validated: true };

  // x-signature: "ts=1700000000,v1=hexdigest"
  const parts = Object.fromEntries(
    xSignature.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k?.trim(), v?.trim()] as const;
    })
  );
  const ts = parts['ts'];
  const v1 = parts['v1'];
  if (!ts || !v1) return { valid: false, validated: true };

  const manifest = `id:${dataId};request-id:${xRequestId ?? ''};ts:${ts};`;
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex');
  // timingSafeEqual exige buffers de igual longitud.
  const a = Buffer.from(expected);
  const b = Buffer.from(v1);
  const valid = a.length === b.length && crypto.timingSafeEqual(a, b);
  return { valid, validated: true };
}
