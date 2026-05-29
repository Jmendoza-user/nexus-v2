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
import { PathTraversalError } from './services/userEnv.js';

export function createApp() {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true, service: 'nexus-v2-backend', ts: new Date().toISOString() });
  });

  app.use('/api/auth', authRouter);
  app.use('/api/agents', agentsRouter);
  app.use('/api/assistant', assistantRouter);
  app.use('/api/voice', voiceRouter);

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
