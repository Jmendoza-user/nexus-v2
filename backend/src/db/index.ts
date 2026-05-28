/**
 * Setup de Drizzle sobre node-postgres (pg Pool).
 * Una sola instancia de pool compartida en todo el proceso.
 */
import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import * as schema from './schema.js';
import { env } from '../lib/env.js';

export const pool = new pg.Pool({ connectionString: env.DATABASE_URL });

export const db = drizzle(pool, { schema });

export { schema };
export default db;
