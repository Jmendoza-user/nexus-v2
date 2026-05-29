/**
 * Schema multi-tenant de NEXUS V2.0 (Drizzle ORM, PostgreSQL).
 *
 * Convenciones:
 * - Inglés (coherencia con V1).
 * - Toda tabla de dominio (agents, projects, issues, ...) lleva `user_id` y
 *   `org_id` NOT NULL con FK e índice (user_id, created_at desc) para aislamiento
 *   y paginación eficiente por tenant.
 * - UUID v4 generados por la DB (gen_random_uuid, extensión pgcrypto).
 * - emails en citext (case-insensitive unique).
 */
import {
  pgTable,
  uuid,
  text,
  integer,
  timestamp,
  bigint,
  boolean,
  jsonb,
  customType,
  index,
  uniqueIndex,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/** citext: texto case-insensitive (requiere extensión citext habilitada). */
export const citext = customType<{ data: string }>({
  dataType() {
    return 'citext';
  },
});

/**
 * vector(1024): tipo pgvector para embeddings BGE-m3 (1024 dimensiones).
 * Se serializa a/desde el formato textual de pgvector: '[0.1,0.2,...]'.
 * Requiere la extensión `vector` habilitada en la DB.
 */
export const vector1024 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return 'vector(1024)';
  },
  toDriver(value: number[]): string {
    return `[${value.join(',')}]`;
  },
  fromDriver(value: string): number[] {
    return value
      .slice(1, -1)
      .split(',')
      .map((n) => Number(n));
  },
});

const uuidPk = () =>
  uuid('id')
    .primaryKey()
    .default(sql`gen_random_uuid()`);

const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

// ──────────────────────────────────────────────────────────────────────────
// TENANCY
// ──────────────────────────────────────────────────────────────────────────

