import { describe, expect, it } from 'vitest';
import { renderTemplate } from '../../../src/domain/template.renderer.js';

describe('template.renderer.js', () => {
  it('replaces every occurrence and stringifies primitive values', () => {
    expect(renderTemplate(
      'Hola {{nombre}}, total {{total}}, activo {{activo}}. {{nombre}}',
      { nombre: 'Ana', total: 10.5, activo: true }
    )).toBe('Hola Ana, total 10.5, activo true. Ana');
  });

  it('fails terminally when the template has unresolved variables', () => {
    expect(() => renderTemplate('Hola {{nombre}} {{faltante}}', { nombre: 'Ana' }))
      .toThrow(expect.objectContaining({
        code: 'TEMPLATE_RENDER_ERROR',
        retryable: false
      }));
  });
});
