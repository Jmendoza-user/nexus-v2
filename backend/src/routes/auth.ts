/**
 * Rutas de autenticación: register, login, logout, me.
 */
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { registerUser, loginUser, getMe, AuthError } from '../services/auth.js';
import { setSessionCookie, clearSessionCookie } from '../lib/jwt.js';
import { authJwt } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  email: z.string().trim().email('Correo inválido.'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres.'),
  displayName: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
});

const loginSchema = z.object({
  email: z.string().trim().email('Correo inválido.'),
  password: z.string().min(1, 'Contraseña requerida.'),
});

function handleError(err: unknown, res: Response): void {
  if (err instanceof AuthError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (err instanceof z.ZodError) {
    res.status(400).json({ error: 'Datos inválidos.', issues: err.flatten().fieldErrors });
    return;
  }
  console.error('[auth] error inesperado:', err);
  res.status(500).json({ error: 'Algo no salió bien. Inténtalo en un momento.' });
}

authRouter.post('/register', async (req: Request, res: Response) => {
  try {
    const input = registerSchema.parse(req.body);
    const result = await registerUser(input);
    setSessionCookie(req, res, { sub: result.userId, orgId: result.orgId, tier: result.tier });
    res.status(201).json({ ok: true, userId: result.userId, orgId: result.orgId, tier: result.tier });
  } catch (err) {
    handleError(err, res);
  }
});

authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    const result = await loginUser(email, password);
    setSessionCookie(req, res, { sub: result.userId, orgId: result.orgId, tier: result.tier });
    res.json({ ok: true, userId: result.userId, orgId: result.orgId, tier: result.tier });
  } catch (err) {
    handleError(err, res);
  }
});

authRouter.post('/logout', (_req: Request, res: Response) => {
  clearSessionCookie(res);
  res.json({ ok: true });
});

authRouter.get('/me', authJwt, async (req: Request, res: Response) => {
  try {
    const me = await getMe(req.user!.sub);
    res.json(me);
  } catch (err) {
    handleError(err, res);
  }
});
