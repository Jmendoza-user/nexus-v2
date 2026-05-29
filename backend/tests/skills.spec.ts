/**
 * Skills + Conexiones + AUTOCURE (Hito 2).
 *
 * Cubre:
 *  - Catálogo de skills (GET /api/skills/catalog).
 *  - Instalar / desinstalar (filesystem + DB), idempotencia.
 *  - Rechazo de path traversal en skillKey.
 *  - Conexiones: estado real (incl. telegram), OAuth 503 sin credenciales,
 *    roundtrip de cifrado de secretos (AES-256-GCM).
 *  - Aislamiento cross-tenant (A no ve skills/connections de B).
 *  - AUTOCURE — DEMOSTRACIÓN REAL: se instala una skill, se BORRA del disco,
 *    se dispara un run que la requiere, y se verifica que el autocure la
 *    REINSTALA y el run termina con éxito + filas en agent_repair_attempts.
 *
 * REAL vs SIMULADO:
 *  - REAL: loop detección→diagnóstico→acción→reinstalación→reintento→log,
 *    filesystem, DB, issue automático, clasificación de errores, fallback
 *    heurístico del reparador.
 *  - SIMULADO: la `runFn` del agente en el test de autocure unitario (un stub
 *    que falla si la skill no está en disco y tiene éxito si está). El endpoint
 *    POST /api/agents/:id/run usa el runFn de PRODUCCIÓN (gate de skills real +
 *    adapter), también probado E2E aquí.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq, and } from 'drizzle-orm';
import { app, loginAndGetCookie } from './helpers.js';
import { db, pool } from '../src/db/index.js';
import { users, agents, agentRepairAttempts, skillInstallations } from '../src/db/schema.js';
import { seedTierPolicies } from '../src/db/seedTierPolicies.js';
import { seedSkillsCatalog } from '../src/db/seedSkillsCatalog.js';
import { resolveUserPaths } from '../src/services/userEnv.js';
import { installSkill, isSkillOnDisk } from '../src/services/skills.js';
import { saveSecret, loadSecret } from '../src/services/connections.js';
import { runWithRepair, classifyError, type AgentRunFn } from '../src/services/ai/autocure.js';

const EMAIL_A = `skills-a-${Date.now()}@nexus.test`;
const EMAIL_B = `skills-b-${Date.now()}@nexus.test`;
const PASSWORD = 'password123';

let userA: string;
let orgA: string;
let cookieA: string;
let userB: string;
let cookieB: string;

async function register(email: string): Promise<{ userId: string; orgId: string }> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: PASSWORD, displayName: 'Skills Test' });
  expect(res.status).toBe(201);
  return { userId: res.body.userId, orgId: res.body.orgId };
}

beforeAll(async () => {
  await seedTierPolicies();
  await seedSkillsCatalog();
  const a = await register(EMAIL_A);
  userA = a.userId;
  orgA = a.orgId;
  cookieA = await loginAndGetCookie(EMAIL_A, PASSWORD);
  const b = await register(EMAIL_B);
  userB = b.userId;
  cookieB = await loginAndGetCookie(EMAIL_B, PASSWORD);
});

afterAll(async () => {
  for (const uid of [userA, userB]) {
    if (!uid) continue;
    const paths = await resolveUserPaths(uid);
    await db.delete(users).where(eq(users.id, uid));
    if (paths) await fs.rm(paths.root, { recursive: true, force: true });
  }
  await pool.end();
});

describe('Skills — catálogo e instalación', () => {
  it('GET /api/skills/catalog devuelve skills sembradas', async () => {
    const res = await request(app).get('/api/skills/catalog').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.catalog)).toBe(true);
    expect(res.body.catalog.length).toBeGreaterThanOrEqual(6);
    const keys = res.body.catalog.map((c: { key: string }) => c.key);
    expect(keys).toContain('buscador-web');
    expect(keys).toContain('resumidor');
  });

  it('instala una skill: escribe SKILL.md en el env y registra installed', async () => {
    const res = await request(app).post('/api/skills/buscador-web/install').set('Cookie', cookieA);
    expect(res.status).toBe(201);
    expect(res.body.installation.status).toBe('installed');
    expect(res.body.installation.skillKey).toBe('buscador-web');

    const paths = (await resolveUserPaths(userA))!;
    const md = path.join(paths.root, 'skills', 'buscador-web', 'SKILL.md');
    expect(existsSync(md)).toBe(true);
    expect(await fs.readFile(md, 'utf8')).toContain('Buscador web');
  });

  it('instalar es idempotente (segunda vez no duplica)', async () => {
    const res = await request(app).post('/api/skills/buscador-web/install').set('Cookie', cookieA);
    expect(res.status).toBe(201);
    const rows = await db
      .select()
      .from(skillInstallations)
      .where(and(eq(skillInstallations.userId, userA), eq(skillInstallations.skillKey, 'buscador-web')));
    expect(rows.length).toBe(1);
  });

  it('GET /api/skills lista las instaladas del tenant con datos de catálogo', async () => {
    const res = await request(app).get('/api/skills').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const inst = res.body.installed.find((i: { skillKey: string }) => i.skillKey === 'buscador-web');
    expect(inst).toBeTruthy();
    expect(inst.catalog.name).toBe('Buscador web');
  });

  it('rechaza skillKey desconocida con 404', async () => {
    const res = await request(app).post('/api/skills/no-existe-xyz/install').set('Cookie', cookieA);
    expect(res.status).toBe(404);
  });

  it('rechaza path traversal en skillKey con 400', async () => {
    // %2e%2e%2f → ../  (Express decodifica el param). Tras decodificar no matchea
    // el patrón estricto [a-z0-9-] → invalid_key 400.
    const res = await request(app)
      .post('/api/skills/%2e%2e%2fetc/install')
      .set('Cookie', cookieA);
    expect(res.status).toBe(400);
    // El env de A no debe contener nada fuera de skills/.
    const paths = (await resolveUserPaths(userA))!;
    expect(existsSync(path.join(path.dirname(paths.root), 'etc'))).toBe(false);
  });

  it('desinstala: borra dir + registro, idempotente', async () => {
    await request(app).post('/api/skills/resumidor/install').set('Cookie', cookieA).expect(201);
    const paths = (await resolveUserPaths(userA))!;
    expect(existsSync(path.join(paths.root, 'skills', 'resumidor'))).toBe(true);

    const del = await request(app).delete('/api/skills/resumidor').set('Cookie', cookieA);
    expect(del.status).toBe(200);
    expect(existsSync(path.join(paths.root, 'skills', 'resumidor'))).toBe(false);

    // Segunda vez → 404 (ya no estaba).
    const del2 = await request(app).delete('/api/skills/resumidor').set('Cookie', cookieA);
    expect(del2.status).toBe(404);
  });

  it('aislamiento: B no ve las skills instaladas por A', async () => {
    const res = await request(app).get('/api/skills').set('Cookie', cookieB);
    expect(res.status).toBe(200);
    const keys = res.body.installed.map((i: { skillKey: string }) => i.skillKey);
    expect(keys).not.toContain('buscador-web');
  });
});

describe('Conexiones', () => {
  it('GET /api/connections lista los 5 providers con estado', async () => {
    const res = await request(app).get('/api/connections').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    const providers = res.body.connections.map((c: { provider: string }) => c.provider);
    expect(providers).toEqual(
      expect.arrayContaining(['gmail', 'gcal', 'meta', 'telegram', 'mercadopago'])
    );
  });

  it('telegram aparece disconnected sin vincular', async () => {
    const res = await request(app).get('/api/connections/telegram').set('Cookie', cookieA);
    expect(res.status).toBe(200);
    expect(res.body.connection.status).toBe('disconnected');
  });

  it('oauth/start de gmail sin credenciales de Google → 503', async () => {
    const prevId = process.env.GOOGLE_OAUTH_CLIENT_ID;
    const prevSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    delete process.env.GOOGLE_OAUTH_CLIENT_ID;
    delete process.env.GOOGLE_OAUTH_CLIENT_SECRET;
    const res = await request(app).post('/api/connections/gmail/oauth/start').set('Cookie', cookieA);
    expect(res.status).toBe(503);
    expect(res.body.code).toBe('not_configured');
    if (prevId) process.env.GOOGLE_OAUTH_CLIENT_ID = prevId;
    if (prevSecret) process.env.GOOGLE_OAUTH_CLIENT_SECRET = prevSecret;
  });

  it('mercadopago oauth/start → 503 (próximamente)', async () => {
    const res = await request(app)
      .post('/api/connections/mercadopago/oauth/start')
      .set('Cookie', cookieA);
    expect(res.status).toBe(503);
  });

  it('provider inválido → 404', async () => {
    const res = await request(app).get('/api/connections/foobar').set('Cookie', cookieA);
    expect(res.status).toBe(404);
  });

  it('saveSecret cifra tokens en .enc y loadSecret los recupera (roundtrip)', async () => {
    const tokens = { access_token: 'ya29.SECRETO', refresh_token: '1//REFRESCO' };
    await saveSecret(userA, 'gmail', tokens, { account: 'jerson@example.com' });

    const paths = (await resolveUserPaths(userA))!;
    const encPath = path.join(paths.root, 'connections', 'gmail.enc');
    expect(existsSync(encPath)).toBe(true);
    // El archivo NO debe contener el token en claro.
    const raw = await fs.readFile(encPath, 'utf8');
    expect(raw).not.toContain('ya29.SECRETO');

    const back = await loadSecret(userA, 'gmail');
    expect(back).toEqual(tokens);

    // El estado pasa a active.
    const status = await request(app).get('/api/connections/gmail').set('Cookie', cookieA);
    expect(status.body.connection.status).toBe('active');
    expect(status.body.connection.hasSecret).toBe(true);
  });

  it('aislamiento: B no recupera el secreto de A', async () => {
    const back = await loadSecret(userB, 'gmail');
    expect(back).toBeNull();
  });
});

describe('classifyError', () => {
  it('detecta skill_missing y extrae la key', () => {
    const c = classifyError({ ok: false, output: 'skill "buscador-web" required: no instalada', exitCode: 1 });
    expect(c.errorClass).toBe('skill_missing');
    expect(c.skillKey).toBe('buscador-web');
  });
  it('detecta permission_denied', () => {
    const c = classifyError({ ok: false, output: 'permiso denegado para la conexión gmail', exitCode: 1 });
    expect(c.errorClass).toBe('permission_denied');
  });
  it('exit!=0 sin patrón → nonzero_exit', () => {
    const c = classifyError({ ok: false, output: 'boom', exitCode: 2 });
    expect(c.errorClass).toBe('nonzero_exit');
  });
});

describe('AUTOCURE — demostración real (skill borrada → reinstala → éxito)', () => {
  it('reinstala una skill borrada del disco y completa el run', async () => {
    // 1. Instala la skill y confirma que está en disco.
    await installSkill(userA, 'lector-pdf', 'registry');
    expect(await isSkillOnDisk(userA, 'lector-pdf')).toBe(true);

    // 2. BORRA la skill del disco (simula corrupción/borrado externo).
    const paths = (await resolveUserPaths(userA))!;
    await fs.rm(path.join(paths.root, 'skills', 'lector-pdf'), { recursive: true, force: true });
    expect(await isSkillOnDisk(userA, 'lector-pdf')).toBe(false);

    // 3. Crea un agente para A que requiere la skill.
    const [agent] = await db
      .insert(agents)
      .values({
        userId: userA,
        orgId: orgA,
        name: 'lector',
        displayName: 'Lector de documentos',
        adapterType: 'opencode',
        capabilities: [],
        runtimeConfig: {},
      })
      .returning();

    // 4. runFn SIMULADO: falla si la skill NO está en disco (con el patrón que
    //    el autocure clasifica como skill_missing); tiene éxito si está. Esto
    //    aísla el LOOP del modelo real — el loop sí es REAL.
    const runFn: AgentRunFn = async ({ userId }) => {
      const present = await isSkillOnDisk(userId, 'lector-pdf');
      if (!present) {
        return { ok: false, output: 'skill "lector-pdf" required para leer el PDF', exitCode: 1 };
      }
      return { ok: true, output: 'PDF leído: 3 páginas, total $1.250.000.', exitCode: 0 };
    };

    const result = await runWithRepair(userA, agent!.id, 'Lee este PDF y dame el total', {
      runFn,
      maxAttempts: 3,
      tier: 'free',
      orgId: orgA,
      agentName: 'Lector de documentos',
    });

    // 5. VERIFICACIONES del autocure real.
    expect(result.ok).toBe(true);
    expect(result.result).toContain('PDF leído');
    expect(result.attempts).toBe(2); // intento 1 falla+repara, intento 2 OK
    expect(await isSkillOnDisk(userA, 'lector-pdf')).toBe(true); // reinstalada

    // La skill quedó registrada con source=autocure.
    const [inst] = await db
      .select()
      .from(skillInstallations)
      .where(and(eq(skillInstallations.userId, userA), eq(skillInstallations.skillKey, 'lector-pdf')));
    expect(inst!.source).toBe('autocure');

    // Filas en agent_repair_attempts: al menos el intento de reparación + el éxito.
    const attempts = await db
      .select()
      .from(agentRepairAttempts)
      .where(eq(agentRepairAttempts.runId, result.runId));
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    const classes = attempts.map((a) => a.errorClass);
    expect(classes).toContain('skill_missing');
    const actions = attempts.map((a) => (a.action as { action?: string }).action);
    expect(actions).toContain('install_skill');
    const outcomes = attempts.map((a) => a.outcome);
    expect(outcomes).toContain('success');

    await db.delete(agents).where(eq(agents.id, agent!.id));
  });

  it('agota intentos cuando la skill NO existe en catálogo → gave_up + issue', async () => {
    const [agent] = await db
      .insert(agents)
      .values({
        userId: userA,
        orgId: orgA,
        name: 'roto',
        displayName: 'Agente roto',
        adapterType: 'opencode',
        capabilities: [],
        runtimeConfig: {},
      })
      .returning();

    // runFn siempre pide una skill que NO está en el catálogo → no se puede instalar.
    const runFn: AgentRunFn = async () => ({
      ok: false,
      output: 'skill "skill-fantasma" required y no existe',
      exitCode: 1,
    });

    const result = await runWithRepair(userA, agent!.id, 'haz algo imposible', {
      runFn,
      maxAttempts: 2,
      tier: 'free',
      orgId: orgA,
      agentName: 'Agente roto',
    });

    // El reparador no puede instalar (fuera de catálogo) → cae a ask_user o gave_up.
    expect(result.ok).toBe(false);
    // Si terminó por agotamiento, abre issue; si pidió al usuario, hay mensaje.
    expect(typeof result.message).toBe('string');
    expect(result.message.length).toBeGreaterThan(0);

    const attempts = await db
      .select()
      .from(agentRepairAttempts)
      .where(eq(agentRepairAttempts.runId, result.runId));
    expect(attempts.length).toBeGreaterThanOrEqual(1);

    await db.delete(agents).where(eq(agents.id, agent!.id));
  });

  it('POST /api/agents/:id/run E2E: gate de skills real dispara autocure', async () => {
    // Asegura skill instalada y luego la borra del disco para forzar el gate.
    await installSkill(userA, 'resumidor', 'registry');
    const paths = (await resolveUserPaths(userA))!;
    await fs.rm(path.join(paths.root, 'skills', 'resumidor'), { recursive: true, force: true });

    // Agente vía API que requiere la skill 'resumidor'.
    const created = await request(app)
      .post('/api/agents')
      .set('Cookie', cookieA)
      .send({
        name: 'sumario',
        displayName: 'Sumario',
        adapterType: 'opencode',
        runtimeConfig: { requiredSkills: ['resumidor'], systemPrompt: 'Responde solo: ok' },
      });
    expect(created.status).toBe(201);
    const agentId = created.body.agent.id;

    const run = await request(app)
      .post(`/api/agents/${agentId}/run`)
      .set('Cookie', cookieA)
      .send({ prompt: 'resume esto', maxAttempts: 3 });

    expect(run.status).toBe(200);
    // El gate detecta la skill faltante y el autocure la reinstala (acción real).
    // El run posterior invoca al adapter: si el gateway IA responde, ok=true;
    // si no hay red, ok=false PERO la skill ya fue reinstalada por el loop.
    expect(Array.isArray(run.body.repairLog)).toBe(true);
    expect(await isSkillOnDisk(userA, 'resumidor')).toBe(true); // reinstalada por autocure
    const installAction = run.body.repairLog.some(
      (e: { action?: { action?: string } }) => e.action?.action === 'install_skill'
    );
    expect(installAction).toBe(true);

    await db.delete(agents).where(eq(agents.id, agentId));
  });
});
