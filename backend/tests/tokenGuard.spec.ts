/**
 * TokenGuard etapa 1 — redact/restore round-trip y placeholders estables.
 */
import { describe, it, expect } from 'vitest';
import { redact, restore } from '../src/services/tokenGuard.js';

describe('tokenGuard.redact', () => {
  it('redacta email, teléfono +57, cédula CC y tarjeta', () => {
    const input =
      'Mi correo es jerson@eyesa.com.co, mi celular +57 311 222 3344, ' +
      'mi cédula CC 1.012.345.678 y mi tarjeta 4111 1111 1111 1111.';
    const { redacted, map } = redact(input);

    expect(redacted).not.toContain('jerson@eyesa.com.co');
    expect(redacted).not.toContain('1111 1111 1111');
    expect(redacted).toContain('<EMAIL_1>');
    expect(redacted).toContain('<PHONE_1>');
    expect(redacted).toContain('<CARD_1>');
    expect(redacted).toContain('<ID_1>');

    // El mapa revierte exactamente al valor original.
    expect(map['<EMAIL_1>']).toBe('jerson@eyesa.com.co');
  });

  it('round-trip: restore(redact(x)) == x', () => {
    const input = 'Escríbeme a ana@dominio.com o llama al +58 412 555 6677.';
    const { redacted, map } = redact(input);
    expect(restore(redacted, map)).toBe(input);
  });

  it('deduplica: el mismo valor reusa el mismo placeholder', () => {
    const input = 'a@b.com y otra vez a@b.com';
    const { redacted, map } = redact(input);
    expect(redacted).toBe('<EMAIL_1> y otra vez <EMAIL_1>');
    expect(Object.keys(map)).toHaveLength(1);
  });

  it('restore reemplaza todas las ocurrencias del placeholder', () => {
    const map = { '<EMAIL_1>': 'x@y.com' };
    expect(restore('manda a <EMAIL_1> y a <EMAIL_1>', map)).toBe('manda a x@y.com y a x@y.com');
  });

  it('texto sin PII queda intacto y mapa vacío', () => {
    const input = 'Hola, ¿qué puedes hacer por mí hoy?';
    const { redacted, map } = redact(input);
    expect(redacted).toBe(input);
    expect(Object.keys(map)).toHaveLength(0);
  });
});
