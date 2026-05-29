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
    createdAt: createdAt(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)]
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
