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
