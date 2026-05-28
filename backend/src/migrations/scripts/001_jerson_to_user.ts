/**
 * 001_jerson_to_user.ts — Migración NEXUS V1 → V2: convierte el setup de Jerson
 * en user_001 (cuenta canónica, org "J4 Smart Solutions").
 *
 * USO:
 *   tsx src/migrations/scripts/001_jerson_to_user.ts --dry-run   (default, NO escribe nada)
 *   tsx src/migrations/scripts/001_jerson_to_user.ts --execute   (migración real)
 *   tsx src/migrations/scripts/001_jerson_to_user.ts --execute --ts 20260528-1200  (timestamp backup explícito)
 *
 * GARANTÍAS:
 *   - V1 (nexus): SOLO SELECT. Pool dedicado de solo lectura; jamás se emite DML.
 *   - V2 (nexus_v2): todas las escrituras de DB van en UNA transacción; rollback total si algo falla.
 *   - Idempotente: ON CONFLICT DO NOTHING / upsert por id/email/slug; re-ejecutar no duplica.
 *   - --execute hace pg_dump de nexus_v2 a /root/backups antes de tocar nada (protocolo).
 *   - Vault: rsync -a (sin --delete) preservando estructura y mtimes; merge con plantillas seed.
 *
 * ALCANCE (decisiones de Jerson — exacto):
 *   SÍ: org J4, user_001, 9 agentes (UUID preservados, status→idle),
 *       12 proyectos activos (UUID/description/color/lead_agent preservados),
 *       vault completo, billing base (subscription team + cuotas 2026-05).
 *   NO: issues, Instagram, logs, rutinas/goals/relaciones/calendar/chat/poliapuestas.
 */
import { existsSync, readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import pg from 'pg';
import { sql, eq } from 'drizzle-orm';
import { db, pool } from '../../db/index.js';
import {
  users,
  organizations,
  orgMembers,
  userSettings,
  subscriptions,
  usageQuotas,
  agents,
  projects,
} from '../../db/schema.js';
import { provisionUserEnv } from '../../services/userEnv.js';

// ── Constantes de la migración ──────────────────────────────────────────────

const V1_DB_URL = 'postgres://nexus_user:nexus_j4_2026@127.0.0.1:5432/nexus';
const V2_DB_URL = 'postgres://nexus_user:nexus_j4_2026@127.0.0.1:5432/nexus_v2';
const V1_AUTH_PATH = '/root/nexus/.auth.json';
const VAULT_SRC = '/root/obsidian-vault/';
const BACKUPS_DIR = '/root/backups';
const MIN_VAULT_MD = 740;

const ORG = { name: 'J4 Smart Solutions', slug: 'j4', tier: 'team' as const };
const USER = {
  email: 'jersonmendoza@eyesa.com.co',
  displayName: 'Jerson',
  tier: 'team' as const,
  locale: 'es-CO',
  telegramChatId: 6669983530,
};

// Cuotas tier team para el periodo actual. voice_seconds 0=ilimitado → número alto.
const PERIOD = '2026-05';
const TEAM_QUOTAS: Record<string, number> = {
  messages: 20_000,
  voice_seconds: 31_536_000, // ~1 año en segundos (proxy de "ilimitado")
  vault_bytes: 10_737_418_240, // 10 GB
};

// ── Tipos de filas V1 ─────────────────────────────────────────────────────

interface V1Agent {
  id: string;
  name: string;
  display_name: string;
  status: string;
  capabilities: string | null; // V1: TEXT (CSV), V2 espera jsonb array
  adapter_type: string;
  runtime_config: unknown; // V1: jsonb
  created_at: Date;
}

interface V1Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  lead_agent_id: string | null;
  target_date: Date | null;
  color: string | null;
  created_at: Date;
}

// ── Utilidades ───────────────────────────────────────────────────────────

function parseFlags() {
  const argv = process.argv.slice(2);
  const execute = argv.includes('--execute');
  const dryRun = !execute; // default dry-run
  const tsIdx = argv.indexOf('--ts');
  const ts = tsIdx >= 0 ? argv[tsIdx + 1] : undefined;
  return { dryRun, execute, ts };
}

