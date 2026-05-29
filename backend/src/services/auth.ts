/**
 * Servicio de autenticación multiusuario.
 *
 * register(): crea de forma transaccional users + organizations personal +
 * org_members(owner) + user_settings default + cuotas del periodo según tier,
 * y luego provisiona el directorio aislado del usuario en el filesystem.
 *
 * La provisión de filesystem se hace DESPUÉS de commitear la fila para tener
 * userId/orgId estables; si falla, se loguea pero no rompe el registro (el env
 * se puede reprovisionar de forma idempotente). Anotado como deuda menor.
 */
import bcrypt from 'bcryptjs';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users,
  organizations,
  orgMembers,
  userSettings,
  usageQuotas,
  tierPolicies,
} from '../db/schema.js';
import { provisionUserEnv } from './userEnv.js';

const BCRYPT_ROUNDS = 12;

/**
 * Cuotas base por tier. FUENTE ÚNICA DE VERDAD = tier_policies (DB).
 * Se leen en runtime para no duplicar valores; el fallback solo cubre el caso
 * (improbable) de que tier_policies aún no esté sembrada.
 */
async function tierQuotas(tier: string): Promise<Record<string, number>> {
  const [p] = await db.select().from(tierPolicies).where(eq(tierPolicies.tier, tier)).limit(1);
  if (p) {
    return {
      messages: Number(p.quotaMessages),
      voice_seconds: Number(p.quotaVoiceSeconds),
      vault_bytes: Number(p.quotaVaultBytes),
    };
  }
  // Fallback defensivo (tier_policies sin sembrar): valores conservadores free.
  return { messages: 200, voice_seconds: 0, vault_bytes: 200 * 1024 * 1024 };
}

export class AuthError extends Error {
  constructor(public status: number, message: string) {
    super(message);
    this.name = 'AuthError';
  }
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function slugify(base: string): string {
  return (
    base
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32) || 'org'
  );
}

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface AuthResult {
  userId: string;
  orgId: string;
  tier: string;
}

export async function registerUser(input: RegisterInput): Promise<AuthResult> {
  const email = input.email.trim().toLowerCase();

  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    throw new AuthError(409, 'Ya existe una cuenta con ese correo.');
  }

  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  const tier = 'free';
  const quotas = await tierQuotas(tier);

  const result = await db.transaction(async (tx) => {
    // 1. Crear usuario (default_org_id se rellena después).
    const [user] = await tx
      .insert(users)
      .values({ email, passwordHash, displayName: input.displayName, tier })
      .returning();
    if (!user) throw new AuthError(500, 'No se pudo crear el usuario.');

    // 2. Organización personal con slug único.
    let slug = slugify(input.displayName || email.split('@')[0]!);
    const slugTaken = await tx
      .select({ id: organizations.id })
      .from(organizations)
      .where(eq(organizations.slug, slug))
      .limit(1);
    if (slugTaken.length > 0) slug = `${slug}-${user.id.slice(0, 8)}`;

    const [org] = await tx
      .insert(organizations)
      .values({ slug, name: `${input.displayName} (personal)`, tier, ownerUserId: user.id })
      .returning();
    if (!org) throw new AuthError(500, 'No se pudo crear la organización.');

    // 3. Enlazar default_org_id y membership owner.
    await tx.update(users).set({ defaultOrgId: org.id }).where(eq(users.id, user.id));
    await tx.insert(orgMembers).values({ orgId: org.id, userId: user.id, role: 'owner' });

    // 4. user_settings default.
    await tx.insert(userSettings).values({ userId: user.id });

    // 5. Cuotas del periodo actual (a nivel org, user_id NULL = global de la org).
    const period = currentPeriod();
    await tx.insert(usageQuotas).values(
      Object.entries(quotas).map(([metric, limitValue]) => ({
        orgId: org.id,
        userId: null,
        period,
        metric,
        limitValue,
      }))
    );

    return { userId: user.id, orgId: org.id, tier };
  });

  // 6. Provisionar entorno aislado en filesystem (fuera de la tx de DB).
  try {
    await provisionUserEnv(result);
  } catch (err) {
    console.error('[auth] provisionUserEnv falló (reprovisionable):', err);
  }

  return result;
}

export async function loginUser(emailRaw: string, password: string): Promise<AuthResult> {
  const email = emailRaw.trim().toLowerCase();
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user) throw new AuthError(401, 'Credenciales incorrectas.');

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new AuthError(401, 'Credenciales incorrectas.');

  await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

  const orgId = user.defaultOrgId;
  if (!orgId) throw new AuthError(500, 'Usuario sin organización por defecto.');

  return { userId: user.id, orgId, tier: user.tier };
}

/** Devuelve user + org + tier + quotas del periodo actual (para /me). */
export async function getMe(userId: string) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AuthError(404, 'Usuario no encontrado.');

  const orgId = user.defaultOrgId;
  const [org] = orgId
    ? await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1)
    : [undefined];

  const period = currentPeriod();
  const quotas = orgId
    ? await db
        .select()
        .from(usageQuotas)
        .where(and(eq(usageQuotas.orgId, orgId), eq(usageQuotas.period, period)))
    : [];

  return {
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      locale: user.locale,
      tier: user.tier,
      telegramChatId: user.telegramChatId,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
    },
    org: org ? { id: org.id, slug: org.slug, name: org.name, tier: org.tier } : null,
    tier: user.tier,
    quotas: quotas.map((q) => ({
      metric: q.metric,
      period: q.period,
      limit: Number(q.limitValue),
      used: Number(q.usedValue),
    })),
  };
}

// Re-export para tests/seed que necesiten hashear directamente.
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}
