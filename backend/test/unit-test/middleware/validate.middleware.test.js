import { describe, expect, it, vi } from 'vitest';
import { validateRequestMiddleware } from '../../../src/middleware/validate.middleware.js';

const validBody = {
  nombre: ' confirmacion-pedido ',
  canal: 'EMAIL',
  contenido: 'Hola {{nombre}}',
  variables: [' nombre ', 'pedidoId']
};

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn()
});

describe('validate.middleware.js', () => {
  it('calls next and stores normalized data for a valid template', () => {
    const req = { body: { ...validBody }, params: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.createTemplate()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.body.nombre).toBe('confirmacion-pedido');
    expect(req.body.variables).toEqual(['nombre', 'pedidoId']);
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...validBody, canal: 'WHATSAPP' }],
    [{ ...validBody, nombre: '   ' }],
    [{ ...validBody, contenido: '   ' }],
    [{ ...validBody, variables: ['nombre', ' nombre '] }],
    [{ ...validBody, extra: true }]
  ])('returns 400 for an invalid body', (body) => {
    const req = { body, params: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.createTemplate()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'BR001', message: 'Missing required parameter' }
    });
  });

  it('accepts a template without variables', () => {
    const req = { body: { ...validBody, variables: [] }, params: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.createTemplate()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
  });
});
