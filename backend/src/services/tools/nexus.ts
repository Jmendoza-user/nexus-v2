/**
 * Herramientas CANÓNICAS internas de NEXUS — el núcleo del producto.
 *
 * La IA gestiona registros en TODOS los módulos (proyectos, tareas, finanzas,
 * vault) emitiendo {"tool","args"}; aquí se valida y ejecuta contra los
 * servicios reales, con aislamiento por usuario (scoped). Misma mecánica que las
 * tools de Google, pero para los datos internos del usuario.
 *
 * Convención: lectura/creación se ejecutan directo; BORRAR exige args.confirmed
 * === true (HITL) — si falta, se devuelve requires_confirmation.
 */
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { eq } from 'drizzle-orm';
import { projects, issues, type Project, type Issue } from '../../db/schema.js';
import type { TenantScoped } from '../../db/tenant.js';
import { createDraft, listTransactions, summary as financeSummary } from '../finance/service.js';
import type { Classification, TxTipo } from '../finance/classifier.js';
import { ragQuery, indexNote } from '../vaultIndexer.js';
import { resolveUserPaths, assertWithinUserEnv } from '../userEnv.js';

export interface ToolCtx {
  userId: string;
  orgId: string;
  tier: string;
  scoped: TenantScoped;
}

export interface ToolResult {
  ok: boolean;
  [k: string]: unknown;
}

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));
const VALID_TIPOS: TxTipo[] = ['Egreso', 'Ingreso', 'Inversion', 'Deuda'];

// ── Catálogo (para el system prompt) ────────────────────────────────────────
// name → { desc, destructive }. El esquema de args va en la descripción para
// que el modelo sepa exactamente qué mandar.
export const NEXUS_TOOLS: Record<string, { desc: string; destructive?: boolean }> = {
  // Proyectos
  crear_proyecto: { desc: 'Crea un proyecto. args: {nombre, descripcion?}' },
  listar_proyectos: { desc: 'Lista los proyectos del usuario con su progreso. args: {}' },
  editar_proyecto: { desc: 'Edita un proyecto. args: {proyecto (nombre o id), nombre?, descripcion?, estado?}' },
  borrar_proyecto: { desc: 'Borra un proyecto. args: {proyecto, confirmed}', destructive: true },
  // Tareas
  crear_tarea: { desc: 'Crea una tarea dentro de un proyecto. args: {proyecto (nombre o id), titulo, prioridad? (low|medium|high|urgent)}' },
  completar_tarea: { desc: 'Marca una tarea como completada. args: {proyecto, titulo} o {id}' },
  listar_tareas: { desc: 'Lista tareas (de un proyecto o todas). args: {proyecto?}' },
  borrar_tarea: { desc: 'Borra una tarea. args: {id, confirmed}', destructive: true },
  // Finanzas (entra como Borrador para que el usuario apruebe)
  crear_movimiento: { desc: 'Registra un movimiento financiero como BORRADOR para aprobar. args: {tipo (Egreso|Ingreso|Inversion|Deuda), monto (número), categoria?, comercio?, fecha? (ISO)}' },
  listar_movimientos: { desc: 'Lista movimientos recientes. args: {}' },
  resumen_finanzas: { desc: 'Resumen financiero del mes (balance, ingresos, egresos). args: {}' },
  // Vault
  buscar_vault: { desc: 'Busca en las notas del usuario por significado (RAG). args: {consulta}' },
  crear_nota: { desc: 'Crea una nota en el vault. args: {titulo, contenido, carpeta?}' },
  listar_proyectos_y_tareas: { desc: 'Vista rápida de proyectos y cuántas tareas abiertas tiene cada uno. args: {}' },
};

export function isNexusTool(name: string): boolean {
  return Object.prototype.hasOwnProperty.call(NEXUS_TOOLS, name);
}

// ── Helpers de resolución ───────────────────────────────────────────────────
async function findProject(ctx: ToolCtx, ref: string): Promise<Project | null> {
  const r = str(ref);
  if (!r) return null;
  const all = await ctx.scoped.list(projects);
  return (
    all.find((p) => p.id === r) ??
    all.find((p) => p.name.toLowerCase() === r.toLowerCase()) ??
    all.find((p) => p.name.toLowerCase().includes(r.toLowerCase())) ??
    null
  );
}

function slugify(s: string): string {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'nota';
}

