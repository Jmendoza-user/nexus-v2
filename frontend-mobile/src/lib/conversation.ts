// ============================================================
// NEXUS — Store de conversación (voz/chat) compartido entre pantallas.
// El Home NO muestra texto (experiencia tipo Alexa: la voz es la salida);
// el historial de entrada/salida vive aquí y se lee en la pantalla Chat.
// Singleton minimalista con suscripción (sin dependencias).
// ============================================================
import { useSyncExternalStore } from 'react';

export type Turn = { role: 'user' | 'assistant'; content: string; ts: number };

let turns: Turn[] = [];
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function getTurns(): Turn[] {
  return turns;
}

/** Historial para el API del asistente (ChatTurn[]), excluyendo metadata. */
export function apiHistory(limit = 12): { role: 'user' | 'assistant'; content: string }[] {
  return turns.slice(-limit).map((t) => ({ role: t.role, content: t.content }));
}

export function addTurn(role: Turn['role'], content: string) {
  const text = content.trim();
  if (!text) return;
  turns = [...turns, { role, content: text, ts: Date.now() }];
  emit();
}

export function clearTurns() {
  turns = [];
  emit();
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Hook para componentes que renderizan el historial (pantalla Chat). */
export function useConversation(): Turn[] {
  return useSyncExternalStore(subscribe, getTurns, getTurns);
}
