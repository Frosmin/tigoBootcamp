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
vi.mock('../../../src/controllers/notification.controller.js', () => ({
  createNotificationController: 'createNotificationController',
  getNotificationController: 'getNotificationController'
}));
vi.mock('../../../src/middleware/validate.middleware.js', () => ({
  validateRequestMiddleware: {
    createTemplate: vi.fn(() => 'createTemplateValidator'),
    createNotification: vi.fn(() => 'createNotificationValidator'),
    getNotification: vi.fn(() => 'getNotificationValidator')
  }
}));

describe('router.routes.js', () => {
  it('registers health, templates and notification endpoints', async () => {
    await import('../../../src/routes/router.routes.js');

    expect(mockRouter.get).toHaveBeenCalledWith('/health', 'healthController');
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/templates',
      'createTemplateValidator',
      'createTemplateController'
    );
    expect(mockRouter.post).toHaveBeenCalledWith(
      '/notifications',
      'createNotificationValidator',
      'createNotificationController'
    );
    expect(mockRouter.get).toHaveBeenCalledWith(
      '/notifications/:id',
      'getNotificationValidator',
      'getNotificationController'
    );
  });
});
