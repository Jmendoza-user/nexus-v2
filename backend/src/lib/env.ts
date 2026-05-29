/**
 * Configuración central tipada. Carga .env una sola vez y valida que las
 * variables críticas existan al arrancar (fail-fast).
 */
import 'dotenv/config';

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === '') {
    throw new Error(`[env] Falta la variable de entorno requerida: ${name}`);
  }
  return v;
}

export const env = {
  DATABASE_URL: required('DATABASE_URL'),
  JWT_SECRET: required('JWT_SECRET'),
  ENCRYPTION_KEY: required('ENCRYPTION_KEY'),
  PORT: Number(process.env.PORT ?? 3110),
  DATA_DIR: process.env.DATA_DIR ?? '/root/nexus-v2/data',
  NODE_ENV: process.env.NODE_ENV ?? 'development',

  // ── IA (OpenCode-go, gateway OpenAI-compatible) ──────────────────────────
  OPENCODE_GO_API_KEY: process.env.OPENCODE_GO_API_KEY ?? '',
  OPENCODE_GO_BASE_URL: process.env.OPENCODE_GO_BASE_URL ?? 'https://opencode.ai/zen/go/v1',
  OPENCODE_GO_TIMEOUT_MS: Number(process.env.OPENCODE_GO_TIMEOUT_MS ?? 180_000),
  MODEL_FREE: process.env.MODEL_FREE ?? 'mimo-v2.5-pro',
  MODEL_PRO: process.env.MODEL_PRO ?? 'qwen3.6-plus',
  MODEL_TEAM: process.env.MODEL_TEAM ?? 'qwen3.6-plus',

  // ── Voz ──────────────────────────────────────────────────────────────────
  OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
  ELEVENLABS_API_KEY: process.env.ELEVENLABS_API_KEY ?? '',
  ELEVENLABS_VOICE_ID: process.env.ELEVENLABS_VOICE_ID ?? 'zssqi7M6uF2KLRnA0vAr',
  ELEVENLABS_MODEL_ID: process.env.ELEVENLABS_MODEL_ID ?? 'eleven_v3',

  // ── Embeddings (BGE-m3 1024-dim, servicio local) ─────────────────────────
  BGE_LOCAL_URL: process.env.BGE_LOCAL_URL ?? 'http://127.0.0.1:8100/embed',

  // Binario CLI (ClaudeCliAdapter — uso pesado en hitos siguientes).
  CLAUDE_CLI_BINARY: process.env.CLAUDE_CLI_BINARY ?? 'claude',
  get isProd() {
    return this.NODE_ENV === 'production';
  },
} as const;

// Validación temprana de la clave de cifrado (32 bytes hex).
if (!/^[0-9a-fA-F]{64}$/.test(env.ENCRYPTION_KEY)) {
  throw new Error(
    '[env] ENCRYPTION_KEY debe ser hex de 64 caracteres (32 bytes). Genera con `openssl rand -hex 32`.'
  );
}
