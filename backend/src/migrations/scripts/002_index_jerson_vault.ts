/**
 * 002_index_jerson_vault.ts — Indexa el vault completo de Jerson (user_001) en
 * vault_chunks para habilitar el RAG. Idempotente (reindexAll borra+reinserta
 * por nota). Tras la migración 001, user_001 tiene ~742 notas .md.
 *
 * USO:
 *   tsx src/migrations/scripts/002_index_jerson_vault.ts            (indexa todo)
 *   tsx src/migrations/scripts/002_index_jerson_vault.ts --query "tu pregunta"
 *      (además, corre un ragQuery de prueba al terminar)
 *
 * Resuelve user_001 por email canónico (jersonmendoza@eyesa.com.co).
 */
import { eq } from 'drizzle-orm';
import { db, pool } from '../../db/index.js';
import { users } from '../../db/schema.js';
import { reindexAll, ragQuery } from '../../services/vaultIndexer.js';

const JERSON_EMAIL = 'jersonmendoza@eyesa.com.co';

function parseArgs() {
  const argv = process.argv.slice(2);
  const qIdx = argv.indexOf('--query');
  const query = qIdx >= 0 ? argv[qIdx + 1] : undefined;
  return { query };
}

async function main() {
  const { query } = parseArgs();

  const [jerson] = await db.select().from(users).where(eq(users.email, JERSON_EMAIL)).limit(1);
  if (!jerson) throw new Error(`No existe el usuario ${JERSON_EMAIL}. Ejecuta primero la migración 001.`);
  console.log(`[002] usuario user_001 = ${jerson.id} (${jerson.displayName})`);

  const t0 = Date.now();
  let last = 0;
  const result = await reindexAll(jerson.id, {
    onProgress: (done, total) => {
      // Log cada 50 notas para no spamear.
      if (done - last >= 50 || done === total) {
        console.log(`[002] indexando… ${done}/${total} notas`);
        last = done;
      }
    },
  });
  const secs = ((Date.now() - t0) / 1000).toFixed(1);

  console.log('═'.repeat(60));
  console.log(`[002] ✓ Indexación completa en ${secs}s`);
  console.log(`        notas:   ${result.notes}`);
  console.log(`        chunks:  ${result.chunks}`);
  console.log(`        vacías:  ${result.skipped}`);
  console.log(`        errores: ${result.errors.length}`);
  if (result.errors.length) {
    for (const e of result.errors.slice(0, 10)) console.log(`          ⚠ ${e.notePath}: ${e.error}`);
  }
  console.log('═'.repeat(60));

  if (query) {
    console.log(`[002] ragQuery de prueba: "${query}"`);
    const hits = await ragQuery(jerson.id, query, 6);
    for (const h of hits) {
      console.log(`   • ${h.score.toFixed(4)}  ${h.notePath}`);
    }
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error('[002_index_jerson_vault] ERROR:', err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
