/**
 * Seed de datos de prueba para tests de tenancy.
 *
 * Crea 2 usuarios:
 *   A → seed-a@nexus.test  (org A, tier free)
 *   B → seed-b@nexus.test  (org B, tier pro)
 * Cada uno con 3 agents, 2 projects, 3 issues, y su env de filesystem provisionado.
 *
 * Idempotente: si los usuarios ya existen, los borra (cascade) y recrea para
 * dejar un estado limpio y determinista en cada corrida de tests.
 */
import { eq, inArray } from 'drizzle-orm';
import { db, pool } from './index.js';
import { users, agents, projects, issues } from './schema.js';
import { registerUser } from '../services/auth.js';
import { provisionUserEnv } from '../services/userEnv.js';
import { seedTierPolicies } from './seedTierPolicies.js';

export const SEED_USERS = {
  A: { email: 'seed-a@nexus.test', password: 'passwordA123', displayName: 'Usuario A', tier: 'free' },
  B: { email: 'seed-b@nexus.test', password: 'passwordB123', displayName: 'Usuario B', tier: 'pro' },
} as const;

export interface SeededUser {
  userId: string;
  orgId: string;
  tier: string;
  email: string;
  password: string;
  agentIds: string[];
  projectIds: string[];
  issueIds: string[];
}

async function wipeExisting(): Promise<void> {
  const emails = [SEED_USERS.A.email, SEED_USERS.B.email];
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.email, emails));
  if (existing.length > 0) {
    // cascade borra org_members, user_settings, usage_quotas, agents, projects, issues.
    await db.delete(users).where(inArray(users.id, existing.map((u) => u.id)));
  }
}

async function seedDomainFor(
  key: 'A' | 'B',
  result: { userId: string; orgId: string; tier: string }
): Promise<SeededUser> {
  const { userId, orgId, tier } = result;

  const agentRows = await db
    .insert(agents)
    .values(
      [1, 2, 3].map((n) => ({
        userId,
        orgId,
        name: `agent-${key.toLowerCase()}-${n}`,
        displayName: `Agente ${key}${n}`,
        adapterType: tier === 'free' ? 'opencode' : 'claude-api',
      }))
    )
    .returning();

  const projectRows = await db
    .insert(projects)
    .values([1, 2].map((n) => ({ userId, orgId, name: `project-${key.toLowerCase()}-${n}` })))
    .returning();

  const issueRows = await db
    .insert(issues)
    .values(
      [1, 2, 3].map((n) => ({
        userId,
        orgId,
        projectId: projectRows[0]!.id,
        identifier: `${key}-${n}`,
        title: `Issue ${key}${n}`,
      }))
    )
    .returning();

  return {
    userId,
    orgId,
    tier,
    email: SEED_USERS[key].email,
    password: SEED_USERS[key].password,
    agentIds: agentRows.map((a) => a.id),
    projectIds: projectRows.map((p) => p.id),
    issueIds: issueRows.map((i) => i.id),
  };
}

export async function runSeed(): Promise<{ A: SeededUser; B: SeededUser }> {
  await seedTierPolicies(); // garantiza catálogo de tiers para pickAdapter/quota
  await wipeExisting();

  const a = await registerUser(SEED_USERS.A);
  const b = await registerUser(SEED_USERS.B);

  // Ajusta tier de B a 'pro' (registerUser crea siempre 'free').
  if (SEED_USERS.B.tier !== b.tier) {
    await db.update(users).set({ tier: SEED_USERS.B.tier }).where(eq(users.id, b.userId));
    b.tier = SEED_USERS.B.tier;
    await provisionUserEnv({ userId: b.userId, orgId: b.orgId, tier: b.tier }); // refresca .meta.json tier
  }

  const seededA = await seedDomainFor('A', a);
  const seededB = await seedDomainFor('B', b);

  return { A: seededA, B: seededB };
}

// Ejecución directa (npm run db:seed).
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop() ?? '');
if (isMain) {
  runSeed()
    .then((r) => {
      console.log('[seed] OK');
      console.log(`  A: ${r.A.email} user=${r.A.userId} agents=${r.A.agentIds.length}`);
      console.log(`  B: ${r.B.email} user=${r.B.userId} agents=${r.B.agentIds.length}`);
      return pool.end();
    })
    .catch((err) => {
      console.error('[seed] error:', err);
      process.exit(1);
    });
}
