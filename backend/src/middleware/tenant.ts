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

/**
 * quotaCheck — STUB documentado (Hito siguiente).
 *
 * TODO-DEUDA(quota-check): implementar enforcement real. Debe:
 *  - resolver la cuota (org_id, period actual, metric) en usage_quotas,
 *  - estimar el costo de la operación con costFn(req),
 *  - si used + costo > limit → 402 con { error, upgradeUrl },
 *  - en éxito, incrementar used tras la operación (o reservar/confirmar).
 * Por ahora es passthrough para no bloquear el desarrollo del Hito 0.
 */
export function quotaCheck(_metric: string, _costFn?: (req: Request) => number) {
  return (_req: Request, _res: Response, next: NextFunction): void => {
    next();
  };
}
