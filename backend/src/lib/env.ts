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
