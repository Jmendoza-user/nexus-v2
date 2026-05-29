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

/**
 * plans — catálogo comercial de planes (Hito 5, monetización).
 *
 * NO está scoped por tenant: es un catálogo público (como tier_policies). Una
 * fila por tier (free | pro | team). Mientras tier_policies es la fuente técnica
 * (cuotas/modelos/adapters), `plans` es la cara COMERCIAL: precios en COP/USD,
 * nombre comercial, features narrativas para la pantalla de upgrade, y el
 * provider_plan_id de MercadoPago (preapproval plan) cuando exista.
 *
 * Las `features` se siembran derivando los límites de tier_policies (mensajes,
 * voz, vault) + diferenciales del tier, en prosa lista para la UI. price_cop = 0
 * en free. mp_preapproval_plan_id NULL hasta que Jerson cree los planes en MP.
 */
const priceUsdType = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'numeric(10, 2)';
  },
});

export const plans = pgTable('plans', {
  tier: text('tier').primaryKey(), // free | pro | team (FK lógica a tier_policies.tier)
  name: text('name').notNull(),
  priceCop: integer('price_cop').notNull().default(0),
  priceUsd: priceUsdType('price_usd').notNull().default('0'),
  features: jsonb('features').notNull().default(sql`'[]'::jsonb`),
  popular: boolean('popular').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  mpPreapprovalPlanId: text('mp_preapproval_plan_id'),
});

/**
 * billing_events — bitácora de eventos de facturación (Hito 5, scoped por org).
 *
 * Fuente única de auditoría del ciclo de vida de la suscripción: webhooks de
 * MercadoPago (payment.approved, subscription.updated/cancelled), cambios
 * simulados (DEV) y acciones del usuario (checkout/cancel). Idempotente por
 * provider_event_id (UNIQUE parcial donde no es NULL): re-procesar el mismo
 * webhook no duplica ni re-aplica.
 *
 * - event_type: payment.approved | subscription.updated | subscription.cancelled
 *               | tier.changed | checkout.created | simulated.change ...
 * - provider: mercadopago | simulated | manual.
 * - provider_event_id: id del evento/notification de MP (para idempotencia).
 * - payload: cuerpo crudo del webhook o contexto del evento interno.
 * - processed: true cuando el evento fue aplicado a subscriptions/tier.
 */
export const billingEvents = pgTable(
  'billing_events',
  {
    id: uuidPk(),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    provider: text('provider').notNull().default('mercadopago'), // mercadopago | simulated | manual
    eventType: text('event_type').notNull(),
    providerEventId: text('provider_event_id'),
    payload: jsonb('payload').notNull().default(sql`'{}'::jsonb`),
    processed: boolean('processed').notNull().default(false),
    receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('billing_events_org_idx').on(t.orgId, t.receivedAt.desc()),
    // Idempotencia: un mismo provider_event_id no se inserta dos veces (parcial:
    // sólo aplica a filas con provider_event_id NOT NULL — eventos internos sin id
    // no chocan). El WHERE del índice se añade en la migración SQL.
    uniqueIndex('billing_events_provider_event_unique').on(t.providerEventId),
  ]
);

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
// MOTOR FINANCIERO (Hito 3) — Human-in-the-Loop: detección → Borrador →
// aprobación manual → Confirmado.
// ──────────────────────────────────────────────────────────────────────────

/**
 * numeric(18,2): tipo monto. Drizzle expone numeric como string para no perder
 * precisión decimal; el servicio convierte a Number sólo para sumas de UI.
 */
export const money = customType<{ data: string; driverData: string }>({
  dataType() {
    return 'numeric(18, 2)';
  },
});

