/**
 * Cifrado AES-256-GCM para secretos de connections (tokens OAuth, etc.).
 * Portado del patrón de V1 (services/google/crypto.ts) usando ENCRYPTION_KEY.
 *
 * Formato del blob (base64): IV(12) | TAG(16) | CIPHERTEXT(N).
 */
import crypto from 'node:crypto';
import { env } from './env.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function getKey(): Buffer {
  return Buffer.from(env.ENCRYPTION_KEY, 'hex');
}

export function encrypt(plaintext: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString('base64');
}

export function decrypt(blob: string): string {
  const buf = Buffer.from(blob, 'base64');
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error('Blob cifrado con tamaño inválido.');
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
