/**
 * Helpers compartidos de test: app supertest + login que captura la cookie.
 */
import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';

export const app: Express = createApp();

/** Hace login y devuelve el header Cookie para reusar en requests autenticados. */
export async function loginAndGetCookie(email: string, password: string): Promise<string> {
  const res = await request(app).post('/api/auth/login').send({ email, password });
  if (res.status !== 200) {
    throw new Error(`login falló (${res.status}): ${JSON.stringify(res.body)}`);
  }
  const setCookie = res.headers['set-cookie'];
  if (!setCookie || setCookie.length === 0) {
    throw new Error('login no devolvió set-cookie');
  }
  // Extrae solo el par nombre=valor (sin atributos) de la primera cookie.
  return (Array.isArray(setCookie) ? setCookie : [setCookie]).map((c) => c.split(';')[0]).join('; ');
}
