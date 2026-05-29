/**
 * ClaudeCliAdapter — stub funcional que invoca el binario `claude` como
 * subproceso dentro del entorno aislado del usuario.
 *
 * IMPORTANTE (Hito 1): este adapter NO es el default del chat. El chat de Hito 1
 * usa OpenCode-go. Este adapter queda listo pero su uso pesado (tareas de
 * agentes con herramientas, ejecución en workdir, MCP) es de hitos siguientes.
 *
 * Detalles de robustez (heredados de Amparo/NEXUS V1, learning 2026-05-08):
 *  - Whitelist agresiva de env: sin ella el child hereda CLAUDE_CODE_* de la
 *    sesión padre y se confunde / aborta. Aquí además fijamos HOME=userPaths.root
 *    y cwd=userPaths.workdir para aislamiento por usuario.
 *  - El prompt se concatena del array de mensajes a un único prompt textual
 *    (system → --append-system-prompt, resto → cuerpo). El CLI no expone API de
 *    mensajes con roles, así que serializamos.
 *  - Timeout con SIGKILL; stdin se cierra para evitar bloqueos.
 *
 * TODO-DEUDA(claudecli-uso-real): integrar streaming, herramientas MCP del
 *  usuario (userPaths.mcp), y parseo de salida estructurada (--output-format json)
 *  cuando los agentes de Hito 2+ usen CLI de verdad.
 */
import { spawn } from 'node:child_process';
import { env } from '../../lib/env.js';
import { AdapterError, type AIAdapter, type ChatMessage, type ChatOptions, type ChatResult } from './types.js';

export interface ClaudeCliContext {
  /** HOME del subproceso (raíz del env del usuario). */
  home: string;
  /** cwd del subproceso (workdir del usuario). */
  workdir: string;
}

const ENV_ALLOW = new Set([
  'HOME', 'PATH', 'USER', 'LANG', 'TERM', 'TZ',
  'CLAUDE_CLI_BINARY', 'CLAUDE_CLI_TIMEOUT_MS',
]);

export class ClaudeCliAdapter implements AIAdapter {
  readonly name = 'claude_cli';

  constructor(private ctx: ClaudeCliContext) {}

  async chat(messages: ChatMessage[], opts: ChatOptions): Promise<ChatResult> {
    const system = messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');
    // Serializa el historial no-system a un prompt textual con prefijos de rol.
    const body = messages
      .filter((m) => m.role !== 'system')
      .map((m) => (m.role === 'assistant' ? `Asistente: ${m.content}` : `Usuario: ${m.content}`))
      .join('\n\n');

    const text = await this.invoke(body, system, opts);
    return { text, usage: {}, adapter: this.name, model: opts.model };
  }

  private invoke(prompt: string, system: string, opts: ChatOptions): Promise<string> {
    return new Promise((resolve, reject) => {
      const binary = env.CLAUDE_CLI_BINARY;
      const args = ['--print', '--model', opts.model];
      if (system.trim()) args.push('--append-system-prompt', system);
      args.push(prompt);

      const cleanEnv: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) {
        if (typeof v !== 'string') continue;
        if (ENV_ALLOW.has(k) || k.startsWith('LC_')) cleanEnv[k] = v;
      }
      cleanEnv.HOME = this.ctx.home;

      const timeoutMs = env.OPENCODE_GO_TIMEOUT_MS;
      let child;
      try {
        child = spawn(binary, args, { shell: false, env: cleanEnv, cwd: this.ctx.workdir });
      } catch (err) {
        reject(new AdapterError('claude_cli', null, `No se pudo lanzar claude CLI: ${(err as Error).message}`));
        return;
      }

      let stdout = '';
      let stderr = '';
      let done = false;
      const finish = (fn: () => void) => { if (!done) { done = true; fn(); } };

      const timer = setTimeout(() => {
        try { child.kill('SIGKILL'); } catch { /* noop */ }
        finish(() => reject(new AdapterError('claude_cli', null, `claude CLI timeout (${timeoutMs} ms).`, stderr.slice(-300))));
      }, timeoutMs);

      if (opts.signal) {
        opts.signal.addEventListener('abort', () => {
          try { child.kill('SIGKILL'); } catch { /* noop */ }
          finish(() => reject(new AdapterError('claude_cli', null, 'claude CLI abortado.')));
        }, { once: true });
      }

      child.stdout.on('data', (c: Buffer) => { stdout += c.toString('utf8'); });
      child.stderr.on('data', (c: Buffer) => { stderr += c.toString('utf8'); });
      child.stdin?.on('error', () => { /* swallow EPIPE */ });
      child.on('error', (err) => {
        clearTimeout(timer);
        finish(() => reject(new AdapterError('claude_cli', null, `claude CLI error: ${err.message}`)));
      });
      child.on('close', (code) => {
        clearTimeout(timer);
        if ((code ?? 0) !== 0) {
          finish(() => reject(new AdapterError('claude_cli', code, `claude CLI exit ${code}.`, stderr.slice(-300))));
          return;
        }
        const out = stdout.trim();
        if (!out) {
          finish(() => reject(new AdapterError('claude_cli', 0, 'claude CLI devolvió salida vacía.')));
          return;
        }
        finish(() => resolve(out));
      });
      try { child.stdin?.end(); } catch { /* noop */ }
    });
  }
}
