// ============================================================
// NEXUS — Cliente HTTP del backend (/api/*)
// Tipado, con credentials:'include' (cookie de sesión httpOnly).
// NO toca UI: solo datos. Las pantallas importan estas funciones.
// ============================================================

export interface ApiError extends Error {
  status: number;
  body?: unknown;
}

function makeError(status: number, message: string, body?: unknown): ApiError {
  const e = new Error(message) as ApiError;
  e.status = status;
  e.body = body;
  return e;
}

/** Error de cuota agotada (HTTP 402) para que la UI muestre CTA upgrade. */
export class QuotaError extends Error {
  status = 402 as const;
  constructor(public metric: string, public upgradeUrl: string) {
    super('quota_exceeded');
    this.name = 'QuotaError';
  }
}

async function jsonFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  const ct = res.headers.get('content-type') ?? '';
  const data = ct.includes('application/json') ? await res.json().catch(() => null) : null;
  if (res.status === 402 && data && (data as Any).error === 'quota_exceeded') {
    throw new QuotaError((data as Any).metric, (data as Any).upgradeUrl ?? '/m/upgrade');
  }
  if (!res.ok) {
    const msg = (data as Any)?.error || `HTTP ${res.status}`;
    throw makeError(res.status, msg, data);
  }
  return data as T;
}

type Any = any;

// ── Tipos de respuesta ───────────────────────────────────────────────────────
export interface AuthResult {
  ok: boolean;
  userId: string;
  orgId: string;
  tier: string;
}

export interface Quota {
  metric: 'messages' | 'voice_seconds' | 'vault_bytes';
  period: string;
  limit: number;
  used: number;
}

export interface MeResponse {
  user: {
    id: string;
    email: string;
    displayName: string;
    locale: string;
    tier: string;
    telegramChatId: number | null;
    createdAt: string;
    lastLoginAt: string | null;
  };
  org: { id: string; slug: string; name: string; tier: string } | null;
  tier: string;
  quotas: Quota[];
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  locale: string;
  timezone: string;
  tier: string;
  telegramChatId: number | null;
  uiTheme: 'dark' | 'light' | 'auto';
  primaryAgentId: string | null;
  primaryAgentPrompt: string | null;
}

export interface ProfilePatch {
  displayName?: string;
  locale?: string;
  timezone?: string;
  uiTheme?: 'dark' | 'light' | 'auto';
  primaryAgentPrompt?: string;
}

export interface AgentItem {
  id: string;
  name: string;
  displayName: string;
  status: string;
  adapterType: string;
  capabilities: string[];
  runtimeConfig: Record<string, unknown>;
}

export interface ProjectItem {
  id: string;
  name: string;
  description: string | null;
  status: string;
  leadAgentId: string | null;
  targetDate: string | null;
  color: string | null;
  createdAt: string;
  issueCount: number;
  doneCount: number;
}

export interface IssueItem {
  id: string;
  projectId: string | null;
  identifier: string;
  title: string;
  status: 'open' | 'in_progress' | 'done' | 'canceled';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assigneeAgentId: string | null;
  createdAt: string;
}

export interface TelegramPairResponse {
  code: string;
  expiresAt: string;
  ttlSeconds: number;
  botUsername: string;
  instructions: string;
}

export interface TelegramPairingStatus {
  linked: boolean;
  pairedAt: string | null;
}

// ── Skills ───────────────────────────────────────────────────────────────────
export interface SkillCatalogEntry {
  key: string;
  name: string;
  description: string;
  capabilities: string[];
  requiresMcp: string[];
  sourceType: 'local' | 'github' | 'url';
  sourceRef: string | null;
}

export interface SkillInstallation {
  id: string;
  skillKey: string;
  installPath: string;
  source: 'registry' | 'user' | 'autocure';
  status: 'installed' | 'failed' | 'repairing';
  error: string | null;
  installedAt: string;
  catalog: SkillCatalogEntry | null;
}

// ── Conexiones ────────────────────────────────────────────────────────────────
export type ConnectionProvider = 'google' | 'gmail' | 'gcal' | 'meta' | 'telegram' | 'mercadopago';
export interface ConnectionView {
  provider: ConnectionProvider;
  status: 'active' | 'disconnected' | 'expired' | 'pending';
  config: Record<string, unknown>;
  hasSecret: boolean;
  updatedAt: string | null;
}

export interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatResponse {
  reply: string;
  agent: string;
  model: string;
  adapter: string;
  downgraded: boolean;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface TranscribeResponse {
  text: string;
  language?: string;
  durationSeconds: number;
}

// ── Vault ──────────────────────────────────────────────────────────────────────
export interface VaultTreeNode {
  name: string;
  path: string;
  type: 'folder' | 'note';
  size?: number;
  mtime?: number;
  children?: VaultTreeNode[];
}

export interface VaultTreeResponse {
  tree: VaultTreeNode[];
  totalNotes: number;
}

export interface VaultNote {
  path: string;
  title: string;
  content: string;
  body: string;
  frontmatter: Record<string, unknown>;
  links: string[];
  backlinks: string[];
  size: number;
  mtime: number;
}

export interface VaultSearchResult {
  path: string;
  title: string;
  excerpt: string;
}

export interface VaultRagCitation {
  notePath: string;
  title: string;
  score: number;
}

export interface VaultRagResponse {
  answer: string;
  citations: VaultRagCitation[];
  used: number;
  model?: string;
}

// ── Finanzas ──────────────────────────────────────────────────────────────────
export type TxTipo = 'Egreso' | 'Ingreso' | 'Inversion' | 'Deuda';
export type TxCanal = 'Gmail' | 'OCR' | 'Manual' | 'Sync';
export type TxEstado = 'Borrador' | 'Confirmado' | 'Rechazado';

export interface TransactionView {
  id: string;
  tipo: TxTipo;
  monto: number;
  currency: string;
  categoria: string | null;
  comercioOrigen: string | null;
  fechaHora: string | null;
  canal: TxCanal;
  estado: TxEstado;
  legitimo: boolean;
  confidence: number | null;
  evidenceId: string | null;
  recurrence: Record<string, unknown> | null;
  note: string | null;
  createdAt: string | null;
  confirmedAt: string | null;
  rejectedAt: string | null;
}

export interface EvidenceView {
  id: string;
  gmailMsgId: string;
  subject: string | null;
  fromAddr: string | null;
  receivedAt: string | null;
  rawExcerpt: string | null;
  classification: Record<string, unknown>;
}

export interface FinanceSummaryResponse {
  period: string;
  currency: string;
  balanceMonth: number;
  income: number;
  expense: number;
  vsPrev: number;
  topCategories: { categoria: string; amount: number }[];
  weekly: { d: string; in: number; out: number }[];
  upcoming: { name: string; amount: number; date: string; dueDay: number; source: string }[];
}

export interface ClassificationView {
  tipo: TxTipo;
  monto: number;
  currency: string;
  comercioOrigen: string | null;
  categoria: string | null;
  fechaHora: string | null;
  legitimo: boolean;
  confidence: number;
  reason?: string;
  redacted: boolean;
  model?: string | null;
}

export interface IngestEmailResponse {
  draft: TransactionView | null;
  classification: ClassificationView;
  evidenceId: string | null;
  duplicate: boolean;
  message?: string;
}

export interface UploadReceiptResponse {
  draft: TransactionView | null;
  ocrAvailable: boolean;
  classification?: ClassificationView;
  message?: string;
  reason?: string;
}

export interface CreateManualInput {
  tipo: TxTipo;
  monto: number;
  currency?: string;
  categoria?: string | null;
  comercioOrigen?: string | null;
  fechaHora?: string | null;
  note?: string | null;
}

export interface TxFilters {
  estado?: TxEstado;
  tipo?: TxTipo;
  canal?: TxCanal;
  from?: string;
  to?: string;
  limit?: number;
}

// ── Uso / Observabilidad (Hito 4) ───────────────────────────────────────────────
export interface UsageQuota {
  metric: 'messages' | 'voice_seconds' | 'vault_bytes';
  limit: number;
  used: number;
  period: string;
}

export interface UsageResponse {
  period: string;
  tier: string;
  quotas: UsageQuota[];
  ai: {
    totalCalls: number;
    cacheHits: number;
    tokensPrompt: number;
    tokensCompletion: number;
    totalTokens: number;
    byKind: Record<string, { calls: number; cacheHits: number; tokens: number }>;
    savings: { cacheHits: number; tokensSaved: number; usdSaved: number };
  };
}

// ── Notificaciones (Hito 4) ──────────────────────────────────────────────────────
export interface NotificationView {
  id: string;
  channel: 'inapp' | 'telegram';
  kind: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  readAt: string | null;
  createdAt: string | null;
}

// ── Monitores (Hito 4) ────────────────────────────────────────────────────────────
export interface MonitorCriteria {
  op: 'changed' | 'lt' | 'lte' | 'gt' | 'gte' | 'eq' | 'neq';
  value?: number;
}
export interface MonitorView {
  id: string;
  title: string;
  kind: 'price' | 'availability' | 'generic';
  targetUrl: string;
  selector: string | null;
  criteria: MonitorCriteria;
  lastValue: string | null;
  lastCheckedAt: string | null;
  enabled: boolean;
  createdAt: string | null;
}

export interface ScrapeResult {
  title: string;
  text: string;
  extracted: string | null;
  url: string;
}

// ── Billing / Planes (Hito 5) ────────────────────────────────────────────────
export interface PlanView {
  tier: 'free' | 'pro' | 'team';
  name: string;
  priceCop: number;
  priceUsd: string;
  features: string[];
  popular: boolean;
  sortOrder: number;
  mpPreapprovalPlanId: string | null;
}

export interface SubscriptionView {
  orgId: string;
  tier: string;
  status: string;
  provider: string;
  providerSubId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  plan: PlanView | null;
  quotas: { metric: 'messages' | 'voice_seconds' | 'vault_bytes'; limit: number; used: number; period: string }[];
}

export interface CheckoutResponse {
  ok: boolean;
  simulated?: boolean;
  checkoutUrl?: string;
  preferenceId?: string;
  subscription?: SubscriptionView;
}

/** Lanzado cuando el backend no tiene MercadoPago configurado (503). */
export class BillingNotConfiguredError extends Error {
  status = 503 as const;
  constructor(public canSimulate: boolean, message: string) {
    super(message);
    this.name = 'BillingNotConfiguredError';
  }
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export const api = {
  login(email: string, password: string): Promise<AuthResult> {
    return jsonFetch<AuthResult>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },

  register(email: string, password: string, displayName: string): Promise<AuthResult> {
    return jsonFetch<AuthResult>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password, displayName }),
    });
  },

  logout(): Promise<{ ok: boolean }> {
    return jsonFetch('/api/auth/logout', { method: 'POST' });
  },

  me(): Promise<MeResponse> {
    return jsonFetch<MeResponse>('/api/auth/me');
  },

  // ── Perfil editable ────────────────────────────────────────────────────────
  profile(): Promise<{ user: UserProfile }> {
    return jsonFetch<{ user: UserProfile }>('/api/users/me');
  },

  updateProfile(patch: ProfilePatch): Promise<{ user: UserProfile }> {
    return jsonFetch<{ user: UserProfile }>('/api/users/me', {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
  },

  // ── Agentes ─────────────────────────────────────────────────────────────────
  agents(): Promise<{ agents: AgentItem[] }> {
    return jsonFetch<{ agents: AgentItem[] }>('/api/agents');
  },

  // ── Historial de conversación (continuidad) ──────────────────────────────────
  chatHistory(): Promise<{ messages: { id: string; role: 'user' | 'assistant'; content: string; createdAt: string | null }[] }> {
    return jsonFetch('/api/assistant/history');
  },
  clearChatHistory(): Promise<{ ok: boolean }> {
    return jsonFetch('/api/assistant/history', { method: 'DELETE' });
  },

  // ── Proyectos + Tareas ───────────────────────────────────────────────────────
  projects(): Promise<{ projects: ProjectItem[] }> {
    return jsonFetch<{ projects: ProjectItem[] }>('/api/projects');
  },
  project(id: string): Promise<{ project: ProjectItem; issues: IssueItem[] }> {
    return jsonFetch<{ project: ProjectItem; issues: IssueItem[] }>(`/api/projects/${id}`);
  },
  createProject(body: { name: string; description?: string; color?: string; targetDate?: string }): Promise<{ project: ProjectItem }> {
    return jsonFetch<{ project: ProjectItem }>('/api/projects', { method: 'POST', body: JSON.stringify(body) });
  },
  updateProject(id: string, patch: Partial<{ name: string; description: string | null; status: string; leadAgentId: string | null; targetDate: string | null; color: string | null }>): Promise<{ project: ProjectItem }> {
    return jsonFetch<{ project: ProjectItem }>(`/api/projects/${id}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  deleteProject(id: string): Promise<{ ok: boolean }> {
    return jsonFetch<{ ok: boolean }>(`/api/projects/${id}`, { method: 'DELETE' });
  },
  createIssue(projectId: string, body: { title: string; priority?: string; status?: string }): Promise<{ issue: IssueItem }> {
    return jsonFetch<{ issue: IssueItem }>(`/api/projects/${projectId}/issues`, { method: 'POST', body: JSON.stringify(body) });
  },
  updateIssue(projectId: string, issueId: string, patch: Partial<{ title: string; status: string; priority: string; assigneeAgentId: string | null }>): Promise<{ issue: IssueItem }> {
    return jsonFetch<{ issue: IssueItem }>(`/api/projects/${projectId}/issues/${issueId}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },
  deleteIssue(projectId: string, issueId: string): Promise<{ ok: boolean }> {
    return jsonFetch<{ ok: boolean }>(`/api/projects/${projectId}/issues/${issueId}`, { method: 'DELETE' });
  },

  // ── Skills ────────────────────────────────────────────────────────────────
  skillsCatalog(): Promise<{ catalog: SkillCatalogEntry[] }> {
    return jsonFetch<{ catalog: SkillCatalogEntry[] }>('/api/skills/catalog');
  },

  skillsInstalled(): Promise<{ installed: SkillInstallation[] }> {
    return jsonFetch<{ installed: SkillInstallation[] }>('/api/skills');
  },

  installSkill(key: string): Promise<{ installation: SkillInstallation }> {
    return jsonFetch<{ installation: SkillInstallation }>(`/api/skills/${encodeURIComponent(key)}/install`, {
      method: 'POST',
    });
  },

  uninstallSkill(key: string): Promise<{ ok: boolean }> {
    return jsonFetch<{ ok: boolean }>(`/api/skills/${encodeURIComponent(key)}`, { method: 'DELETE' });
  },

  // ── Conexiones ──────────────────────────────────────────────────────────────
  connections(): Promise<{ connections: ConnectionView[]; googleConfigured: boolean }> {
    return jsonFetch<{ connections: ConnectionView[]; googleConfigured: boolean }>('/api/connections');
  },

  /**
   * Inicia OAuth de un provider. Devuelve { authUrl } si está configurado.
   * Si no (503), lanza ApiError con status 503 para que la UI muestre "Próximamente".
   */
  connectionOAuthStart(provider: ConnectionProvider): Promise<{ authUrl: string }> {
    return jsonFetch<{ authUrl: string }>(`/api/connections/${provider}/oauth/start`, { method: 'POST' });
  },

  disconnectConnection(provider: ConnectionProvider): Promise<{ ok: boolean }> {
    return jsonFetch<{ ok: boolean }>(`/api/connections/${provider}`, { method: 'DELETE' });
  },

  // ── Telegram (vinculación) ───────────────────────────────────────────────────
  telegramPair(): Promise<TelegramPairResponse> {
    return jsonFetch<TelegramPairResponse>('/api/telegram/pair', { method: 'POST' });
  },

  telegramPairingStatus(): Promise<TelegramPairingStatus> {
    return jsonFetch<TelegramPairingStatus>('/api/telegram/pairing-status');
  },

  // ── Asistente ────────────────────────────────────────────────────────────
  chat(message: string, opts?: { agentId?: string; history?: ChatTurn[] }): Promise<ChatResponse> {
    return jsonFetch<ChatResponse>('/api/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({ message, ...(opts ?? {}) }),
    });
  },

  // ── Voz ──────────────────────────────────────────────────────────────────
  async transcribe(audio: Blob, language = 'es'): Promise<TranscribeResponse> {
    const form = new FormData();
    form.append('audio', audio, 'audio.webm');
    form.append('language', language);
    const res = await fetch('/api/voice/transcribe', {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    const data = await res.json().catch(() => null);
    if (res.status === 402 && data?.error === 'quota_exceeded') {
      throw new QuotaError(data.metric, data.upgradeUrl ?? '/m/upgrade');
    }
    if (!res.ok) throw makeError(res.status, data?.error || `HTTP ${res.status}`, data);
    return data as TranscribeResponse;
  },

  // ── Finanzas ─────────────────────────────────────────────────────────────────
  financeSummary(period?: string): Promise<FinanceSummaryResponse> {
    return jsonFetch<FinanceSummaryResponse>(
      `/api/finanzas/summary${period ? `?period=${encodeURIComponent(period)}` : ''}`
    );
  },

  financeTransactions(filters?: TxFilters): Promise<{ transactions: TransactionView[] }> {
    const qs = new URLSearchParams();
    if (filters?.estado) qs.set('estado', filters.estado);
    if (filters?.tipo) qs.set('tipo', filters.tipo);
    if (filters?.canal) qs.set('canal', filters.canal);
    if (filters?.from) qs.set('from', filters.from);
    if (filters?.to) qs.set('to', filters.to);
    if (filters?.limit) qs.set('limit', String(filters.limit));
    const q = qs.toString();
    return jsonFetch<{ transactions: TransactionView[] }>(`/api/finanzas/transactions${q ? `?${q}` : ''}`);
  },

  financeTransaction(id: string): Promise<{ transaction: TransactionView; evidence: EvidenceView | null }> {
    return jsonFetch(`/api/finanzas/transactions/${encodeURIComponent(id)}`);
  },

  financeCreateManual(input: CreateManualInput): Promise<{ transaction: TransactionView }> {
    return jsonFetch('/api/finanzas/transactions', { method: 'POST', body: JSON.stringify(input) });
  },

  financeApprove(id: string): Promise<{ transaction: TransactionView }> {
    return jsonFetch(`/api/finanzas/transactions/${encodeURIComponent(id)}/approve`, { method: 'POST' });
  },

  financeReject(id: string): Promise<{ transaction: TransactionView }> {
    return jsonFetch(`/api/finanzas/transactions/${encodeURIComponent(id)}/reject`, { method: 'POST' });
  },

  financeIngestEmail(input: { rawText: string; from?: string; subject?: string; gmailMsgId?: string }): Promise<IngestEmailResponse> {
    return jsonFetch('/api/finanzas/ingest/email', { method: 'POST', body: JSON.stringify(input) });
  },

  async financeUploadReceipt(file: Blob, filename = 'receipt'): Promise<UploadReceiptResponse> {
    const form = new FormData();
    form.append('file', file, filename);
    const res = await fetch('/api/finanzas/upload/receipt', { method: 'POST', credentials: 'include', body: form });
    const data = await res.json().catch(() => null);
    if (!res.ok) throw makeError(res.status, (data as Any)?.error || `HTTP ${res.status}`, data);
    return data as UploadReceiptResponse;
  },

  // ── Vault ──────────────────────────────────────────────────────────────────
  vaultTree(): Promise<VaultTreeResponse> {
    return jsonFetch<VaultTreeResponse>('/api/vault/tree');
  },

  vaultNote(notePath: string): Promise<VaultNote> {
    return jsonFetch<VaultNote>(`/api/vault/note?path=${encodeURIComponent(notePath)}`);
  },

  vaultSaveNote(notePath: string, content: string): Promise<{ ok: boolean; path: string }> {
    return jsonFetch('/api/vault/note', {
      method: 'PUT',
      body: JSON.stringify({ path: notePath, content }),
    });
  },

  vaultCreateNote(
    notePath: string,
    opts?: { content?: string; template?: 'diaria' | 'concepto' | 'libre' }
  ): Promise<{ ok: boolean; path: string; title: string }> {
    return jsonFetch('/api/vault/note', {
      method: 'POST',
      body: JSON.stringify({ path: notePath, ...(opts ?? {}) }),
    });
  },

  vaultDeleteNote(notePath: string): Promise<{ ok: boolean; path: string }> {
    return jsonFetch(`/api/vault/note?path=${encodeURIComponent(notePath)}`, { method: 'DELETE' });
  },

  vaultSearch(query: string): Promise<{ query: string; results: VaultSearchResult[] }> {
    return jsonFetch('/api/vault/search', { method: 'POST', body: JSON.stringify({ query }) });
  },

  vaultRag(query: string, k?: number): Promise<VaultRagResponse> {
    return jsonFetch<VaultRagResponse>('/api/vault/rag/query', {
      method: 'POST',
      body: JSON.stringify({ query, ...(k ? { k } : {}) }),
    });
  },

  vaultReindex(): Promise<{ ok: boolean; notes: number; chunks: number; skipped: number; errors: number }> {
    return jsonFetch('/api/vault/reindex', { method: 'POST' });
  },

  // ── Uso / Observabilidad ─────────────────────────────────────────────────────
  usage(): Promise<UsageResponse> {
    return jsonFetch<UsageResponse>('/api/usage');
  },

  // ── Notificaciones ───────────────────────────────────────────────────────────
  notifications(): Promise<{ notifications: NotificationView[]; unread: number }> {
    return jsonFetch<{ notifications: NotificationView[]; unread: number }>('/api/notifications');
  },

  markNotificationRead(id: string): Promise<{ ok: boolean }> {
    return jsonFetch<{ ok: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  },

  // ── Monitores ──────────────────────────────────────────────────────────────────
  monitors(): Promise<{ monitors: MonitorView[] }> {
    return jsonFetch<{ monitors: MonitorView[] }>('/api/monitors');
  },

  createMonitor(input: {
    title: string;
    kind?: 'price' | 'availability' | 'generic';
    targetUrl: string;
    selector?: string;
    criteria?: MonitorCriteria;
  }): Promise<{ monitor: MonitorView }> {
    return jsonFetch('/api/monitors', { method: 'POST', body: JSON.stringify(input) });
  },

  updateMonitor(id: string, patch: { title?: string; selector?: string | null; criteria?: MonitorCriteria; enabled?: boolean }): Promise<{ monitor: MonitorView }> {
    return jsonFetch(`/api/monitors/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
  },

  deleteMonitor(id: string): Promise<{ ok: boolean }> {
    return jsonFetch(`/api/monitors/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // ── Scraping ─────────────────────────────────────────────────────────────────
  scrape(url: string, opts?: { selector?: string; waitFor?: string }): Promise<ScrapeResult> {
    return jsonFetch<ScrapeResult>('/api/scrape/run', { method: 'POST', body: JSON.stringify({ url, ...(opts ?? {}) }) });
  },

  // ── Billing / Planes ────────────────────────────────────────────────────────
  plans(): Promise<{ plans: PlanView[]; mpConfigured: boolean }> {
    return jsonFetch<{ plans: PlanView[]; mpConfigured: boolean }>('/api/billing/plans');
  },

  subscription(): Promise<{ subscription: SubscriptionView }> {
    return jsonFetch<{ subscription: SubscriptionView }>('/api/billing/subscription');
  },

  /**
   * Inicia el checkout de un plan. Si MercadoPago no está configurado lanza
   * BillingNotConfiguredError (con canSimulate). Con simulate=true (solo dev)
   * aplica el cambio directamente y devuelve la nueva suscripción.
   */
  async checkout(tier: 'pro' | 'team', simulate = false): Promise<CheckoutResponse> {
    const res = await fetch(`/api/billing/checkout${simulate ? '?simulate=1' : ''}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tier }),
    });
    const data = await res.json().catch(() => null);
    if (res.status === 503 && (data as Any)?.error === 'billing_not_configured') {
      throw new BillingNotConfiguredError(Boolean((data as Any)?.canSimulate), (data as Any)?.message ?? 'Pagos no disponibles.');
    }
    if (!res.ok) throw makeError(res.status, (data as Any)?.error || `HTTP ${res.status}`, data);
    return data as CheckoutResponse;
  },

  cancelPlan(): Promise<{ ok: boolean; subscription: SubscriptionView }> {
    return jsonFetch<{ ok: boolean; subscription: SubscriptionView }>('/api/billing/cancel', { method: 'POST' });
  },

  /** Sintetiza voz y devuelve un Blob audio/mpeg listo para reproducir. */
  async synthesize(text: string): Promise<Blob> {
    const res = await fetch('/api/voice/synthesize', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      throw makeError(res.status, (data as Any)?.error || `HTTP ${res.status}`, data);
    }
    return res.blob();
  },
};