export const organizations = pgTable('organizations', {
  id: uuidPk(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  tier: text('tier').notNull().default('free'), // free | pro | team
  ownerUserId: uuid('owner_user_id'), // FK lógica a users.id (circular; sin constraint dura)
  createdAt: createdAt(),
});

export const users = pgTable(
  'users',
  {
    id: uuidPk(),
    email: citext('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    displayName: text('display_name').notNull(),
    defaultOrgId: uuid('default_org_id'), // FK lógica a organizations.id (circular)
    tier: text('tier').notNull().default('free'),
    telegramChatId: bigint('telegram_chat_id', { mode: 'number' }),
    telegramPairedAt: timestamp('telegram_paired_at', { withTimezone: true }),
    locale: text('locale').notNull().default('es-CO'),
    timezone: text('timezone').notNull().default('America/Bogota'),
    createdAt: createdAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
);

/**
 * telegram_pairings — códigos efímeros para vincular un chat de Telegram a un
 * usuario. Flujo: la PWA pide POST /api/telegram/pair → genera un código de 6
 * chars con expiración (15 min); el usuario lo envía a @NexusJ4Bot con
 * `/start <codigo>`; el webhook lo consume (consumed_at) y escribe
 * users.telegram_chat_id.
 *
 * pairing_code es PK (6 chars, alfabeto sin ambigüedades). Un código solo se usa
 * una vez (consumed_at NOT NULL = ya gastado). user_id apunta al dueño que lo
 * solicitó; el webhook valida expiración + no-consumido antes de vincular.
 */
export const telegramPairings = pgTable(
  'telegram_pairings',
  {
    pairingCode: text('pairing_code').primaryKey(), // 6 chars [A-Z2-9]
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('telegram_pairings_user_idx').on(t.userId)]
);

export const orgMembers = pgTable(
  'org_members',
  {
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('member'), // owner | admin | member
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    index('org_members_user_idx').on(t.userId),
  ]
);

export const userSettings = pgTable('user_settings', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  primaryAgentId: uuid('primary_agent_id'),
  primaryAgentPrompt: text('primary_agent_prompt'),
  voiceId: text('voice_id').notNull().default('elisa-maria'),
  preferredModel: text('preferred_model'),
  uiTheme: text('ui_theme').notNull().default('dark'),
  notifications: jsonb('notifications').notNull().default(sql`'{}'::jsonb`),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

// ──────────────────────────────────────────────────────────────────────────
// BILLING (estructura base, sin integración MercadoPago todavía)
// ──────────────────────────────────────────────────────────────────────────

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuidPk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tier: text('tier').notNull(), // free | pro | team
    status: text('status').notNull().default('active'), // active | trialing | past_due | cancelled
    provider: text('provider').notNull().default('mercadopago'),
    providerSubId: text('provider_sub_id'),
    currentPeriodStart: timestamp('current_period_start', { withTimezone: true }),
    currentPeriodEnd: timestamp('current_period_end', { withTimezone: true }),
    cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('subscriptions_org_idx').on(t.orgId)]
);

export const usageQuotas = pgTable(
  'usage_quotas',
  {
    id: uuidPk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    period: text('period').notNull(), // 'YYYY-MM'
    metric: text('metric').notNull(), // messages | voice_seconds | vault_bytes
    limitValue: bigint('limit_value', { mode: 'number' }).notNull(),
    usedValue: bigint('used_value', { mode: 'number' }).notNull().default(0),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Cuota a nivel org con sublímite opcional por user (user_id NULL = cuota org global).
    uniqueIndex('usage_quotas_unique').on(t.orgId, t.userId, t.period, t.metric),
    index('usage_quotas_org_period_idx').on(t.orgId, t.period),
  ]
);

/**
 * tier_policies — política por tier (catálogo, no scoped por tenant).
 *
 * Fuente de verdad de: adapter/modelo por defecto, adapters permitidos y
 * cuotas base. usage_quotas y AgentRunner.pickAdapter() leen de aquí.
 * Se siembra una vez (idempotente) en la migración / seed.
 */
export const tierPolicies = pgTable('tier_policies', {
  tier: text('tier').primaryKey(), // free | pro | team
  defaultAdapter: text('default_adapter').notNull().default('opencode'),
  defaultModel: text('default_model').notNull(),
  allowedAdapters: jsonb('allowed_adapters').notNull().default(sql`'["opencode"]'::jsonb`),
  quotaMessages: bigint('quota_messages', { mode: 'number' }).notNull(),
  quotaVoiceSeconds: bigint('quota_voice_seconds', { mode: 'number' }).notNull(),
  quotaVaultBytes: bigint('quota_vault_bytes', { mode: 'number' }).notNull(),
});

// ──────────────────────────────────────────────────────────────────────────
// DOMINIO REPRESENTATIVO (para probar aislamiento de tenant)
// ──────────────────────────────────────────────────────────────────────────

export const agents = pgTable(
  'agents',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    displayName: text('display_name').notNull(),
    status: text('status').notNull().default('idle'), // idle | running | paused | error
    capabilities: jsonb('capabilities').notNull().default(sql`'[]'::jsonb`),
    adapterType: text('adapter_type').notNull().default('opencode'),
    runtimeConfig: jsonb('runtime_config').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [index('agents_user_created_idx').on(t.userId, t.createdAt.desc())]
);

export const projects = pgTable(
  'projects',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    status: text('status').notNull().default('active'),
    leadAgentId: uuid('lead_agent_id'),
    targetDate: timestamp('target_date', { withTimezone: true }),
    color: text('color'),
    createdAt: createdAt(),
  },
  (t) => [index('projects_user_created_idx').on(t.userId, t.createdAt.desc())]
);

export const issues = pgTable(
  'issues',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
    identifier: text('identifier').notNull(),
    title: text('title').notNull(),
    status: text('status').notNull().default('open'),
    priority: text('priority').notNull().default('medium'),
    assigneeAgentId: uuid('assignee_agent_id'),
    createdAt: createdAt(),
  },
  (t) => [
    index('issues_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('issues_project_idx').on(t.projectId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// VAULT + RAG (segundo cerebro)
// ──────────────────────────────────────────────────────────────────────────

/**
 * vault_chunks — fragmentos indexados de las notas del vault de cada usuario,
 * con su embedding BGE-m3 (1024-dim) para búsqueda semántica (RAG).
 *
 * Aislamiento estricto: toda query DEBE filtrar por user_id. note_path es la
 * ruta RELATIVA de la nota dentro del vault del usuario (p.ej. 'projects/x.md').
 * UNIQUE(user_id, note_path, chunk_idx) permite upsert idempotente por nota.
 *
 * El índice HNSW (vector_cosine_ops) y los índices auxiliares se crean en la
 * migración SQL (drizzle no expresa HNSW de forma nativa todavía).
 */
export const vaultChunks = pgTable(
  'vault_chunks',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    notePath: text('note_path').notNull(),
    chunkIdx: integer('chunk_idx').notNull(),
    content: text('content').notNull(),
    embedding: vector1024('embedding').notNull(),
    metadata: jsonb('metadata').notNull().default(sql`'{}'::jsonb`),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('vault_chunks_unique').on(t.userId, t.notePath, t.chunkIdx),
    index('vault_chunks_user_idx').on(t.userId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// SKILLS / MCPs / CONEXIONES (Hito 2)
// ──────────────────────────────────────────────────────────────────────────

/**
 * skills_catalog — catálogo GLOBAL de skills disponibles para instalar.
 * NO está scoped por tenant: es un catálogo compartido (como tier_policies).
 * Cada fila describe una "skill" que el agente puede instalar en el env del
 * usuario (se materializa como un SKILL.md bajo env/skills/<key>/).
 *
 * - capabilities: lista de capacidades que la skill aporta (strings).
 * - requires_mcp: MCPs/servicios que la skill necesita para funcionar (strings).
 * - source_type/source_ref: de dónde sale la definición (local genera el .md
 *   desde el propio catálogo; github/url quedan como deuda de runtime real).
 */
export const skillsCatalog = pgTable('skills_catalog', {
  key: text('key').primaryKey(),
  name: text('name').notNull(),
  description: text('description').notNull(),
  capabilities: jsonb('capabilities').notNull().default(sql`'[]'::jsonb`),
  requiresMcp: jsonb('requires_mcp').notNull().default(sql`'[]'::jsonb`),
  sourceType: text('source_type').notNull().default('local'), // local | github | url
  sourceRef: text('source_ref'),
});

/**
 * skill_installations — skills instaladas por usuario (scoped).
 * install_path es RELATIVO al env del usuario (p.ej. 'skills/buscador-web').
 * source: registry (instalación manual desde el catálogo) | user (skill propia)
 *         | autocure (instalada por el agente autocurativo).
 * status: installed | failed | repairing.
 * UNIQUE(user_id, skill_key) → una instalación por skill y usuario (upsert).
 */
export const skillInstallations = pgTable(
  'skill_installations',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    skillKey: text('skill_key').notNull(),
    installPath: text('install_path').notNull(),
    source: text('source').notNull().default('registry'), // registry | user | autocure
    status: text('status').notNull().default('installed'), // installed | failed | repairing
    error: text('error'),
    installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('skill_installations_unique').on(t.userId, t.skillKey),
    index('skill_installations_user_idx').on(t.userId),
  ]
);

/**
 * connections — conexiones externas del usuario (scoped).
 * provider: gmail | gcal | meta | telegram | mercadopago.
 * status: active | disconnected | expired | pending.
 * config: metadata no sensible (cuenta, scopes, etc.).
 * secret_ref: ruta RELATIVA al .enc dentro del env del usuario
 *             (p.ej. 'connections/gmail.enc'); los tokens van cifrados ahí,
 *             NUNCA en la DB. UNIQUE(user_id, provider).
 */
export const connections = pgTable(
  'connections',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull(), // gmail | gcal | meta | telegram | mercadopago
    status: text('status').notNull().default('disconnected'), // active | disconnected | expired | pending
    config: jsonb('config').notNull().default(sql`'{}'::jsonb`),
    secretRef: text('secret_ref'), // ruta a env/connections/<provider>.enc
    createdAt: createdAt(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('connections_unique').on(t.userId, t.provider),
    index('connections_user_idx').on(t.userId),
  ]
);

/**
 * agent_repair_attempts — bitácora del bucle autocurativo (scoped).
 * Cada intento de reparación de un run fallido genera una fila.
 * - run_id: identificador del run que se está reparando (correlaciona intentos).
 * - attempt_num: número de intento (1..maxAttempts).
 * - error_class: clase de error detectada (skill_missing | tool_not_found | ...).
 * - diagnosis: diagnóstico (texto del reparador IA o heurístico).
 * - action: acción JSON propuesta {action, ...}.
 * - outcome: success | failed | gave_up.
 */
export const agentRepairAttempts = pgTable(
  'agent_repair_attempts',
  {
    id: uuidPk(),
    runId: text('run_id').notNull(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    agentId: uuid('agent_id')
      .notNull()
      .references(() => agents.id, { onDelete: 'cascade' }),
    attemptNum: integer('attempt_num').notNull(),
    errorClass: text('error_class').notNull(),
    diagnosis: text('diagnosis'),
    action: jsonb('action').notNull().default(sql`'{}'::jsonb`),
    outcome: text('outcome').notNull(), // success | failed | gave_up
    createdAt: createdAt(),
  },
  (t) => [
    index('agent_repair_attempts_run_idx').on(t.runId),
    index('agent_repair_attempts_user_idx').on(t.userId, t.createdAt.desc()),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// Tipos inferidos
// ──────────────────────────────────────────────────────────────────────────

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
export type Agent = typeof agents.$inferSelect;
export type Project = typeof projects.$inferSelect;
export type Issue = typeof issues.$inferSelect;
export type UsageQuota = typeof usageQuotas.$inferSelect;
export type TierPolicy = typeof tierPolicies.$inferSelect;
export type VaultChunk = typeof vaultChunks.$inferSelect;
export type TelegramPairing = typeof telegramPairings.$inferSelect;
export type SkillCatalogEntry = typeof skillsCatalog.$inferSelect;
export type SkillInstallation = typeof skillInstallations.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type AgentRepairAttempt = typeof agentRepairAttempts.$inferSelect;
