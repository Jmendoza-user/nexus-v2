/**
 * Aislamiento de filesystem por usuario.
 *
 * Cada usuario obtiene un directorio aislado:
 *   ${DATA_DIR}/users/user_NNNNNN_env/
 * con subdirs skills/ mcp/ connections/ vault/ workdir/ runs/ uploads/ (0750),
 * un .meta.json con {userId, orgId, tier, createdAt, seq} y un vault semilla.
 *
 * SECUENCIAL user_NNNNNN (decisión de diseño):
 *   El número es un secuencial estable derivado de una secuencia Postgres
 *   dedicada (`user_env_seq`). Al provisionar el env de un usuario por primera
 *   vez, se reserva un seq con `nextval()` y se persiste DENTRO de .meta.json.
 *   En provisiones posteriores (idempotencia) se reusa el seq de .meta.json
 *   buscando el directorio existente del usuario. Así el número es:
 *     - determinista por usuario (una vez asignado no cambia),
 *     - único (secuencia atómica de Postgres, sin colisiones en concurrencia),
 *     - independiente del orden de IDs UUID.
 *   Se evita escanear/parsear directorios para "adivinar" el siguiente número
 *   (frágil ante borrados). El mapeo userId→seq se guarda en el .meta.json y,
 *   redundantemente, podría espejearse en DB en un hito posterior
 *   (TODO-DEUDA(userenv-seq-db): columna users.env_seq para lookup O(1) sin fs).
 *
 * SEGURIDAD path traversal:
 *   resolveUserPaths(userId) devuelve rutas absolutas canónicas. Cualquier
 *   acceso a archivos del usuario DEBE validarse con assertWithinUserEnv()
 *   (path.resolve(target).startsWith(userPaths.root + sep)).
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { sql } from 'drizzle-orm';
import { env } from '../lib/env.js';
import { db } from '../db/index.js';

const USERS_ROOT = path.join(env.DATA_DIR, 'users');
const DIR_MODE = 0o750;

export interface UserEnvMeta {
  userId: string;
  orgId: string;
  tier: string;
  seq: number;
  createdAt: string;
}

export interface UserPaths {
  root: string;
  skills: string;
  mcp: string;
  connections: string;
  vault: string;
  workdir: string;
  runs: string;
  uploads: string;
  meta: string;
}

const SUBDIRS = ['skills', 'mcp', 'connections', 'vault', 'workdir', 'runs', 'uploads'] as const;

function envDirName(seq: number): string {
  return `user_${String(seq).padStart(6, '0')}_env`;
}

/** Construye el objeto de rutas a partir del nombre del directorio. */
function pathsFor(dirName: string): UserPaths {
  const root = path.join(USERS_ROOT, dirName);
  return {
    root,
    skills: path.join(root, 'skills'),
    mcp: path.join(root, 'mcp'),
    connections: path.join(root, 'connections'),
    vault: path.join(root, 'vault'),
    workdir: path.join(root, 'workdir'),
    runs: path.join(root, 'runs'),
    uploads: path.join(root, 'uploads'),
    meta: path.join(root, '.meta.json'),
  };
}

/**
 * Localiza el directorio env existente de un usuario (idempotencia).
 * Lee cada .meta.json bajo USERS_ROOT y compara userId. O(n) en nº de users;
 * aceptable a esta escala. Devuelve el seq si lo encuentra, o null.
 */
async function findExistingSeq(userId: string): Promise<number | null> {
  if (!existsSync(USERS_ROOT)) return null;
  const entries = await fs.readdir(USERS_ROOT, { withFileTypes: true });
  for (const e of entries) {
    if (!e.isDirectory() || !e.name.startsWith('user_')) continue;
    const metaPath = path.join(USERS_ROOT, e.name, '.meta.json');
    try {
      const meta = JSON.parse(await fs.readFile(metaPath, 'utf8')) as UserEnvMeta;
      if (meta.userId === userId) return meta.seq;
    } catch {
      /* ignora directorios sin meta válido */
    }
  }
  return null;
}