// ── Ejecutor ────────────────────────────────────────────────────────────────
export async function runNexusTool(ctx: ToolCtx, name: string, rawArgs: unknown): Promise<ToolResult> {
  if (!isNexusTool(name)) return { ok: false, error: `Herramienta interna desconocida: ${name}` };
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const meta = NEXUS_TOOLS[name];
  if (!meta) return { ok: false, error: `Herramienta interna desconocida: ${name}` };
  if (meta.destructive && args.confirmed !== true) {
    return { ok: false, requires_confirmation: true, message: 'Acción destructiva: pide confirmación explícita al usuario y reintenta con "confirmed": true.' };
  }

  try {
    switch (name) {
      // ── Proyectos ──
      case 'crear_proyecto': {
        const nombre = str(args.nombre);
        if (!nombre) return { ok: false, error: 'Falta el nombre del proyecto.' };
        const row = await ctx.scoped.insert(projects, {
          userId: ctx.userId, orgId: ctx.orgId, name: nombre,
          description: args.descripcion ? str(args.descripcion) : null, status: 'active',
        });
        return { ok: true, id: row.id, message: `Proyecto "${nombre}" creado.` };
      }
      case 'listar_proyectos':
      case 'listar_proyectos_y_tareas': {
        const [ps, all] = await Promise.all([ctx.scoped.list(projects), ctx.scoped.list(issues)]);
        const open = new Map<string, number>();
        for (const i of all) if (i.projectId && i.status !== 'done') open.set(i.projectId, (open.get(i.projectId) ?? 0) + 1);
        return { ok: true, count: ps.length, proyectos: ps.map((p) => ({ id: p.id, nombre: p.name, estado: p.status, tareas_abiertas: open.get(p.id) ?? 0 })) };
      }
      case 'editar_proyecto': {
        const p = await findProject(ctx, str(args.proyecto));
        if (!p) return { ok: false, error: 'No encontré ese proyecto.' };
        const patch: Record<string, unknown> = {};
        if (args.nombre) patch.name = str(args.nombre);
        if (args.descripcion !== undefined) patch.description = args.descripcion ? str(args.descripcion) : null;
        if (args.estado) patch.status = str(args.estado);
        const u = await ctx.scoped.update(projects, p.id, patch);
        return { ok: true, id: u?.id, message: `Proyecto "${p.name}" actualizado.` };
      }
      case 'borrar_proyecto': {
        const p = await findProject(ctx, str(args.proyecto));
        if (!p) return { ok: false, error: 'No encontré ese proyecto.' };
        await ctx.scoped.remove(projects, p.id);
        return { ok: true, message: `Proyecto "${p.name}" eliminado.` };
      }
      // ── Tareas ──
      case 'crear_tarea': {
        const p = await findProject(ctx, str(args.proyecto));
        if (!p) return { ok: false, error: 'No encontré el proyecto para la tarea. Pide al usuario a qué proyecto va, o créalo primero.' };
        const titulo = str(args.titulo);
        if (!titulo) return { ok: false, error: 'Falta el título de la tarea.' };
        const existing = await ctx.scoped.list(issues, { extraWhere: eq(issues.projectId, p.id) });
        const prefix = (p.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 4).toUpperCase()) || 'TASK';
        const priority = ['low', 'medium', 'high', 'urgent'].includes(str(args.prioridad)) ? str(args.prioridad) : 'medium';
        const row = await ctx.scoped.insert(issues, {
          userId: ctx.userId, orgId: ctx.orgId, projectId: p.id,
          identifier: `${prefix}-${existing.length + 1}`, title: titulo, status: 'open', priority,
        });
        return { ok: true, id: row.id, identifier: row.identifier, message: `Tarea "${titulo}" creada en ${p.name}.` };
      }
      case 'completar_tarea': {
        let target: Issue | null = null;
        if (args.id) target = await ctx.scoped.find(issues, str(args.id));
        else {
          const p = await findProject(ctx, str(args.proyecto));
          const list = p ? await ctx.scoped.list(issues, { extraWhere: eq(issues.projectId, p.id) }) : await ctx.scoped.list(issues);
          const t = str(args.titulo).toLowerCase();
          target = list.find((i) => i.title.toLowerCase() === t) ?? list.find((i) => i.title.toLowerCase().includes(t)) ?? null;
        }
        if (!target) return { ok: false, error: 'No encontré esa tarea.' };
        await ctx.scoped.update(issues, target.id, { status: 'done' });
        return { ok: true, message: `Tarea "${target.title}" marcada como completada.` };
      }
      case 'listar_tareas': {
        let list: Issue[];
        if (args.proyecto) {
          const p = await findProject(ctx, str(args.proyecto));
          if (!p) return { ok: false, error: 'No encontré ese proyecto.' };
          list = await ctx.scoped.list(issues, { extraWhere: eq(issues.projectId, p.id) });
        } else list = await ctx.scoped.list(issues);
        return { ok: true, count: list.length, tareas: list.map((i) => ({ id: i.id, titulo: i.title, estado: i.status, prioridad: i.priority })) };
      }
      case 'borrar_tarea': {
        const ok = await ctx.scoped.remove(issues, str(args.id));
        return ok ? { ok: true, message: 'Tarea eliminada.' } : { ok: false, error: 'No encontré esa tarea.' };
      }
      // ── Finanzas (Borrador → el usuario aprueba en Finanzas) ──
      case 'crear_movimiento': {
        const tipo = str(args.tipo) as TxTipo;
        if (!VALID_TIPOS.includes(tipo)) return { ok: false, error: `tipo inválido. Usa uno de: ${VALID_TIPOS.join(', ')}.` };
        const monto = Number(args.monto);
        if (!Number.isFinite(monto) || monto <= 0) return { ok: false, error: 'monto debe ser un número positivo.' };
        const classification: Classification = {
          tipo, monto, currency: 'COP',
          categoria: args.categoria ? str(args.categoria) : null,
          comercioOrigen: args.comercio ? str(args.comercio) : null,
          fechaHora: args.fecha ? str(args.fecha) : null,
          legitimo: true, confidence: 90, reason: 'Registrado por el asistente', redacted: false, model: null,
        } as Classification;
        const row = await createDraft(ctx.userId, { classification, canal: 'Manual' });
        return { ok: true, id: row.id, message: `Movimiento registrado como BORRADOR (${tipo} ${monto} COP). El usuario debe aprobarlo en Finanzas.` };
      }
      case 'listar_movimientos': {
        const rows = (await listTransactions(ctx.userId, {})).slice(0, 10);
        return { ok: true, movimientos: rows };
      }
      case 'resumen_finanzas': {
        const s = await financeSummary(ctx.userId);
        return { ok: true, resumen: s };
      }
      // ── Vault ──
      case 'buscar_vault': {
        const hits = await ragQuery(ctx.userId, str(args.consulta), 6);
        return { ok: true, count: hits.length, resultados: hits.map((h) => ({ nota: h.notePath, fragmento: h.chunk.slice(0, 500), score: Number(h.score.toFixed(3)) })) };
      }
      case 'crear_nota': {
        const titulo = str(args.titulo);
        const contenido = str(args.contenido);
        if (!titulo) return { ok: false, error: 'Falta el título de la nota.' };
        const paths = await resolveUserPaths(ctx.userId);
        if (!paths) return { ok: false, error: 'El entorno del usuario no está provisionado.' };
        const carpeta = args.carpeta ? slugify(str(args.carpeta)) + '/' : '';
        const rel = `${carpeta}${slugify(titulo)}.md`;
        const abs = assertWithinUserEnv(paths, path.join('vault', rel));
        if (existsSync(abs)) return { ok: false, error: 'Ya existe una nota con ese nombre.' };
        const body = `# ${titulo}\n\n${contenido}\n`;
        await fs.mkdir(path.dirname(abs), { recursive: true });
        await fs.writeFile(abs, body, { mode: 0o640 });
        indexNote(ctx.userId, rel).catch(() => {});
        return { ok: true, nota: rel, message: `Nota "${titulo}" creada en el vault.` };
      }
      default:
        return { ok: false, error: `Herramienta no implementada: ${name}` };
    }
  } catch (e) {
    return { ok: false, error: `Fallo en ${name}: ${(e as Error).message}` };
  }
}

/** Bloque de catálogo para el system prompt del asistente. */
export function nexusToolsBlock(): string {
  const lines = Object.entries(NEXUS_TOOLS).map(([n, m]) => `- ${n}: ${m.desc}${m.destructive ? ' [DESTRUCTIVA]' : ''}`);
  return [
    '',
    'GESTIÓN DE REGISTROS DE NEXUS — puedes crear, editar, completar y borrar registros del',
    'usuario en sus módulos usando el MISMO protocolo JSON {"tool":"...","args":{...}}:',
    ...lines,
    'Reglas: si el usuario pide organizarse (un proyecto, una tarea, anotar un gasto, una nota),',
    'USA estas herramientas en vez de solo responder. Para crear una tarea necesitas el proyecto:',
    'si no lo dice, pregúntale o lístale los proyectos. Para BORRAR, confirma primero y reintenta',
    'con "confirmed": true. Los movimientos financieros entran como BORRADOR (el usuario aprueba).',
  ].join('\n');
}
