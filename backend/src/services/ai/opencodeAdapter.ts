/**
 * OpencodeAdapter — cliente OpenAI-compatible contra el gateway OpenCode-go.
 *
 * POST {OPENCODE_GO_BASE_URL}/chat/completions
 *   Authorization: Bearer {OPENCODE_GO_API_KEY}
 *   body: { model, messages, temperature?, max_tokens? }
 *
 * Maneja timeout (OPENCODE_GO_TIMEOUT_MS) vía AbortController y normaliza
 * errores en AdapterError (sin filtrar la API key). Devuelve texto + usage si
 * el gateway los reporta.
 */
import { env } from '../../lib/env.js';
import { AdapterError, type AIAdapter, type ChatMessage, type ChatOptions, type ChatResult } from './types.js';

interface OpenAIChatResponse {
  choices?: Array<{
    message?: { content?: string | null };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class OpencodeAdapter implements AIAdapter {
  readonly name = 'opencode';

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    if (!env.OPENCODE_GO_API_KEY) {
      throw new AdapterError('opencode', null, 'OPENCODE_GO_API_KEY no configurada.');
    }

    const url = `${env.OPENCODE_GO_BASE_URL.replace(/\/+$/, '')}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), env.OPENCODE_GO_TIMEOUT_MS);

    // Encadena la señal externa (si la hay) con el timeout interno.
    if (opts.signal) {
      if (opts.signal.aborted) controller.abort();
      else opts.signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.OPENCODE_GO_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: opts.model,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          temperature: opts.temperature ?? 0.6,
          ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new AdapterError(
          'opencode',
          res.status,
          `OpenCode-go respondió HTTP ${res.status}.`,
          detail.slice(0, 800)
        );
      }

      const data = (await res.json()) as OpenAIChatResponse;
      const text = (data.choices?.[0]?.message?.content ?? '').trim();
      if (!text) {
        const finish = data.choices?.[0]?.finish_reason ?? 'desconocido';
        throw new AdapterError(
          'opencode',
          res.status,
          `OpenCode-go devolvió respuesta vacía (finish_reason=${finish}).`,
          JSON.stringify(data).slice(0, 800)
        );
      }

      return {
        text,
        usage: {
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
        },
        adapter: this.name,
        model: opts.model,
      };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      if ((err as Error)?.name === 'AbortError') {
        throw new AdapterError(
          'opencode',
          null,
          `OpenCode-go excedió el timeout (${env.OPENCODE_GO_TIMEOUT_MS} ms).`
        );
      }
      throw new AdapterError('opencode', null, `Fallo de red contra OpenCode-go: ${(err as Error).message}`);
    } finally {
      clearTimeout(timeout);
    }
  }
}
