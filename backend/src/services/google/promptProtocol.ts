/**
 * Protocolo de tools por prompt para el asistente (Gmail/Calendar/Drive).
 * - googleSystemBlock(connected): instrucciones que se añaden al system prompt.
 * - parseAction(text): detecta si el modelo emitió {"tool","args"} y lo extrae.
 */
import { isGoogleTool } from './tools.js';

export interface ToolAction {
  tool: string;
  args: Record<string, unknown>;
}

/** Bloque de system prompt según si el usuario tiene Google conectado. */
export function googleSystemBlock(connected: boolean): string {
  const today = new Date().toISOString().slice(0, 10);
  if (!connected) {
    return [
      '',
      'CONEXIONES: El usuario NO tiene sus cuentas de Google conectadas todavía.',
      'SÍ tienes la capacidad de integrarte con Gmail, Google Calendar y Google Drive; solo falta',
      'que el usuario las conecte. Si te pide algo de correo, agenda o archivos, dile de forma',
      'amable y concreta que primero debe conectarlas en "Cuenta → Conexiones → Google", y que en',
      'cuanto lo haga podrás leer/gestionar todo eso por él. NUNCA digas que no tienes esa función.',
    ].join('\n');
  }
  return [
    '',
    `Hoy es ${today}. El usuario CONECTÓ sus cuentas de Google: tienes acceso a su Gmail, Google`,
    'Calendar y Google Drive. Cuando necesites consultar o actuar sobre ellos, responde ÚNICAMENTE',
    'con un objeto JSON en una sola línea, SIN texto adicional ni markdown:',
    '{"tool":"<nombre>","args":{...}}',
    'El sistema ejecutará la herramienta y te devolverá una OBSERVACIÓN; entonces continúa. Cuando',
    'ya tengas lo necesario, responde al usuario en lenguaje natural (sin JSON, apto para voz).',
    '',
    'Herramientas:',
    '- gmail_search {query, max?}  busca correos (sintaxis Gmail, ej. "from:banco newer_than:7d")',
    '- gmail_read {id}             lee un correo completo',
    '- gmail_create_draft {to, subject, body}   crea un borrador (no envía)',
    '- gmail_send {to, subject, body, confirmed}   ENVÍA. Destructivo: pide confirmación primero',
    '- calendar_list_events {date?, max?}   lista eventos (date YYYY-MM-DD; sin date = próximos 7 días)',
    '- calendar_create_event {summary, start, end, description?}   crea evento (start/end ISO 8601)',
    '- calendar_delete_event {eventId, confirmed}   borra. Destructivo: pide confirmación',
    '- drive_search {query, max?}  busca archivos por nombre',
    '- drive_read_file {fileId}    lee el contenido de un archivo',
    '- drive_create_file {name, content, mimeType?}   crea un archivo',
    '- drive_delete_file {fileId, confirmed}   borra. Destructivo: pide confirmación',
    '',
    'Reglas: no inventes datos (usa las herramientas). Para ENVIAR o BORRAR, primero explica al',
    'usuario qué harás y espera su "sí"; sólo entonces vuelve a llamar la herramienta con',
    '"confirmed": true. Si una observación trae requires_confirmation, pregunta y NO reintentes solo.',
  ].join('\n');
}

/**
 * Detecta una acción de herramienta en la salida del modelo. Tolera fences
 * ```json, prosa alrededor y comillas. Devuelve null si no es una acción válida
 * (entonces el texto es la respuesta final al usuario).
 */
export function parseAction(text: string): ToolAction | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();

  // Candidatos: el texto completo, o el primer bloque {...} balanceado.
  const candidates: string[] = [];
  if (cleaned.startsWith('{')) candidates.push(cleaned);
  const start = cleaned.indexOf('{');
  if (start >= 0) {
    let depth = 0;
    for (let i = start; i < cleaned.length; i++) {
      if (cleaned[i] === '{') depth++;
      else if (cleaned[i] === '}') {
        depth--;
        if (depth === 0) {
          candidates.push(cleaned.slice(start, i + 1));
          break;
        }
      }
    }
  }

  for (const c of candidates) {
    try {
      const obj = JSON.parse(c) as { tool?: unknown; action?: unknown; args?: unknown; arguments?: unknown };
      const tool = typeof obj.tool === 'string' ? obj.tool : typeof obj.action === 'string' ? obj.action : '';
      if (tool && isGoogleTool(tool)) {
        const args = (obj.args ?? obj.arguments ?? {}) as Record<string, unknown>;
        return { tool, args: args && typeof args === 'object' ? args : {} };
      }
    } catch {
      /* no es JSON válido → siguiente candidato */
    }
  }
  return null;
}
