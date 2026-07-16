import { describe, expect, it, vi } from 'vitest';

const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { post: vi.fn(), get: vi.fn() }
}));

vi.mock('ultimate-express', () => ({
  default: { Router: () => mockRouter }
}));
vi.mock('../../../src/controllers/health.controller.js', () => ({
  healthController: 'healthController'
}));
vi.mock('../../../src/controllers/template.controller.js', () => ({
  createTemplateController: 'createTemplateController'
}));
vi.mock('../../../src/middleware/auth.middleware.js', () => ({
  authenticateBearer: 'authenticateBearer'
}));
vi.mock('../../../src/middleware/validate.middleware.js', () => ({
  validateRequestMiddleware: {
    createTemplate: vi.fn(() => 'createTemplateValidator')
  }
}));

describe('router.routes.js', () => {
  it('registers health and POST /templates', async () => {
    await import('../../../src/routes/router.routes.js');

    expect(mockRouter.get).toHaveBeenCalledWith('/health', 'healthController');
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/templates',
      'authenticateBearer',
      'createTemplateValidator',
      'createTemplateController'
    );
  });
});
