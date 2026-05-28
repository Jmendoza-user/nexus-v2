/**
 * authJwt — lee la cookie de sesión, verifica el JWT y popula req.user.
 * Si no hay token válido → 401.
 */
import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME, verifyToken, clearSessionCookie, type JwtPayload } from '../lib/jwt.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: JwtPayload;
      tenant?: import('./tenant.js').TenantContext;
    }
  }
}

export function authJwt(req: Request, res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) {
    res.status(401).json({ error: 'No autenticado.' });
    return;
  }
  try {
    req.user = verifyToken(token);
    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Sesión expirada o inválida.' });
  }
}
