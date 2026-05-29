/**
 * Rutas de Skills (montadas en /api/skills, autenticadas + scoped).
 *
 *   GET    /catalog            → catálogo global de skills disponibles.
 *   GET    /                   → skills instaladas por el usuario (+ catálogo).
 *   POST   /:key/install       → instala una skill del catálogo.
 *   DELETE /:key               → desinstala una skill.
 *
 * Todo scoped por req.tenant.userId. La skillKey se valida en el servicio
 * (path traversal + patrón estricto); aquí solo enrutamos y mapeamos errores.
 */
import { Router, type Request, type Response } from 'express';
import { authJwt } from '../middleware/auth.js';
import { tenantContext } from '../middleware/tenant.js';
import {
  listCatalog,
  listInstalled,
  installSkill,
  uninstallSkill,
  SkillError,
} from '../services/skills.js';
import { PathTraversalError } from '../services/userEnv.js';

export const skillsRouter = Router();
skillsRouter.use(authJwt, tenantContext);

function paramKey(req: Request): string {
  const k = req.params.key;
  return Array.isArray(k) ? (k[0] ?? '') : (k ?? '');
}

function mapSkillError(res: Response, err: unknown): boolean {
  if (err instanceof PathTraversalError) {
    res.status(400).json({ error: 'Ruta no permitida.' });
    return true;
  }
  if (err instanceof SkillError) {
    const status =
      err.code === 'invalid_key' ? 400 : err.code === 'not_in_catalog' ? 404 : 409;
    res.status(status).json({ error: err.message, code: err.code });
    return true;
  }
  return false;
}

// GET /api/skills/catalog
skillsRouter.get('/catalog', async (_req: Request, res: Response) => {
  const catalog = await listCatalog();
  res.json({ catalog });
});

// GET /api/skills — instaladas del tenant.
skillsRouter.get('/', async (req: Request, res: Response) => {
  const installed = await listInstalled(req.tenant!.userId);
  res.json({ installed });
});

// POST /api/skills/:key/install
skillsRouter.post('/:key/install', async (req: Request, res: Response) => {
  try {
    const row = await installSkill(req.tenant!.userId, paramKey(req), 'registry');
    res.status(201).json({ installation: row });
  } catch (err) {
    if (mapSkillError(res, err)) return;
    console.error('[skills] install error:', err);
    res.status(500).json({ error: 'No se pudo instalar la skill.' });
  }
});

// DELETE /api/skills/:key
skillsRouter.delete('/:key', async (req: Request, res: Response) => {
  try {
    const removed = await uninstallSkill(req.tenant!.userId, paramKey(req));
    if (!removed) {
      res.status(404).json({ error: 'La skill no estaba instalada.' });
      return;
    }
    res.json({ ok: true });
  } catch (err) {
    if (mapSkillError(res, err)) return;
    console.error('[skills] uninstall error:', err);
    res.status(500).json({ error: 'No se pudo desinstalar la skill.' });
  }
});