/** Convierte el CSV de capabilities de V1 en un array de strings (para jsonb). */
function capabilitiesToArray(csv: string | null): string[] {
  if (!csv) return [];
  return csv
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function defaultTimestamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function line(s = '') {
  console.log(s);
}

// ── Carga de datos de V1 (SOLO LECTURA) ───────────────────────────────────

async function loadV1(): Promise<{ agents: V1Agent[]; projects: V1Project[] }> {
  const ro = new pg.Pool({ connectionString: V1_DB_URL, max: 2 });
  try {
    const agentsRes = await ro.query<V1Agent>(
      `select id, name, display_name, status, capabilities, adapter_type, runtime_config, created_at
         from agents order by created_at`
    );
    const projectsRes = await ro.query<V1Project>(
      `select id, name, description, status, lead_agent_id, target_date, color, created_at
         from projects where status = 'active' order by created_at`
    );
    return { agents: agentsRes.rows, projects: projectsRes.rows };
  } finally {
    await ro.end();
  }
}

function loadV1PasswordHash(): string {
  if (!existsSync(V1_AUTH_PATH)) {
    throw new Error(`No existe ${V1_AUTH_PATH}; no se puede reusar el hash bcrypt de V1.`);
  }
  const raw = readFileSync(V1_AUTH_PATH, 'utf8');
  const parsed = JSON.parse(raw) as { username?: string; passwordHash?: string };
  if (!parsed.passwordHash) {
    throw new Error(`${V1_AUTH_PATH} no contiene passwordHash.`);
  }
  return parsed.passwordHash;
}

// ── Análisis / validación de consistencia ─────────────────────────────────

interface Plan {
  agents: V1Agent[];
  projects: V1Project[];
  passwordHash: string;
  agentIds: Set<string>;
  vaultMdCount: number;
  inconsistencies: string[];
}

async function buildPlan(): Promise<Plan> {
  const { agents: v1Agents, projects: v1Projects } = await loadV1();
  const passwordHash = loadV1PasswordHash();
  const agentIds = new Set(v1Agents.map((a) => a.id));
  const inconsistencies: string[] = [];

  if (v1Agents.length !== 9) {
    inconsistencies.push(`Se esperaban 9 agentes en V1, se encontraron ${v1Agents.length}.`);
  }
  if (v1Projects.length !== 12) {
    inconsistencies.push(`Se esperaban 12 proyectos activos en V1, se encontraron ${v1Projects.length}.`);
  }

  for (const p of v1Projects) {
    if (!p.name || p.name.trim() === '') {
      inconsistencies.push(`Proyecto ${p.id} activo SIN nombre.`);
    }
    if (p.lead_agent_id && !agentIds.has(p.lead_agent_id)) {
      inconsistencies.push(
        `Proyecto "${p.name}" (${p.id}) tiene lead_agent_id ${p.lead_agent_id} que NO está entre los 9 agentes migrados → se pondrá NULL.`
      );
    }
    if (!p.description || p.description.trim() === '') {
      inconsistencies.push(`Proyecto "${p.name}" (${p.id}) SIN descripción.`);
    }
  }

  // Conteo de notas .md del vault origen.
  let vaultMdCount = 0;
  try {
    const out = execFileSync('bash', [
      '-c',
      `find ${JSON.stringify(VAULT_SRC)} -name '*.md' -type f | wc -l`,
    ]);
    vaultMdCount = Number(out.toString().trim());
  } catch (e) {
    inconsistencies.push(`No se pudo contar notas del vault: ${(e as Error).message}`);
  }
  if (vaultMdCount < MIN_VAULT_MD) {
    inconsistencies.push(`Vault origen tiene ${vaultMdCount} notas .md (< ${MIN_VAULT_MD} esperadas).`);
  }

  return { agents: v1Agents, projects: v1Projects, passwordHash, agentIds, vaultMdCount, inconsistencies };
}

// ── DRY-RUN: imprime el plan ────────────────────────────────────────────────

function printPlan(plan: Plan) {
  line('═'.repeat(78));
  line('  PLAN DE MIGRACIÓN — NEXUS V1 → V2  ·  Jerson → user_001  ·  [DRY-RUN]');
  line('═'.repeat(78));
  line();
  line('ORIGEN  (SOLO LECTURA): nexus       @ 127.0.0.1:5432');
  line('DESTINO (transaccional): nexus_v2   @ 127.0.0.1:5432');
  line();

  // ORG + USER
  line('── ORGANIZACIÓN a crear ──────────────────────────────────────────────');
  line(`   name : ${ORG.name}`);
  line(`   slug : ${ORG.slug}`);
  line(`   tier : ${ORG.tier}`);
  line('   owner: user_001 (Jerson)');
  line();
  line('── USUARIO (user_001) a crear ────────────────────────────────────────');
  line(`   email          : ${USER.email}`);
  line(`   display_name   : ${USER.displayName}`);
  line(`   tier           : ${USER.tier}`);
  line(`   locale         : ${USER.locale}`);
  line(`   telegram_chat  : ${USER.telegramChatId}`);
  line(`   default_org_id : org J4 (resuelto en runtime)`);
  line(`   password_hash  : REUSADO de V1 ${V1_AUTH_PATH}`);
  line(`                    → ${plan.passwordHash.slice(0, 20)}… (bcrypt, login V2 por email)`);
  line('   org_members    : Jerson = owner de J4');
  line("   user_settings  : primary_agent_id=NULL, ui_theme='dark', voice_id='elisa-maria'");
  line("   subscription   : tier=team, status=active, provider=mercadopago (sin provider_sub_id)");
  line(`   usage_quotas (${PERIOD}):`);
  for (const [m, v] of Object.entries(TEAM_QUOTAS)) {
    line(`        - ${m.padEnd(14)} limit=${v.toLocaleString('en-US')}`);
  }
  line('   env filesystem : user_000001_env  (seq forzado a 1; ver nota al final)');
  line();

  // AGENTES
  line(`── AGENTES a migrar (${plan.agents.length}) — UUID preservados, status→idle ──────────`);
  for (const a of plan.agents) {
    const caps = capabilitiesToArray(a.capabilities);
    line(`   • ${a.display_name.padEnd(11)} ${a.name.padEnd(22)} ${a.id}  (caps:${caps.length})`);
  }
  line();

  // PROYECTOS
  line(`── PROYECTOS ACTIVOS a migrar (${plan.projects.length}) — UUID/desc/color preservados ──`);
  for (const p of plan.projects) {
    const lead = p.lead_agent_id
      ? plan.agentIds.has(p.lead_agent_id)
        ? `lead=${p.lead_agent_id.slice(0, 8)}`
        : `lead=HUÉRFANO→NULL`
      : 'lead=—';
    const desc = p.description && p.description.trim() !== '' ? 'desc=sí' : 'desc=NO';
    const color = p.color ?? '—';
    line(`   • ${p.name}`);
    line(`       ${p.id}  ${lead}  ${desc}  color=${color}`);
  }
  line();

  // VAULT
  line('── VAULT (copiar COMPLETO, merge sin borrar) ─────────────────────────');
  line(`   origen  : ${VAULT_SRC}  (${plan.vaultMdCount} notas .md)`);
  line('   destino : <DATA_DIR>/users/user_000001_env/vault/');
  line('   método  : rsync -a (sin --delete) → preserva estructura + mtimes');
  line('   merge   : conserva plantillas seed (Preferencias.md, Aprendizajes_Repetitivos.md, etc.)');
  line(`   verifica: conteo .md destino ≥ ${MIN_VAULT_MD}`);
  line();

  // NO migra
  line('── QUE NO SE MIGRA (decisión de Jerson) ──────────────────────────────');
  line('   ✗ issues               (en V2 se crean a mano, ligados a proyecto)');
  line('   ✗ Instagram            (publications, instagram_posts, credentials, settings, logs)');
  line('   ✗ logs                 (activity_log, routine_runs, heartbeat_runs, wakeup_requests)');
  line('   ✗ Poliapuestas         (matches, teams, pools, scoring_config)');
  line('   ✗ rutinas, goals, agent_relationships, agent_skills, calendar,');
  line('     google_credentials, chat_messages   (fuera de alcance esta tanda)');
  line('   ✗ proyectos archived/done (viven en el vault)');
  line();

  // Inconsistencias
  line('── INCONSISTENCIAS DETECTADAS ────────────────────────────────────────');
  if (plan.inconsistencies.length === 0) {
    line('   ✓ Ninguna. Todos los lead_agent_id están entre los 9 agentes; todos los');
    line('     proyectos activos tienen nombre y descripción.');
  } else {
    for (const w of plan.inconsistencies) line(`   ⚠ ${w}`);
  }
  line();

  // Backup + nota seq
  line('── EN --execute (NO ahora) ───────────────────────────────────────────');
  line(`   1. pg_dump nexus_v2 → ${BACKUPS_DIR}/nexus_v2-pre-migration-<ts>.sql.gz`);
  line('   2. setval(user_env_seq, 1, false)  → user_001 obtiene seq=1 = user_000001_env');
  line('      (la secuencia está actualmente avanzada por tests; nexus_v2 está vacía y');
  line('       no existe ningún env, por eso es seguro resetear a 1).');
  line('   3. UNA transacción: org → user → default_org → org_member → user_settings →');
  line('      subscription → cuotas → 9 agentes → 12 proyectos (ON CONFLICT DO NOTHING).');
  line('   4. Fuera de la tx: provisionUserEnv + rsync vault + verificación conteo .md.');
  line();
  line('═'.repeat(78));
  line('  DRY-RUN: no se escribió NADA. Para ejecutar: añade --execute');
  line('═'.repeat(78));
}

// ── EXECUTE: migración real ─────────────────────────────────────────────────

async function runExecute(plan: Plan, ts: string) {
  // Bloqueo si hay inconsistencias bloqueantes (las huérfanas/desc se toleran;
  // las de conteo de agentes/proyectos son críticas).
  const critical = plan.inconsistencies.filter(
    (w) => w.includes('Se esperaban') || w.includes('SIN nombre') || w.includes('Vault origen tiene')
  );
  if (critical.length > 0) {
    line('[execute] ABORTADO por inconsistencias críticas:');
    for (const c of critical) line(`   ⚠ ${c}`);
    throw new Error('Inconsistencias críticas; revisa el dry-run.');
  }

  // 1. Backup nexus_v2 (protocolo, aunque esté vacía).
  execFileSync('mkdir', ['-p', BACKUPS_DIR]);
  const backupPath = path.join(BACKUPS_DIR, `nexus_v2-pre-migration-${ts}.sql.gz`);
  line(`[execute] pg_dump nexus_v2 → ${backupPath}`);
  execFileSync('bash', [
    '-c',
    `PGPASSWORD=nexus_j4_2026 pg_dump -h 127.0.0.1 -U nexus_user nexus_v2 | gzip > ${JSON.stringify(backupPath)}`,
  ]);
  if (!existsSync(backupPath)) throw new Error('El backup no se generó; abortando.');

  // 2. Forzar user_env_seq → próximo nextval = 1.
  line('[execute] setval(user_env_seq, 1, false)');
  await db.execute(sql`SELECT setval('user_env_seq', 1, false)`);

  // 3. Transacción única de DB.
  let orgId = '';
  let userId = '';
  await db.transaction(async (tx) => {
    // ORG
    const [org] = await tx
      .insert(organizations)
      .values({ slug: ORG.slug, name: ORG.name, tier: ORG.tier })
      .onConflictDoNothing({ target: organizations.slug })
      .returning();
    orgId = org?.id ?? (await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.slug, ORG.slug)).limit(1))[0]!.id;

    // USER
    const [user] = await tx
      .insert(users)
      .values({
        email: USER.email,
        passwordHash: plan.passwordHash,
        displayName: USER.displayName,
        tier: USER.tier,
        locale: USER.locale,
        telegramChatId: USER.telegramChatId,
        defaultOrgId: orgId,
      })
      .onConflictDoNothing({ target: users.email })
      .returning();
    userId = user?.id ?? (await tx.select({ id: users.id }).from(users).where(eq(users.email, USER.email)).limit(1))[0]!.id;

    // owner de la org + default_org_id consistente
    await tx.update(organizations).set({ ownerUserId: userId }).where(eq(organizations.id, orgId));
    await tx.update(users).set({ defaultOrgId: orgId }).where(eq(users.id, userId));

    // org_member owner
    await tx
      .insert(orgMembers)
      .values({ orgId, userId, role: 'owner' })
      .onConflictDoNothing();

    // user_settings
    await tx
      .insert(userSettings)
      .values({ userId, primaryAgentId: null, uiTheme: 'dark', voiceId: 'elisa-maria' })
      .onConflictDoNothing();

    // subscription
    await tx
      .insert(subscriptions)
      .values({ orgId, tier: 'team', status: 'active', provider: 'mercadopago' });

    // usage_quotas periodo actual
    await tx
      .insert(usageQuotas)
      .values(
        Object.entries(TEAM_QUOTAS).map(([metric, limitValue]) => ({
          orgId,
          userId: null,
          period: PERIOD,
          metric,
          limitValue,
        }))
      )
      .onConflictDoNothing();

    // AGENTES (UUID preservados, status→idle, capabilities CSV→array)
    for (const a of plan.agents) {
      await tx
        .insert(agents)
        .values({
          id: a.id,
          userId,
          orgId,
          name: a.name,
          displayName: a.display_name,
          status: 'idle',
          capabilities: capabilitiesToArray(a.capabilities),
          adapterType: a.adapter_type,
          runtimeConfig: (a.runtime_config ?? {}) as Record<string, unknown>,
          createdAt: a.created_at,
        })
        .onConflictDoNothing({ target: agents.id });
    }

    // PROYECTOS (UUID/desc/color preservados; lead huérfano→NULL)
    for (const p of plan.projects) {
      const lead = p.lead_agent_id && plan.agentIds.has(p.lead_agent_id) ? p.lead_agent_id : null;
      await tx
        .insert(projects)
        .values({
          id: p.id,
          userId,
          orgId,
          name: p.name,
          description: p.description ?? null,
          status: 'active',
          leadAgentId: lead,
          targetDate: p.target_date ?? null,
          color: p.color ?? null,
          createdAt: p.created_at,
        })
        .onConflictDoNothing({ target: projects.id });
    }
  });
  line(`[execute] DB OK — org=${orgId} user=${userId}`);

  // 4. Provisionar env (seq=1) + rsync vault.
  const paths = await provisionUserEnv({ userId, orgId, tier: USER.tier });
  line(`[execute] env provisionado: ${paths.root}`);

  line(`[execute] rsync vault → ${paths.vault}`);
  execFileSync('rsync', ['-a', VAULT_SRC, paths.vault + path.sep]);

  // Verificar conteo .md destino.
  const destCount = Number(
    execFileSync('bash', ['-c', `find ${JSON.stringify(paths.vault)} -name '*.md' -type f | wc -l`])
      .toString()
      .trim()
  );
  line(`[execute] vault destino: ${destCount} notas .md (origen ${plan.vaultMdCount}, mínimo ${MIN_VAULT_MD})`);
  if (destCount < MIN_VAULT_MD) {
    throw new Error(`Conteo .md destino ${destCount} < ${MIN_VAULT_MD}; vault incompleto.`);
  }

  line('[execute] ✓ Migración completada.');
}

// ── main ─────────────────────────────────────────────────────────────────

async function main() {
  const { dryRun, execute, ts } = parseFlags();
  const plan = await buildPlan();

  if (dryRun) {
    printPlan(plan);
  } else if (execute) {
    const stamp = ts ?? defaultTimestamp();
    line(`[execute] iniciando migración real (ts=${stamp})`);
    await runExecute(plan, stamp);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('[001_jerson_to_user] ERROR:', err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
