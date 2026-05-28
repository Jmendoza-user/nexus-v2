/**
 * Emisión/verificación de JWT y manejo de la cookie de sesión.
 *
 * Decisiones:
 * - Cookie httpOnly, sameSite=lax (permite navegación normal cross-site GET),
 *   secure solo si la request llegó por https (detrás de NPM/Cloudflare).
 * - Payload mínimo: { sub: userId, orgId, tier }. El estado autoritativo vive
 *   en la DB; el JWT es solo una credencial de sesión (expira 7 días).
 */
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import { env } from './env.js';

export const COOKIE_NAME = 'nexus_v2_session';
const TOKEN_EXPIRY = '7d';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface JwtPayload {
  sub: string; // userId
  orgId: string;
  tier: string;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
}

function isHttps(req: Request): boolean {
  return req.secure || req.headers['x-forwarded-proto'] === 'https';
}

export function setSessionCookie(req: Request, res: Response, payload: JwtPayload): void {
  res.cookie(COOKIE_NAME, signToken(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: isHttps(req),
    maxAge: MAX_AGE_MS,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}
