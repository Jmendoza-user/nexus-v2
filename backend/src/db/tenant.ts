/**
 * tenantScoped — política de aislamiento por tenant a nivel ORM.
 *
 * REGLA DE ORO (ver backend/README.md):
 *   Ningún handler fuera de `services/admin/*` debe ejecutar
 *   `db.select().from(tabla)` directo sobre una tabla con `user_id`.
 *   TODO acceso pasa por `tenantScoped(userId)`, que inyecta SIEMPRE
 *   `where(eq(tabla.userId, userId))`. Esto evita fugas cross-tenant por
 *   olvido de filtro (Riesgo #2 del plan maestro).
 *
 * El helper expone métodos que envuelven las operaciones comunes (list, find,
 * insert, update, remove) garantizando el filtro de tenant. Para mutaciones,
 * `update`/`remove` filtran por (id AND user_id): si la fila pertenece a otro
 * tenant, la operación afecta 0 filas → el handler devuelve 404 (no 403),
 * sin revelar la existencia del recurso ajeno.
 *
 * TODO-DEUDA(tenant-linter): falta el linter ESLint custom que prohíba
 *   `db.select().from()` directo fuera de services/admin/*. Anotado como deuda;
 *   por ahora la disciplina se enforce por convención + tests no-leak.
 */
import { and, desc, eq, SQL } from 'drizzle-orm';
import type { PgTable, PgColumn } from 'drizzle-orm/pg-core';
import { db } from './index.js';

/**
 * Tablas de dominio scoped: deben exponer columnas `id` y `userId`.
 * Restringimos el tipo para que solo se puedan pasar tablas con esas columnas.
 */
type ScopedTable = PgTable & {
  id: PgColumn;
  userId: PgColumn;
  createdAt?: PgColumn;
};

export function tenantScoped(userId: string) {
  return {
    /** Lista todas las filas del tenant, ordenadas por created_at desc si existe. */
    async list<T extends ScopedTable>(
      table: T,
      opts?: { extraWhere?: SQL }
    ): Promise<T['$inferSelect'][]> {
      const base = eq(table.userId, userId);
      const where = opts?.extraWhere ? and(base, opts.extraWhere) : base;
      const q = db.select().from(table as PgTable).where(where);
      if (table.createdAt) {
        return (await q.orderBy(desc(table.createdAt))) as T['$inferSelect'][];
      }
      return (await q) as T['$inferSelect'][];
    },

    /** Busca una fila por id, solo si pertenece al tenant. Devuelve null si no. */
    async find<T extends ScopedTable>(
      table: T,
      id: string
    ): Promise<T['$inferSelect'] | null> {
      const rows = await db
        .select()
        .from(table as PgTable)
        .where(and(eq(table.id, id), eq(table.userId, userId)))
        .limit(1);
      return (rows[0] as T['$inferSelect']) ?? null;
    },

    /** Inserta forzando user_id del tenant (sobrescribe cualquier userId entrante). */
    async insert<T extends ScopedTable>(
      table: T,
      values: T['$inferInsert']
    ): Promise<T['$inferSelect']> {
      const rows = await db
        .insert(table as PgTable)
        .values({ ...values, userId } as T['$inferInsert'])
        .returning();
      return rows[0] as T['$inferSelect'];
    },

    /**
     * Actualiza una fila por id solo si pertenece al tenant.
     * Devuelve la fila actualizada o null (0 filas afectadas → recurso ajeno/inexistente).
     */
    async update<T extends ScopedTable>(
      table: T,
      id: string,
      patch: Partial<T['$inferInsert']>
    ): Promise<T['$inferSelect'] | null> {
      // Nunca permitir reasignar el tenant vía patch.
      const { userId: _omit, id: _omitId, ...safePatch } = patch as Record<string, unknown>;
      const rows = await db
        .update(table as PgTable)
        .set(safePatch)
        .where(and(eq(table.id, id), eq(table.userId, userId)))
        .returning();
      return (rows[0] as T['$inferSelect']) ?? null;
    },

    /** Borra una fila por id solo si pertenece al tenant. Devuelve true si borró. */
    async remove<T extends ScopedTable>(table: T, id: string): Promise<boolean> {
      const rows = await db
        .delete(table as PgTable)
        .where(and(eq(table.id, id), eq(table.userId, userId)))
        .returning();
      return rows.length > 0;
    },
  };
}

export type TenantScoped = ReturnType<typeof tenantScoped>;
