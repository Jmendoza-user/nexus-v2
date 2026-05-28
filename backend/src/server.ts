/**
 * Entry point del backend NEXUS V2.0.
 */
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { pool } from './db/index.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[nexus-v2-backend] escuchando en http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
});

async function shutdown(signal: string) {
  console.log(`[nexus-v2-backend] ${signal} recibido, cerrando...`);
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
