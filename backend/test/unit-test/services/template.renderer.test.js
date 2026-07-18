import { describe, expect, it } from 'vitest';

import {
  extractPlaceholders, renderTemplate, validateTemplatePlaceholders
} from '../../../src/services/template.renderer.js';

describe('template.renderer.js', () => {
  it('extracts unique placeholders and renders primitive values', () => {
    expect(extractPlaceholders('Hola {{ nombre }} {{nombre}} #{{id}}'))
      .toEqual(['id', 'nombre']);
    expect(renderTemplate('Hola {{nombre}}, activo={{activo}}, total={{total}}', {
      nombre: 'Ana', activo: false, total: 0
    })).toBe('Hola Ana, activo=false, total=0');
  });

  it('requires declared variables to exactly match placeholders', () => {
    expect(() => validateTemplatePlaceholders({
      contenido: 'Hola {{nombre}}', variables: ['nombre']
    })).not.toThrow();
    expect(() => validateTemplatePlaceholders({
      contenido: 'Hola {{nombre}}', variables: ['otro']
    })).toThrow(/must match/i);
  });

  it('renders missing values deterministically after service-level validation', () => {
    expect(renderTemplate('{{nombre}}', {})).toBe('undefined');
    expect(renderTemplate('{{nombre}}', { nombre: 'Ana', extra: 1 })).toBe('Ana');
  });
});
