import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/services/template.service.js', () => ({
  createTemplateService: vi.fn()
}));

import { createTemplateService } from '../../../src/services/template.service.js';
import { createTemplateController } from '../../../src/controllers/template.controller.js';
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
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
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
});
