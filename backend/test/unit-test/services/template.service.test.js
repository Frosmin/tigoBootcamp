import { describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/repositories/template.repository.js', () => ({
  findTemplateById: vi.fn(), insertTemplate: vi.fn(),
  softDeleteTemplate: vi.fn(), updateTemplate: vi.fn()
}));

import {
  findTemplateById, insertTemplate, softDeleteTemplate, updateTemplate
} from '../../../src/repositories/template.repository.js';
import {
  createTemplateService, deleteTemplateService, updateTemplateService
} from '../../../src/services/template.service.js';

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

  it('updates an existing template after placeholder validation', async () => {
    findTemplateById.mockResolvedValue({ id: 1 });
    updateTemplate.mockResolvedValue({ id: 1, ...template });
    await expect(updateTemplateService('1', template)).resolves.toEqual({ id: 1, ...template });
    expect(updateTemplate).toHaveBeenCalledWith('1', template);
  });

  it('returns NF001 when updating an absent template', async () => {
    findTemplateById.mockResolvedValue(undefined);
    await expect(updateTemplateService('99', template)).rejects.toMatchObject({ errorCode: 'NF001' });
  });

  it('returns CF001 when an update collides with another active template', async () => {
    findTemplateById.mockResolvedValue({ id: 1 });
    updateTemplate.mockResolvedValue(undefined);
    await expect(updateTemplateService('1', template)).rejects.toMatchObject({ errorCode: 'CF001' });
  });

  it('soft-deletes an active template', async () => {
    softDeleteTemplate.mockResolvedValue({ id: '1' });
    await expect(deleteTemplateService('1')).resolves.toBeUndefined();
  });

  it('returns NF001 when deleting an absent template', async () => {
    softDeleteTemplate.mockResolvedValue(undefined);
    await expect(deleteTemplateService('99')).rejects.toMatchObject({ errorCode: 'NF001' });
  });
});
