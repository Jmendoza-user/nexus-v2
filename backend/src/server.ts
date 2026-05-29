/**
 * Entry point del backend NEXUS V2.0.
 */
import { createApp } from './app.js';
import { env } from './lib/env.js';
import { pool } from './db/index.js';
import { startMonitorScheduler, stopMonitorScheduler } from './services/scrape/scheduler.js';
import { closeCache } from './services/promptCache.js';

const app = createApp();

const server = app.listen(env.PORT, () => {
  console.log(`[nexus-v2-backend] escuchando en http://127.0.0.1:${env.PORT} (${env.NODE_ENV})`);
});

// Scheduler de monitores proactivos (in-process, no solapado). Solo en el server
// real, nunca en tests (que importan createApp() sin levantar server.ts).
startMonitorScheduler();

async function shutdown(signal: string) {
  console.log(`[nexus-v2-backend] ${signal} recibido, cerrando...`);
  stopMonitorScheduler();
  void closeCache();
  server.close(() => {
    pool.end().finally(() => process.exit(0));
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