/**
 * transactions — corazón del motor financiero (scoped por tenant).
 *
 * Estados (estado): Borrador → Confirmado | Rechazado.
 *   - Borrador  : detectado por IA (Gmail/OCR) o creado a mano pendiente; NO
 *                 afecta el balance.
 *   - Confirmado: aprobado por el humano (o entrada Manual directa); SÍ cuenta
 *                 en summary/balance.
 *   - Rechazado : descartado por el humano; nunca cuenta.
 *
 * tipo: Egreso | Ingreso | Inversion | Deuda.
 * canal_origen (canal): Gmail | OCR | Manual | Sync.
 * legitimo: heurística antifraude/antispam del clasificador (false = sospechoso
 *   o no parseable; se crea igual como Borrador para revisión humana).
 * evidence_id: FK lógica a transaction_email_evidence (correo origen) cuando
 *   aplica; los OCR/manual pueden no tenerla.
 * recurrence: NULL = movimiento puntual; objeto {freq, dueDay, ...} si el
 *   usuario lo marcó recurrente (alimenta "próximos pagos" sin tabla extra).
 *
 * Índices: (user_id, estado, fecha_hora desc) para Inbox/Historial paginables.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    tipo: text('tipo').notNull(), // Egreso | Ingreso | Inversion | Deuda
    monto: money('monto').notNull(),
    currency: text('currency').notNull().default('COP'),
    categoria: text('categoria'),
    comercioOrigen: text('comercio_origen'),
    fechaHora: timestamp('fecha_hora', { withTimezone: true }).notNull().defaultNow(),
    canalOrigen: text('canal_origen').notNull().default('Manual'), // Gmail | OCR | Manual | Sync
    estado: text('estado').notNull().default('Borrador'), // Borrador | Confirmado | Rechazado
    legitimo: boolean('legitimo').notNull().default(true),
    confidence: integer('confidence'), // 0..100 (clasificador IA); null en Manual
    evidenceId: uuid('evidence_id'), // FK lógica → transaction_email_evidence
    recurrence: jsonb('recurrence'), // null | { freq, dueDay, source, label }
    classification: jsonb('classification').notNull().default(sql`'{}'::jsonb`),
    note: text('note'),
    createdAt: createdAt(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    rejectedAt: timestamp('rejected_at', { withTimezone: true }),
  },
  (t) => [
    index('transactions_user_estado_idx').on(t.userId, t.estado, t.fechaHora.desc()),
    index('transactions_user_fecha_idx').on(t.userId, t.fechaHora.desc()),
  ]
);

/**
 * gmail_oauth_tokens — tokens OAuth de Gmail por usuario (SEAM inactivo).
 *
 * Aunque connections.ts ya cifra secretos en filesystem, el motor financiero
 * necesita metadata de sincronización (last_synced_*) consultable por SQL para
 * el cron GmailSync. Los tokens se guardan CIFRADOS (AES-256-GCM) en estas
 * columnas *_enc. Tabla scoped 1:1 por usuario (user_id PK).
 *
 * INACTIVO: sin GOOGLE_OAUTH_CLIENT_ID/SECRET no se rellena ni se ejecuta el
 * cron. Documentado en gmailSync.ts.
 */
export const gmailOauthTokens = pgTable('gmail_oauth_tokens', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  email: citext('email').notNull(),
  refreshTokenEnc: text('refresh_token_enc'),
  accessTokenEnc: text('access_token_enc'),
  accessExpiresAt: timestamp('access_expires_at', { withTimezone: true }),
  scopes: jsonb('scopes').notNull().default(sql`'[]'::jsonb`),
  lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
  lastSyncedMsgId: text('last_synced_msg_id'),
  createdAt: createdAt(),
});

/**
 * transaction_email_evidence — evidencia del correo que originó una transacción
 * (scoped). raw_excerpt se guarda REDACTADO (TokenGuard) y truncado a ≤4KB para
 * no almacenar PII bancaria cruda. UNIQUE(user_id, gmail_msg_id) → idempotente
 * por mensaje (re-ingestar el mismo correo no duplica).
 */
export const transactionEmailEvidence = pgTable(
  'transaction_email_evidence',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    gmailMsgId: text('gmail_msg_id').notNull(),
    subject: text('subject'),
    fromAddr: text('from_addr'),
    receivedAt: timestamp('received_at', { withTimezone: true }),
    rawExcerpt: text('raw_excerpt'), // REDACTADO + ≤4KB
    classification: jsonb('classification').notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('tx_email_evidence_unique').on(t.userId, t.gmailMsgId),
    index('tx_email_evidence_user_idx').on(t.userId),
  ]
);

// ──────────────────────────────────────────────────────────────────────────
// OBSERVABILIDAD / CAPACIDADES VPS (Hito 4)
// ──────────────────────────────────────────────────────────────────────────