/** Reserva un nuevo seq atómico desde la secuencia Postgres dedicada. */
async function nextSeq(): Promise<number> {
  // Crea la secuencia si no existe (idempotente) y reserva el siguiente valor.
  await db.execute(sql`CREATE SEQUENCE IF NOT EXISTS user_env_seq START 1`);
  const res = await db.execute<{ nextval: string }>(sql`SELECT nextval('user_env_seq') AS nextval`);
  // node-postgres devuelve { rows }; drizzle execute expone .rows
  const rows = (res as unknown as { rows: { nextval: string }[] }).rows;
  return Number(rows[0]!.nextval);
}

/**
 * Resuelve las rutas del env de un usuario. Si el env aún no existe, devuelve
 * null (no inventa rutas). Para garantizar existencia, usar provisionUserEnv.
 */
export async function resolveUserPaths(userId: string): Promise<UserPaths | null> {
  const seq = await findExistingSeq(userId);
  if (seq === null) return null;
  return pathsFor(envDirName(seq));
}

/**
 * Valida que `target` quede contenido dentro del root del env del usuario.
 * Lanza si hay intento de path traversal. Devuelve la ruta canónica segura.
 */
export function assertWithinUserEnv(userPaths: UserPaths, target: string): string {
  const resolved = path.resolve(userPaths.root, target);
  const rootWithSep = userPaths.root.endsWith(path.sep)
    ? userPaths.root
    : userPaths.root + path.sep;
  if (resolved !== userPaths.root && !resolved.startsWith(rootWithSep)) {
    throw new PathTraversalError(target);
  }
  return resolved;
}

export class PathTraversalError extends Error {
  constructor(target: string) {
    super(`Acceso fuera del entorno del usuario bloqueado: ${target}`);
    this.name = 'PathTraversalError';
  }
}

const VAULT_TEMPLATES: Record<string, string> = {
  'Preferencias.md': `# Preferencias

Esta nota recoge tus preferencias y se actualiza con el tiempo a medida que tu
asistente aprende cómo te gusta trabajar.

## Tono
- Cercano y conciso. Tutea.

## Formato de respuestas
- Una sola recomendación clara, sin listas largas salvo que las pidas.

## Idioma
- Español neutro (LATAM).
`,
  'Aprendizajes_Repetitivos.md': `# Aprendizajes repetitivos

Tu asistente anota aquí los patrones que se repiten en tus conversaciones para
no volver a preguntarte lo mismo.

> Aún no hay aprendizajes registrados. Empieza a conversar y esta nota crecerá.
`,
};

const VAULT_GITKEEP_DIRS = ['Diarios', 'Conceptos'] as const;

async function seedVault(vaultDir: string): Promise<void> {
  for (const [name, content] of Object.entries(VAULT_TEMPLATES)) {
    const file = path.join(vaultDir, name);
    if (!existsSync(file)) {
      await fs.writeFile(file, content, { mode: 0o640 });
    }
  }
  for (const sub of VAULT_GITKEEP_DIRS) {
    const dir = path.join(vaultDir, sub);
    await fs.mkdir(dir, { recursive: true, mode: DIR_MODE });
    const keep = path.join(dir, '.gitkeep');
    if (!existsSync(keep)) await fs.writeFile(keep, '', { mode: 0o640 });
  }
}

/**
 * Provisiona (idempotente) el entorno aislado de un usuario.
 * - Crea root + subdirs con 0750.
 * - Escribe .meta.json.
 * - Seedea el vault con plantillas en español.
 * Devuelve las rutas del env.
 */
export async function provisionUserEnv(opts: {
  userId: string;
  orgId: string;
  tier: string;
}): Promise<UserPaths> {
  const { userId, orgId, tier } = opts;

  await fs.mkdir(USERS_ROOT, { recursive: true, mode: DIR_MODE });

  // Reusa seq existente (idempotencia) o reserva uno nuevo.
  let seq = await findExistingSeq(userId);
  if (seq === null) seq = await nextSeq();

  const paths = pathsFor(envDirName(seq));

  await fs.mkdir(paths.root, { recursive: true, mode: DIR_MODE });
  for (const sub of SUBDIRS) {
    await fs.mkdir(path.join(paths.root, sub), { recursive: true, mode: DIR_MODE });
  }

  const meta: UserEnvMeta = {
    userId,
    orgId,
    tier,
    seq,
    createdAt: new Date().toISOString(),
  };
  await fs.writeFile(paths.meta, JSON.stringify(meta, null, 2), { mode: 0o640 });

  await seedVault(paths.vault);

  return paths;
}
