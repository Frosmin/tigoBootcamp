import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/template.service.js', () => ({
  createTemplateService: vi.fn(), deleteTemplateService: vi.fn(), updateTemplateService: vi.fn()
}));

import {
  createTemplateService, deleteTemplateService, updateTemplateService
} from '../../../src/services/template.service.js';
import {
  createTemplateController, deleteTemplateController, updateTemplateController
} from '../../../src/controllers/template.controller.js';
import { errorCodes, setError } from '../../../src/utils/errorCodes.js';

describe('template.controller.js', () => {
  const req = {
    body: {
      nombre: 'confirmacion-pedido',
      canal: 'EMAIL',
      contenido: 'Hola {{nombre}}',
      variables: ['nombre']
    }
  };
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn(), send: vi.fn() };
  });

  it('returns 201 with the created template', async () => {
    const created = { id: 1, ...req.body };
    createTemplateService.mockResolvedValue(created);

    await createTemplateController(req, res);

    expect(createTemplateService).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });

  it('returns 409 when the template name and channel already exist', async () => {
    createTemplateService.mockRejectedValue(
      setError('Template already exists', errorCodes.RESOURCE_CONFLICT)
    );

    await createTemplateController(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: errorCodes.RESOURCE_CONFLICT, message: 'Resource conflict' }
    });
  });

  it('returns 500 for an unexpected error', async () => {
    createTemplateService.mockRejectedValue(new Error('database unavailable'));

    await createTemplateController(req, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: errorCodes.GENERIC_INTERNAL_SERVER_ERROR,
        message: 'Generic internal server error'
      }
    });
  });

  it('returns the updated template', async () => {
    const updated = { id: '1', ...req.body };
    updateTemplateService.mockResolvedValue(updated);
    await updateTemplateController({ params: { id: '1' }, body: req.body }, res);
    expect(updateTemplateService).toHaveBeenCalledWith('1', req.body);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(updated);
  });

  it('returns 204 after soft deletion', async () => {
    deleteTemplateService.mockResolvedValue();
    await deleteTemplateController({ params: { id: '1' } }, res);
    expect(deleteTemplateService).toHaveBeenCalledWith('1');
    expect(res.status).toHaveBeenCalledWith(204);
    expect(res.send).toHaveBeenCalledOnce();
  });

  it('maps an absent delete to 404', async () => {
    deleteTemplateService.mockRejectedValue(setError('missing', errorCodes.NOT_FOUND));
    await deleteTemplateController({ params: { id: '99' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });
});
