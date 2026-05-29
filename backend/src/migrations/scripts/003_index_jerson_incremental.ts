/**
 * 003_index_jerson_incremental.ts — Indexa SOLO las notas del vault de user_001
 * que aún no tienen chunks. Secuencial (una a una) para no saturar BGE (CPU-bound).
 * Idempotente y resumible: se puede correr varias veces; cada corrida avanza.
 *
 * Throttle vía env BGE_BATCH_SIZE / BGE_BATCH_DELAY_MS (los lee embeddings.ts).
 * Uso: tsx src/migrations/scripts/003_index_jerson_incremental.ts
 */
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { db, pool } from '../../db/index.js';
import { resolveUserPaths } from '../../services/userEnv.js';
import { indexNote } from '../../services/vaultIndexer.js';

const USER_ID = '8bb1fae8-ba0f-4464-a763-ac1b74a3d54d'; // Jerson / user_001

function listMd(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const abs = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === '.git' || entry.name === '.obsidian') continue;
        walk(abs);
      } else if (entry.name.toLowerCase().endsWith('.md')) {
        out.push(abs);
      }
    }
  };
  walk(root);
  return out;
}

async function main() {
  const p = await resolveUserPaths(USER_ID);
  if (!p) {
    throw new Error(`No se encontró el env del usuario ${USER_ID}; provisiona primero.`);
  }
  const allAbs = listMd(p.vault);
  const allRel = allAbs.map((a) => path.relative(p.vault, a));

  const done = new Set(
    (await db.execute(sql`SELECT DISTINCT note_path FROM vault_chunks WHERE user_id = ${USER_ID}`)).rows.map(
      (r: Record<string, unknown>) => String(r.note_path),
    ),
  );

  const pending = allRel.filter((rel) => !done.has(rel));
  console.log(`[idx] total=${allRel.length} indexadas=${done.size} pendientes=${pending.length}`);

  let ok = 0;
  let chunks = 0;
  const errors: Array<{ note: string; err: string }> = [];

  for (let i = 0; i < pending.length; i++) {
    const rel = pending[i]!;
    try {
      const res = await indexNote(USER_ID, rel);
      ok++;
      chunks += res.chunks;
      if (i % 10 === 0 || i === pending.length - 1) {
        console.log(`[idx] ${i + 1}/${pending.length}  ok=${ok} chunks+=${chunks}  última="${rel}"`);
      }
    } catch (e) {
      errors.push({ note: rel, err: (e as Error).message });
      console.log(`[idx] ERROR en "${rel}": ${(e as Error).message}`);
    }
  }

  console.log(`[idx] LISTO. notas_ok=${ok} chunks_nuevos=${chunks} errores=${errors.length}`);
  if (errors.length) console.log(`[idx] notas con error:`, errors.slice(0, 10));

  const final = await db.execute(
    sql`SELECT count(DISTINCT note_path) AS notas, count(*) AS chunks FROM vault_chunks WHERE user_id = ${USER_ID}`,
  );
  console.log(`[idx] total en DB ahora:`, final.rows[0]);

  void statSync;
  await pool.end();
}

main().catch(async (err) => {
  console.error('[003_index_incremental] ERROR:', err);
  try {
    await pool.end();
  } catch {
    /* noop */
  }
  process.exit(1);
});
