/**
 * tenantContext — resuelve el contexto de tenant a partir de req.user.
 * Popula req.tenant con { userId, orgId, tier, scoped, userPaths }.
 *
 * - scoped: helper tenantScoped(userId) listo para que los handlers consulten
 *   sin riesgo de fuga cross-tenant.
 * - userPaths: rutas del env aislado del usuario (puede ser null si aún no se
 *   provisionó; los handlers que toquen filesystem deben validar).
 *
 * Debe montarse SIEMPRE después de authJwt.
 */
import type { Request, Response, NextFunction } from 'express';
import { tenantScoped, type TenantScoped } from '../db/tenant.js';
import { resolveUserPaths, type UserPaths } from '../services/userEnv.js';

export interface TenantContext {
  userId: string;
  orgId: string;
  tier: string;
  scoped: TenantScoped;
  userPaths: UserPaths | null;
}

export async function tenantContext(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const user = req.user;
  if (!user) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }
  try {
    const userPaths = await resolveUserPaths(user.sub);
    req.tenant = {
      userId: user.sub,
      orgId: user.orgId,
      tier: user.tier,
      scoped: tenantScoped(user.sub),
      userPaths,
    };
    next();
  } catch (err) {
    next(err);
  }
}

// quotaCheck vive ahora en middleware/quota.ts (enforcement real, Hito 1).
// Se re-exporta aquí por compatibilidad con imports existentes.
export { quotaCheck, recordUsage, ensureQuotaRow, currentPeriod } from './quota.js';
export type { QuotaMetric } from './quota.js';
