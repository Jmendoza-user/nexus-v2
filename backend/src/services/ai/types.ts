/**
 * Contratos comunes de la capa de adapters IA.
 *
 * Un adapter recibe una conversación (mensajes con rol) y devuelve la respuesta
 * del modelo más, si el backend los reporta, los tokens consumidos. La selección
 * de adapter/modelo según tier la decide AgentRunner.pickAdapter().
 */
export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface ChatUsage {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
}

export interface ChatOptions {
  /** Modelo a usar (lo resuelve pickAdapter según tier; el adapter no decide). */
  model: string;
  /** Temperatura opcional (default razonable por adapter). */
  temperature?: number;
  /** Tope de tokens de salida opcional. */
  maxTokens?: number;
  /** Señal de abort opcional para cancelar la request. */
  signal?: AbortSignal;
}

export interface ChatResult {
  text: string;
  usage: ChatUsage;
  /** Adapter que produjo la respuesta (para telemetría/logs). */
  adapter: string;
  model: string;
}

export interface AIAdapter {
  /** Identificador estable del adapter ('opencode' | 'claude_cli'). */
  readonly name: string;
  chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult>;
}

/** Error de adapter con causa legible (no expone secretos). */
export class AdapterError extends Error {
  constructor(
    public adapter: string,
    public status: number | null,
    message: string,
    public detail?: string
  ) {
    super(message);
    this.name = 'AdapterError';
  }
}
