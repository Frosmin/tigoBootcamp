import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/repositories/template.repository.js', () => ({
  insertTemplate: vi.fn()
}));

import { insertTemplate } from '../../../src/repositories/template.repository.js';
import { createTemplateService } from '../../../src/services/template.service.js';

describe('template.service.js', () => {
  const template = {
    nombre: 'confirmacion-pedido',
    canal: 'EMAIL',
    contenido: 'Hola {{nombre}}',
    variables: ['nombre']
  };

  it('returns the template created by the repository', async () => {
    const created = { id: 1, ...template };
    insertTemplate.mockResolvedValue(created);

    await expect(createTemplateService(template)).resolves.toEqual(created);
    expect(insertTemplate).toHaveBeenCalledWith(template);
  });

  it('throws CF001 when the name and channel already exist', async () => {
    insertTemplate.mockResolvedValue(undefined);

    await expect(createTemplateService(template)).rejects.toMatchObject({
      errorCode: 'CF001'
    });
  });
});
