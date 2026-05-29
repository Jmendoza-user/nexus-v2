/**
 * TokenGuard — redacción de PII antes de enviar texto a la IA.
 *
 * Etapa 1 (este archivo): regex local determinista, SIEMPRE activa. Reemplaza
 * datos sensibles por placeholders estables (`<EMAIL_1>`, `<PHONE_1>`, ...) y
 * devuelve un mapa para revertir (restore) la respuesta del modelo.
 *
 * Patrones cubiertos (Colombia/Venezuela primero):
 *  - Emails.
 *  - Teléfonos +57 / +58 (con o sin espacios, guiones, paréntesis).
 *  - Cédulas con prefijo CC/V/E (ej. "CC 1.012.345.678", "V-12345678").
 *  - Tarjetas (13-16 dígitos, con o sin separadores).
 *
 * Diseño:
 *  - Orden de aplicación importa: tarjetas y teléfonos antes que cédulas para no
 *    "morder" dígitos de los otros. Emails primero (contienen @, no chocan).
 *  - Placeholders numerados por tipo y deduplicados: el mismo valor → mismo
 *    placeholder (coherencia para el modelo y reversibilidad 1:1).
 *  - restore() reemplaza placeholders por el valor original (global, todas las
 *    ocurrencias) — útil porque el modelo puede repetir el placeholder.
 *
 * TODO-DEUDA(tokenguard-ner): Etapa 2 = NER (spaCy via workers-py) para nombres
 *  propios, direcciones y entidades no regex-ables (Pro+, textos >500 chars).
 * TODO-DEUDA(tokenguard-cache): Etapa 3 = caché semántico (coseno ≥0.95) para
 *  no re-redactar/re-llamar IA en prompts casi idénticos.
 */

export interface RedactionMap {
  /** placeholder → valor original. */
  [placeholder: string]: string;
}

export interface RedactResult {
  redacted: string;
  map: RedactionMap;
}

interface PatternSpec {
  label: string; // EMAIL, PHONE, CARD, ID
  regex: RegExp;
  /** Validación adicional opcional (ej. longitud de dígitos en tarjeta). */
  accept?: (match: string) => boolean;
}

// El orden define prioridad de captura (primero = gana).
const PATTERNS: PatternSpec[] = [
  {
    label: 'EMAIL',
    regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    label: 'CARD',
    // 13-16 dígitos con separadores opcionales (espacio/guion) entre grupos.
    regex: /\b(?:\d[ -]?){13,16}\b/g,
    accept: (m) => {
      const digits = m.replace(/\D/g, '');
      return digits.length >= 13 && digits.length <= 16;
    },
  },
  {
    label: 'PHONE',
    // +57 / +58 seguido de 7-12 dígitos con separadores opcionales.
    regex: /\+5[78][\s().-]?(?:\d[\s().-]?){7,12}\d/g,
  },
  {
    label: 'ID',
    // Cédula con prefijo CC / V / E (Colombia/Venezuela), dígitos con puntos.
    regex: /\b(?:CC|C\.C\.|V|E)[\s.-]?\d{1,3}(?:[.\s]?\d{3}){1,3}\b/gi,
  },
];

export function redact(text: string): RedactResult {
  if (!text) return { redacted: text, map: {} };

  const map: RedactionMap = {};
  // valor original → placeholder (dedup por tipo).
  const seen = new Map<string, string>();
  const counters: Record<string, number> = {};
  // Marca rangos ya redactados para que patrones posteriores no los toquen.
  let result = '';
  let cursor = 0;

  // Recolecta todos los matches con su posición, respetando prioridad.
  type Hit = { start: number; end: number; value: string; label: string };
  const hits: Hit[] = [];
  const claimed: Array<[number, number]> = [];

  const overlaps = (s: number, e: number) =>
    claimed.some(([cs, ce]) => s < ce && e > cs);

  for (const spec of PATTERNS) {
    spec.regex.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = spec.regex.exec(text)) !== null) {
      const value = m[0];
      const start = m.index;
      const end = start + value.length;
      if (overlaps(start, end)) continue;
      if (spec.accept && !spec.accept(value)) continue;
      hits.push({ start, end, value, label: spec.label });
      claimed.push([start, end]);
    }
  }

  hits.sort((a, b) => a.start - b.start);

  for (const hit of hits) {
    result += text.slice(cursor, hit.start);
    let placeholder = seen.get(`${hit.label}:${hit.value}`);
    if (!placeholder) {
      counters[hit.label] = (counters[hit.label] ?? 0) + 1;
      placeholder = `<${hit.label}_${counters[hit.label]}>`;
      seen.set(`${hit.label}:${hit.value}`, placeholder);
      map[placeholder] = hit.value;
    }
    result += placeholder;
    cursor = hit.end;
  }
  result += text.slice(cursor);

  return { redacted: result, map };
}

export function restore(text: string, map: RedactionMap): string {
  if (!text || !map) return text;
  let out = text;
  for (const [placeholder, original] of Object.entries(map)) {
    // Reemplazo global literal del placeholder.
    out = out.split(placeholder).join(original);
  }
  return out;
}

/**
 * nerRedact — Etapa 2 (NER): redacción de entidades NO regex-ables (nombres
 * propios, direcciones, organizaciones) vía spaCy a través de workers-py.
 *
 * ⚠️ NO OPERATIVA. spaCy NO está instalado en este VPS todavía. Esta función
 * es la INTERFAZ lista para cuando se instale el modelo; por ahora es un PASO-A-
 * TRAVÉS (devuelve el texto y el map sin cambios) para no romper el pipeline.
 * La Etapa 1 (regex, redact()) sigue 100% activa y cubre PII estructurada.
 *
 * TODO-DEUDA(tokenguard-ner): para activar NER:
 *   1. En workers-py:  pip install spacy && python -m spacy download es_core_news_md
 *   2. Exponer un endpoint /ner que reciba texto y devuelva entidades [{label,text,start,end}].
 *   3. Aquí: llamar al worker, redactar PER/LOC/ORG con placeholders <PER_n>, etc.,
 *      fusionando con el map de la etapa 1 (regex). Aplicar solo en Pro+ y textos
 *      largos (>500 chars) para no añadir latencia en chats cortos.
 *
 * @param text  texto YA pasado por redact() (etapa 1 regex).
 * @param prev  map acumulado de la etapa 1 (se fusiona).
 */
export async function nerRedact(text: string, prev: RedactionMap = {}): Promise<RedactResult> {
  // spaCy no instalado → passthrough determinista. Documentado arriba.
  return { redacted: text, map: prev };
}
