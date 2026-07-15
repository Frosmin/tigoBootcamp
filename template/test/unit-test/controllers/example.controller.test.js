import { describe, it, expect, vi } from 'vitest';

// Mock de los services
vi.mock('../../../src/services/example.services.js', () => ({
  createExampleService: vi.fn(),
  getExampleService: vi.fn()
}));

import { createExampleService } from '../../../src/services/example.services.js';
import { createExampleController } from '../../../src/controllers/example.controller.js';

describe('example.controller.js', () => {
  it('createExampleController should return 201 with the created resource', async () => {
    const created = { id: 1, name: 'item' };
    const req = { body: { name: 'item' }, params: {} };
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    createExampleService.mockResolvedValue(created);

    await createExampleController(req, res);

    expect(createExampleService).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith(created);
  });
});
