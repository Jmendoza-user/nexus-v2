/**
 * Servicio de Skills.
 *
 * Una "skill" es una definición (SKILL.md) que vive en el catálogo global
 * (skills_catalog) y que se "instala" materializándola en el env aislado del
 * usuario: ${env}/skills/<key>/SKILL.md. La instalación queda registrada en
 * skill_installations (scoped por usuario).
 *
 * SEGURIDAD:
 *  - El install_path SIEMPRE se valida con assertWithinUserEnv() para impedir
 *    path traversal: una skillKey maliciosa (../, /etc, ...) se rechaza.
 *  - skillKey se valida contra un patrón estricto [a-z0-9-] antes de tocar fs.
 *
 * El runtime real de la skill (ejecutar tools/MCP) es deuda de hitos futuros;
 * aquí "instalar" = escribir el .md + registrar. Es lo que el agente
 * autocurativo necesita para reparar runs que dependen de una skill.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  skillsCatalog,
  skillInstallations,
  type SkillCatalogEntry,
  type SkillInstallation,
} from '../db/schema.js';
import {
  resolveUserPaths,
  provisionUserEnv,
  assertWithinUserEnv,
  type UserPaths,
} from './userEnv.js';

/** Patrón estricto de skillKey: minúsculas, dígitos y guiones. */
const SKILL_KEY_RE = /^[a-z0-9][a-z0-9-]{0,63}$/;

export class SkillError extends Error {
  constructor(
    public code:
      | 'invalid_key'
      | 'not_in_catalog'
      | 'env_unavailable'
      | 'not_installed',
    message: string
  ) {
    super(message);
    this.name = 'SkillError';
  }
}

export interface InstalledSkillView extends SkillInstallation {
  /** Datos del catálogo si la skill sigue existiendo en él. */
  catalog: SkillCatalogEntry | null;
}

function assertValidKey(skillKey: string): void {
  if (!SKILL_KEY_RE.test(skillKey)) {
    throw new SkillError('invalid_key', `skillKey inválida: ${skillKey}`);
  }
}

/** Catálogo completo de skills disponibles (global, no scoped). */
export async function listCatalog(): Promise<SkillCatalogEntry[]> {
  return db.select().from(skillsCatalog).orderBy(skillsCatalog.name);
}

async function getCatalogEntry(skillKey: string): Promise<SkillCatalogEntry | null> {
  const [row] = await db
    .select()
    .from(skillsCatalog)
    .where(eq(skillsCatalog.key, skillKey))
    .limit(1);
  return row ?? null;
}

/** Instalaciones del usuario, enriquecidas con el catálogo. */
export async function listInstalled(userId: string): Promise<InstalledSkillView[]> {
  const rows = await db
    .select()
    .from(skillInstallations)
    .where(eq(skillInstallations.userId, userId));
  const catalog = await listCatalog();
  const byKey = new Map(catalog.map((c) => [c.key, c]));
  return rows.map((r) => ({ ...r, catalog: byKey.get(r.skillKey) ?? null }));
}

/** Genera el contenido del SKILL.md desde una entrada del catálogo. */
export function renderSkillMd(entry: SkillCatalogEntry): string {
  const caps = (entry.capabilities as string[]) ?? [];
  const mcp = (entry.requiresMcp as string[]) ?? [];
  return `# ${entry.name}

${entry.description}

## Capacidades
${caps.length ? caps.map((c) => `- ${c}`).join('\n') : '- (sin capacidades declaradas)'}

## MCPs requeridos
${mcp.length ? mcp.map((m) => `- ${m}`).join('\n') : '- (ninguno)'}

---
key: ${entry.key}
source: ${entry.sourceType}${entry.sourceRef ? ` (${entry.sourceRef})` : ''}
`;
}

/** Asegura que el env del usuario exista; lo provisiona si hace falta. */
async function ensureUserPaths(userId: string): Promise<UserPaths> {
  let paths = await resolveUserPaths(userId);
  if (paths) return paths;
  // Provisiona usando el orgId/tier del usuario (lo necesitamos para .meta.json).
  const { users } = await import('../db/schema.js');
  const [u] = await db
    .select({ orgId: users.defaultOrgId, tier: users.tier })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!u?.orgId) {
    throw new SkillError('env_unavailable', 'El usuario no tiene entorno aislado disponible.');
  }
  paths = await provisionUserEnv({ userId, orgId: u.orgId, tier: u.tier });
  return paths;
}

/** Ruta absoluta validada del directorio de la skill dentro del env. */
function skillDir(paths: UserPaths, skillKey: string): string {
  // install_path relativo al ROOT del env: 'skills/<key>'.
  return assertWithinUserEnv(paths, path.join('skills', skillKey));
}

/**
 * Instala una skill del catálogo en el env del usuario (idempotente).
 * - Escribe ${env}/skills/<key>/SKILL.md desde el catálogo.
 * - Upsert en skill_installations (status=installed).
 * @param source registry (manual) | autocure (agente) | user.
 */
export async function installSkill(
  userId: string,
  skillKey: string,
  source: 'registry' | 'autocure' | 'user' = 'registry'
): Promise<SkillInstallation> {
  assertValidKey(skillKey);
  const entry = await getCatalogEntry(skillKey);
  if (!entry) {
    throw new SkillError('not_in_catalog', `La skill "${skillKey}" no existe en el catálogo.`);
  }

  const paths = await ensureUserPaths(userId);
  const dir = skillDir(paths, skillKey);
  await fs.mkdir(dir, { recursive: true, mode: 0o750 });
  const mdPath = path.join(dir, 'SKILL.md');
  await fs.writeFile(mdPath, renderSkillMd(entry), { mode: 0o640 });

  const installPath = path.join('skills', skillKey); // relativo al env

  const [row] = await db
    .insert(skillInstallations)
    .values({
      userId,
      skillKey,
      installPath,
      source,
      status: 'installed',
      error: null,
    })
    .onConflictDoUpdate({
      target: [skillInstallations.userId, skillInstallations.skillKey],
      set: {
        installPath,
        source,
        status: 'installed',
        error: null,
        installedAt: new Date(),
      },
    })
    .returning();
  return row!;
}

/**
 * Desinstala una skill: borra el directorio del env y el registro.
 * Idempotente: si no estaba instalada, no falla (devuelve false).
 */
export async function uninstallSkill(userId: string, skillKey: string): Promise<boolean> {
  assertValidKey(skillKey);
  const paths = await resolveUserPaths(userId);
  if (paths) {
    const dir = skillDir(paths, skillKey);
    if (existsSync(dir)) {
      await fs.rm(dir, { recursive: true, force: true });
    }
  }
  const deleted = await db
    .delete(skillInstallations)
    .where(and(eq(skillInstallations.userId, userId), eq(skillInstallations.skillKey, skillKey)))
    .returning({ id: skillInstallations.id });
  return deleted.length > 0;
}

/**
 * ¿Está la skill REALMENTE presente en disco? (no solo registrada).
 * El autocure usa esto para detectar el caso "registrada pero borrada".
 */
export async function isSkillOnDisk(userId: string, skillKey: string): Promise<boolean> {
  assertValidKey(skillKey);
  const paths = await resolveUserPaths(userId);
  if (!paths) return false;
  const dir = skillDir(paths, skillKey);
  return existsSync(path.join(dir, 'SKILL.md'));
}
