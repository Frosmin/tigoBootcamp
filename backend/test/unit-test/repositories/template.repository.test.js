import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/infrastructure/postgres.client.js', () => ({
  executeQuery: vi.fn()
}));

import { executeQuery } from '../../../src/infrastructure/postgres.client.js';
import {
  findTemplateById, insertTemplate, softDeleteTemplate, updateTemplate
} from '../../../src/repositories/template.repository.js';

describe('template.repository.js', () => {
  const template = {
    nombre: 'confirmacion-pedido',
    canal: 'EMAIL',
    contenido: 'Hola {{nombre}}',
    variables: ['nombre']
  };

  it('uses a parameterized atomic insert and returns the created row', async () => {
    const row = { id: 1, ...template };
    executeQuery.mockResolvedValue([row]);

    const result = await insertTemplate(template);

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toMatch(/INSERT INTO plantilla/);
    expect(query).toMatch(/ON CONFLICT \(nombre, canal\) WHERE deleted_at IS NULL DO NOTHING/);
    expect(query).toMatch(/RETURNING id, nombre, canal, contenido, variables/);
    expect(params).toEqual([
      template.nombre,
      template.canal,
      template.contenido,
      template.variables
    ]);
    expect(result).toEqual(row);
  });

  it('returns undefined when PostgreSQL ignores a duplicate', async () => {
    executeQuery.mockResolvedValue([]);

    await expect(insertTemplate(template)).resolves.toBeUndefined();
  });

  it('finds a template by its identifier', async () => {
    executeQuery.mockResolvedValue([{ id: 8, ...template }]);

    await expect(findTemplateById(8)).resolves.toEqual({ id: 8, ...template });
    expect(executeQuery.mock.calls.at(-1)[0]).toMatch(/WHERE id = \$1::bigint AND deleted_at IS NULL/);
    expect(executeQuery.mock.calls.at(-1)[1]).toEqual([8]);
  });

  it('updates without colliding with another active name/channel', async () => {
    executeQuery.mockResolvedValue([{ id: 8, ...template }]);
    await expect(updateTemplate(8, template)).resolves.toEqual({ id: 8, ...template });
    expect(executeQuery.mock.calls.at(-1)[0]).toMatch(/NOT EXISTS/);
    expect(executeQuery.mock.calls.at(-1)[1]).toEqual([
      8, template.nombre, template.canal, template.contenido, template.variables
    ]);
  });

  it('soft-deletes and returns the affected identifier', async () => {
    executeQuery.mockResolvedValue([{ id: 8 }]);
    await expect(softDeleteTemplate(8)).resolves.toEqual({ id: 8 });
    expect(executeQuery.mock.calls.at(-1)[0]).toMatch(/SET deleted_at=CURRENT_TIMESTAMP/);
  });
});
