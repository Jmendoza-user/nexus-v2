/**
 * Aplica las migraciones generadas por drizzle-kit a la DB nexus_v2.
 * Las extensiones (citext, pgcrypto, vector) ya se habilitan en el bootstrap
 * SQL (drizzle/0000_*.sql lleva un statement-breakpoint inicial) o vía el
 * superusuario; aquí solo se aseguran de forma idempotente por si acaso.
 */
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';
import { seedTierPolicies } from './seedTierPolicies.js';
import { seedSkillsCatalog } from './seedSkillsCatalog.js';

async function main() {
  console.log('[migrate] asegurando extensiones...');
  // citext/pgcrypto/vector ya fueron creadas por el superusuario al crear la DB.
  // Estos statements son no-op si ya existen; si el rol no tiene permiso para
  // crearlas, se ignora el error (ya están presentes).
  for (const ext of ['citext', 'pgcrypto', 'vector']) {
    try {
      await db.execute(sql.raw(`CREATE EXTENSION IF NOT EXISTS ${ext}`));
    } catch (e) {
      console.warn(`[migrate] no se pudo CREATE EXTENSION ${ext} (probablemente ya existe):`, (e as Error).message);
    }
  }

  console.log('[migrate] aplicando migraciones...');
  await migrate(db, { migrationsFolder: './drizzle' });
  console.log('[migrate] OK');

  console.log('[migrate] sembrando tier_policies...');
  await seedTierPolicies();
  console.log('[migrate] tier_policies OK');

  console.log('[migrate] sembrando skills_catalog...');
  await seedSkillsCatalog();
  console.log('[migrate] skills_catalog OK');

  await pool.end();
}

main().catch((err) => {
  console.error('[migrate] error:', err);
  process.exit(1);
});
