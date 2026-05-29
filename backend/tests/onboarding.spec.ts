/**
 * Onboarding de usuario nuevo (Hito 1 — Track C).
 *
 * Cubre:
 *  - registerUser siembra el roster base (3 agentes) y fija primary_agent_id.
 *  - el env del usuario nuevo queda provisionado con las plantillas del vault.
 *  - NO-REGRESIÓN: Jerson (user_001) conserva sus 9 agentes (no se le toca).
 *  - GET/PATCH /api/users/me (perfil editable).
 *
 * Limpieza: borra SOLO el usuario de prueba por email exacto. Jerson intacto.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import { eq, count } from 'drizzle-orm';
import { app, loginAndGetCookie } from './helpers.js';
import { pool, db } from '../src/db/index.js';
import { users, agents, userSettings } from '../src/db/schema.js';
import { resolveUserPaths } from '../src/services/userEnv.js';
import { BASE_AGENTS } from '../src/services/baseAgents.js';
import { seedTierPolicies } from '../src/db/seedTierPolicies.js';

const EMAIL = `onb-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';
const JERSON_EMAIL = 'jersonmendoza@eyesa.com.co';
let createdUserId: string | null = null;

beforeAll(async () => {
  await seedTierPolicies(); // catálogo de tiers (cuotas base) requerido por register
});

afterAll(async () => {
  if (createdUserId) {
    const paths = await resolveUserPaths(createdUserId);
    await db.delete(users).where(eq(users.id, createdUserId));
    if (paths) await fs.rm(paths.root, { recursive: true, force: true });
  }
  await pool.end();
});

describe('onboarding — roster base del usuario nuevo', () => {
  let cookie = '';

  it('register crea la cuenta (201) y la sesión', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: EMAIL, password: PASSWORD, displayName: 'Usuario Nuevo' });
    expect(res.status).toBe(201);
    createdUserId = res.body.userId;
    cookie = await loginAndGetCookie(EMAIL, PASSWORD);
  });

  it('el usuario nuevo tiene exactamente los 3 agentes base', async () => {
    const res = await request(app).get('/api/agents').set('Cookie', cookie);
    expect(res.status).toBe(200);
    const names = (res.body.agents as { name: string }[]).map((a) => a.name).sort();
    expect(names).toEqual([...BASE_AGENTS].map((a) => a.name).sort());
    // Todos opencode + con system prompt en runtimeConfig.
    for (const a of res.body.agents as { adapterType: string; runtimeConfig: { systemPrompt?: string } }[]) {
      expect(a.adapterType).toBe('opencode');
      expect(typeof a.runtimeConfig.systemPrompt).toBe('string');
      expect((a.runtimeConfig.systemPrompt ?? '').length).toBeGreaterThan(20);
    }
  });

  it('primary_agent_id apunta al "Asistente Personal" recién creado', async () => {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, createdUserId!))
      .limit(1);
    expect(settings?.primaryAgentId).toBeTruthy();
    const [primary] = await db
      .select()
      .from(agents)
      .where(eq(agents.id, settings!.primaryAgentId!))
      .limit(1);
    expect(primary?.name).toBe('asistente-personal');
    expect(settings?.primaryAgentPrompt).toBeTruthy();
  });

  it('el env del usuario nuevo tiene las plantillas del vault', async () => {
    const paths = await resolveUserPaths(createdUserId!);
    expect(paths).not.toBeNull();
    const pref = await fs.readFile(`${paths!.vault}/Preferencias.md`, 'utf8');
    expect(pref).toContain('Preferencias');
  });
});

describe('onboarding — no-regresión: Jerson conserva sus 9 agentes', () => {
  it('user_001 (Jerson) sigue con 9 agentes', async () => {
    const [jerson] = await db.select().from(users).where(eq(users.email, JERSON_EMAIL)).limit(1);
    expect(jerson, 'Jerson debe existir (user_001)').toBeTruthy();
    const rows = await db
      .select({ value: count() })
      .from(agents)
      .where(eq(agents.userId, jerson!.id));
    expect(Number(rows[0]?.value)).toBe(9);
  });
});

describe('perfil — GET/PATCH /api/users/me', () => {
  let cookie = '';
  beforeAll(async () => {
    cookie = await loginAndGetCookie(EMAIL, PASSWORD);
  });

  it('GET /api/users/me devuelve el perfil editable', async () => {
    const res = await request(app).get('/api/users/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.email.toLowerCase()).toBe(EMAIL.toLowerCase());
    expect(res.body.user.displayName).toBe('Usuario Nuevo');
    expect(res.body.user.uiTheme).toBe('dark');
    expect(res.body.user.timezone).toBeTruthy();
  });

  it('PATCH /api/users/me actualiza displayName, locale, timezone y uiTheme', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookie)
      .send({ displayName: 'Nombre Editado', locale: 'es-MX', timezone: 'America/Mexico_City', uiTheme: 'light' });
    expect(res.status).toBe(200);
    expect(res.body.user.displayName).toBe('Nombre Editado');
    expect(res.body.user.locale).toBe('es-MX');
    expect(res.body.user.timezone).toBe('America/Mexico_City');
    expect(res.body.user.uiTheme).toBe('light');
  });

  it('PATCH rechaza campos desconocidos (strict) → 400', async () => {
    const res = await request(app)
      .patch('/api/users/me')
      .set('Cookie', cookie)
      .send({ tier: 'team' });
    expect(res.status).toBe(400);
  });

  it('GET /api/users/me sin sesión → 401', async () => {
    const res = await request(app).get('/api/users/me');
    expect(res.status).toBe(401);
  });
});
