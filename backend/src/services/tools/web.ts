/**
 * Búsqueda web REAL para el asistente — tool `buscar_web` vía Exa (api.exa.ai),
 * el mismo proveedor que usa OpenCode. Gateada por la skill `buscador-web`:
 * si el usuario la instaló, el asistente recibe esta tool y puede buscar de
 * verdad; si no, no aparece. Así el sistema de skills deja de ser cosmético.
 */
export const WEB_TOOL = 'buscar_web';

const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : v == null ? '' : String(v));

export interface ToolResult {
  ok: boolean;
  [k: string]: unknown;
}

/** Bloque de catálogo para el system prompt (solo si la skill está activa). */
export function webToolsBlock(): string {
  return [
    '',
    'BÚSQUEDA WEB (skill activa): puedes consultar información ACTUALIZADA de internet.',
    `- ${WEB_TOOL}: args {consulta, n?}. Devuelve resultados con título, url y extracto.`,
    'Úsala cuando el usuario pida datos actuales/recientes, noticias, precios, o algo que no sabes con',
    'certeza. Tras buscar, responde con la info y CITA las fuentes (url). No inventes resultados.',
  ].join('\n');
}

/** Ejecuta una búsqueda en Exa y devuelve los resultados con extracto. */
export async function runWebSearch(rawArgs: unknown): Promise<ToolResult> {
  const key = process.env.EXA_API_KEY?.trim();
  if (!key) return { ok: false, error: 'Búsqueda web no configurada en el servidor (falta EXA_API_KEY).' };
  const args = (rawArgs && typeof rawArgs === 'object' ? rawArgs : {}) as Record<string, unknown>;
  const query = str(args.consulta) || str(args.query) || str(args.q);
  if (!query) return { ok: false, error: 'Falta la consulta de búsqueda.' };
  const n = Math.min(Math.max(Number(args.n) || 5, 1), 8);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch('https://api.exa.ai/search', {
      method: 'POST',
      headers: { 'x-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        numResults: n,
        type: 'auto',
        contents: { text: { maxCharacters: 800 } },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Exa respondió HTTP ${res.status}.`, detail: detail.slice(0, 200) };
    }
    const data = (await res.json()) as { results?: Array<{ title?: string; url?: string; text?: string; publishedDate?: string }> };
    const resultados = (data.results ?? []).map((r) => ({
      titulo: r.title ?? '(sin título)',
      url: r.url ?? '',
      extracto: (r.text ?? '').replace(/\s+/g, ' ').slice(0, 600),
      publicado: r.publishedDate ?? null,
    }));
    return { ok: true, count: resultados.length, resultados };
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') return { ok: false, error: 'La búsqueda web excedió el tiempo de espera.' };
    return { ok: false, error: `Fallo en búsqueda web: ${(e as Error).message}` };
  } finally {
    clearTimeout(timeout);
  }
}
