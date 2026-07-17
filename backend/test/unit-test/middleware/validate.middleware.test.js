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

  it.each([
    ['EMAIL', 'user@example.com'],
    ['SMS', '+59170000000']
  ])('accepts a valid %s notification and normalizes the header', (canal, destinatario) => {
    const req = {
      body: { canal, destinatario, plantillaId: 1, variables: { nombre: 'Ana', activo: true, total: 10 } },
      get: vi.fn(() => ' request-1 '),
      params: {}
    };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.createNotification()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.idempotencyKey).toBe('request-1');
  });

  it.each([
    [{ canal: 'EMAIL', destinatario: 'invalid', plantillaId: 1, variables: {} }, 'key'],
    [{ canal: 'SMS', destinatario: '70000000', plantillaId: 1, variables: {} }, 'key'],
    [{ canal: 'EMAIL', destinatario: 'a@b.com', plantillaId: 1, variables: { nested: {} } }, 'key'],
    [{ canal: 'EMAIL', destinatario: 'a@b.com', plantillaId: 1, variables: { nil: null } }, 'key'],
    [{ canal: 'EMAIL', destinatario: 'a@b.com', plantillaId: 1, variables: {}, extra: true }, 'key'],
    [{ canal: 'EMAIL', destinatario: 'a@b.com', plantillaId: 1, variables: {} }, undefined]
  ])('rejects an invalid notification contract', (body, header) => {
    const req = { body, get: vi.fn(() => header), params: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.createNotification()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it.each(['1', '9223372036854775807'])('accepts PostgreSQL bigint id %s', (id) => {
    const req = { params: { id }, body: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.getNotification()(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(req.params).toEqual({ id });
  });

  it.each(['0', '-1', '1.5', 'abc', '9223372036854775808'])('rejects invalid id %s', (id) => {
    const req = { params: { id }, body: {} };
    const res = createResponse();
    const next = vi.fn();

    validateRequestMiddleware.getNotification()(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
