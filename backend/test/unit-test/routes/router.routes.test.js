import { describe, it, expect, vi } from 'vitest';

// Mock de ultimate-express
vi.mock('ultimate-express', () => {
  const mockRouter = { post: vi.fn(), get: vi.fn() };
  return { default: { Router: () => mockRouter } };
});

// Mock de controllers y middleware
vi.mock('../../../src/controllers/health.controller.js', () => ({ healthController: vi.fn() }));
vi.mock('../../../src/controllers/example.controller.js', () => ({
  createExampleController: vi.fn(),
  getExampleController: vi.fn()
}));
vi.mock('../../../src/middleware/validate.middleware.js', () => ({
  validateRequestMiddleware: {
    createExample: vi.fn(() => 'createValidator'),
    getExample: vi.fn(() => 'getValidator')
  }
}));

describe('router.routes.js', () => {
  it('should register the POST and GET routes of the example resource', async () => {
    const { default: router } = await import('../../../src/routes/router.routes.js');

    expect(router.post).toHaveBeenCalledWith('/examples', expect.anything(), expect.anything());
    expect(router.get).toHaveBeenCalledWith('/examples/:id', expect.anything(), expect.anything());
  });
});