/**
 * ai_usage_log — bitácora granular de cada invocación a IA (scoped por tenant).
 *
 * Se escribe (best-effort, no bloqueante) tras cada llamada a un modelo en los
 * flujos: assistant/chat, vault/rag, finance/classify, autocure, scrape (monitor
 * con criterio IA, futuro). Alimenta GET /api/usage con tokens estimados y, con
 * cache_hit, el ahorro por caché semántico (TokenGuard etapa 2).
 *
 * - kind: chat | rag | classify | repair | scrape.
 * - tokens_prompt / tokens_completion: del usage del adapter (0 si el gateway no
 *   los reporta; la estimación de $ usa total).
 * - cache_hit: true si la respuesta salió del caché Redis (no se gastó modelo).
 * - org_id NULLABLE: algunos flujos internos (autocure) sólo conocen userId; se
 *   resuelve org cuando está disponible.
 *
 * Índice (user_id, created_at desc) para agregaciones del periodo.
 */
export const aiUsageLog = pgTable(
  'ai_usage_log',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(), // chat | rag | classify | repair | scrape
    model: text('model'),
    tokensPrompt: integer('tokens_prompt').notNull().default(0),
    tokensCompletion: integer('tokens_completion').notNull().default(0),
    cacheHit: boolean('cache_hit').notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [
    index('ai_usage_log_user_created_idx').on(t.userId, t.createdAt.desc()),
    index('ai_usage_log_org_created_idx').on(t.orgId, t.createdAt.desc()),
  ]
);

/**
 * notifications — avisos al usuario (scoped). channel: inapp (badge + pantalla)
 * o telegram (espejo enviado por telegramNotifier; se registra igual para el
 * historial). read_at NULL = no leída (alimenta el badge). data lleva contexto
 * estructurado (p.ej. {monitorId, oldValue, newValue}).
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id').references(() => organizations.id, { onDelete: 'cascade' }),
    channel: text('channel').notNull().default('inapp'), // inapp | telegram
    kind: text('kind').notNull(), // monitor | autocure | system | ...
    title: text('title').notNull(),
    body: text('body'),
    data: jsonb('data').notNull().default(sql`'{}'::jsonb`),
    readAt: timestamp('read_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('notifications_user_created_idx').on(t.userId, t.createdAt.desc())]
);

/**
 * monitors — monitores proactivos sobre páginas web (scoped). El scheduler
 * recorre los enabled cada ~30min, scrapea target_url (Playwright), evalúa
 * criteria contra last_value y, si cambió/cumple, crea notification + Telegram.
 *
 * - kind: price | availability | generic.
 * - criteria: jsonb {op, value} (op: lt | lte | gt | gte | eq | neq | changed).
 * - last_value: último texto extraído (para detectar cambios).
 */
export const monitors = pgTable(
  'monitors',
  {
    id: uuidPk(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    kind: text('kind').notNull().default('generic'), // price | availability | generic
    targetUrl: text('target_url').notNull(),
    selector: text('selector'),
    criteria: jsonb('criteria').notNull().default(sql`'{}'::jsonb`),
    lastValue: text('last_value'),
    lastCheckedAt: timestamp('last_checked_at', { withTimezone: true }),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index('monitors_user_created_idx').on(t.userId, t.createdAt.desc())]
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
export type Plan = typeof plans.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type BillingEvent = typeof billingEvents.$inferSelect;
export type VaultChunk = typeof vaultChunks.$inferSelect;
export type TelegramPairing = typeof telegramPairings.$inferSelect;
export type SkillCatalogEntry = typeof skillsCatalog.$inferSelect;
export type SkillInstallation = typeof skillInstallations.$inferSelect;
export type Connection = typeof connections.$inferSelect;
export type AgentRepairAttempt = typeof agentRepairAttempts.$inferSelect;
export type Transaction = typeof transactions.$inferSelect;
export type TransactionInsert = typeof transactions.$inferInsert;
export type GmailOauthToken = typeof gmailOauthTokens.$inferSelect;
export type TransactionEmailEvidence = typeof transactionEmailEvidence.$inferSelect;
export type AiUsageLog = typeof aiUsageLog.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
export type Monitor = typeof monitors.$inferSelect;
