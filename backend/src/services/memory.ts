/**
 * Memoria del usuario — hechos que la IA aprende y usa de forma IMPLÍCITA.
 *
 * Filosofía (decisión de producto):
 *  - La IA NO interroga al usuario, salvo que él inicie el "protocolo de conocimiento".
 *  - Captura pasiva: registra hechos clave que surjan en conversación, en silencio.
 *  - Uso implícito: conoce al usuario pero NO recita lo que sabe ni gira la
 *    conversación en torno a ello (como un amigo que ya te conoce).
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { userMemory, type UserMemory } from '../db/schema.js';

export async function getUserMemory(userId: string): Promise<UserMemory[]> {
  return db.select().from(userMemory).where(eq(userMemory.userId, userId)).orderBy(desc(userMemory.updatedAt));
}

export interface FactInput {
  category: string;
  label: string;
  value: string;
  source?: string;
  confidence?: number;
}

/** Upsert por (userId, category, label) — registrar o actualizar un hecho. */
export async function recordFact(userId: string, orgId: string, f: FactInput): Promise<UserMemory> {
  const [row] = await db
    .insert(userMemory)
    .values({
      userId,
      orgId,
      category: f.category,
      label: f.label,
      value: f.value,
      source: f.source ?? 'conversacion',
      confidence: f.confidence ?? 80,
    })
    .onConflictDoUpdate({
      target: [userMemory.userId, userMemory.category, userMemory.label],
      set: { value: f.value, source: f.source ?? 'conversacion', confidence: f.confidence ?? 80, updatedAt: sql`now()` },
    })
    .returning();
  return row!;
}

export async function forgetFact(userId: string, label: string): Promise<boolean> {
  const rows = await db
    .delete(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.label, label)))
    .returning();
  return rows.length > 0;
}

export function protocolDone(facts: UserMemory[]): boolean {
  return facts.some((f) => f.category === 'meta' && f.label === 'protocolo_conocimiento');
}

function formatFacts(facts: UserMemory[]): string {
  const real = facts.filter((f) => f.category !== 'meta');
  if (!real.length) return '';
  const byCat = new Map<string, string[]>();
  for (const f of real) {
    const arr = byCat.get(f.category) ?? [];
    arr.push(`${f.label}: ${f.value}`);
    byCat.set(f.category, arr);
  }
  return [...byCat.entries()].map(([c, items]) => `  ${c} — ${items.join('; ')}`).join('\n');
}

/** Bloque de system prompt: lo que la IA sabe + cómo usarlo + captura + protocolo. */
export function userMemoryBlock(facts: UserMemory[]): string {
  const known = formatFacts(facts);
  const done = protocolDone(facts);
  const lines: string[] = ['', 'MEMORIA DEL USUARIO:'];

  if (known) {
    lines.push('Esto ya lo sabes del usuario:');
    lines.push(known);
    lines.push('REGLA DE ORO: usa este conocimiento para ser relevante y natural, pero NUNCA lo recites');
    lines.push('ni hagas que la conversación gire en torno a él. No empieces frases con "Como X que eres…".');
    lines.push('Intégralo de forma implícita, como un amigo que ya te conoce: el saber se nota en cómo');
    lines.push('respondes, no en mencionarlo a cada rato.');
  } else {
    lines.push('Todavía no sabes casi nada del usuario; eso está bien, lo irás conociendo con el tiempo.');
  }

  lines.push('');
  lines.push('CAPTURA PASIVA: cuando el usuario revele algo clave sobre sí mismo o su entorno (profesión,');
  lines.push('nombres de personas/proyectos/herramientas, preferencias, contexto de trabajo), regístralo con');
  lines.push('la tool "recordar" SIN anunciarlo (no digas "lo anoté" ni "lo recordaré"). Sé selectivo: solo');
  lines.push('lo que de verdad ayude a conocerlo mejor, no trivialidades.');
  lines.push('NO interrogues al usuario ni le hagas preguntas tipo cuestionario para conocerlo.');

  if (!done) {
    lines.push('PROTOCOLO DE CONOCIMIENTO (opt-in): SOLO si el usuario pide explícitamente que lo conozcas');
    lines.push('mejor o dice algo como "inicia el protocolo de conocimiento", entonces sí entrevístalo:');
    lines.push('preguntas pertinentes de a una o dos, conversacional (nunca en lista), sobre quién es, a qué');
    lines.push('se dedica, qué herramientas usa y cómo prefiere trabajar. Registra todo con "recordar" y al');
    lines.push('terminar guarda {"categoria":"meta","clave":"protocolo_conocimiento","valor":"completado"}.');
  }
  return lines.join('\n');
}
