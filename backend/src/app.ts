/**
 * Construye la app Express (sin escuchar). Separada de server.ts para que los
 * tests la importen con supertest sin abrir un puerto.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { authRouter } from './routes/auth.js';
import { agentsRouter } from './routes/agents.js';
import { assistantRouter } from './routes/assistant.js';
import { voiceRouter } from './routes/voice.js';
import { vaultRouter } from './routes/vault.js';
import { usersRouter } from './routes/users.js';
import { skillsRouter } from './routes/skills.js';
import { connectionsRouter } from './routes/connections.js';
import { finanzasRouter } from './routes/finanzas.js';
import { usageRouter } from './routes/usage.js';
import { scrapeRouter } from './routes/scrape.js';
import { monitorsRouter } from './routes/monitors.js';
import { notificationsRouter } from './routes/notifications.js';
import { telegramApiRouter, telegramWebhookRouter } from './routes/telegram.js';
import { PathTraversalError } from './services/userEnv.js';

export function createApp() {
  const app = express();

  // 2mb cubre notas de vault grandes (PUT/POST /api/vault/note).
  app.use(express.json({ limit: '2mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'nexus-v2-backend', ts: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/users', usersRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/skills', skillsRouter);
  app.use('/api/connections', connectionsRouter);
  app.use('/api/finanzas', finanzasRouter);
  app.use('/api/usage', usageRouter);
  app.use('/api/scrape', scrapeRouter);
  app.use('/api/monitors', monitorsRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/voice', voiceRouter);
  app.use('/api/vault', vaultRouter);
  app.use('/api/telegram', telegramApiRouter);

  // Webhook PÚBLICO de Telegram (fuera de /api, sin authJwt). Protegido por
  // secret en el path/header. INACTIVO hasta configurar el bot dedicado.
  app.use('/tg/webhook', telegramWebhookRouter);

  // 404 para rutas no encontradas bajo /api.
  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'Recurso no encontrado.' });
  });

  // Manejador de errores central.
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof PathTraversalError) {
      res.status(400).json({ error: 'Ruta no permitida.' });
      return;
    }
    console.error('[app] error no manejado:', err);
    res.status(500).json({ error: 'Algo no salió bien. Inténtalo en un momento.' });
  });

  return app;
}
