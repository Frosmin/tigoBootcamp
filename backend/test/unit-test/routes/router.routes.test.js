import { describe, expect, it, vi } from 'vitest';

const { mockRouter } = vi.hoisted(() => ({
  mockRouter: { post: vi.fn(), get: vi.fn(), put: vi.fn(), delete: vi.fn() }
}));
vi.mock('ultimate-express', () => ({ default: { Router: () => mockRouter } }));
vi.mock('../../../src/controllers/health.controller.js', () => ({
  healthController: 'healthController', readinessController: 'readinessController'
}));
vi.mock('../../../src/controllers/template.controller.js', () => ({
  createTemplateController: 'createTemplateController', updateTemplateController: 'updateTemplateController',
  deleteTemplateController: 'deleteTemplateController'
}));
vi.mock('../../../src/controllers/notification.controller.js', () => ({
  createNotificationController: 'createNotificationController', getNotificationController: 'getNotificationController',
  listNotificationsController: 'listNotificationsController', retryNotificationController: 'retryNotificationController'
}));
vi.mock('../../../src/middleware/validate.middleware.js', () => ({ validateRequestMiddleware: {
  createTemplate: vi.fn(() => 'createTemplateValidator'), updateTemplate: vi.fn(() => 'updateTemplateValidator'),
  createNotification: vi.fn(() => 'createNotificationValidator'), getNotification: vi.fn(() => 'idValidator'),
  retryNotification: vi.fn(() => 'retryValidator'), listNotifications: vi.fn(() => 'listValidator')
} }));

describe('router.routes.js', () => {
  it('registers all RF-7.1 to RF-7.5 endpoints', async () => {
    await import('../../../src/routes/router.routes.js');
    expect(mockRouter.get).toHaveBeenCalledWith('/health', 'healthController');
    expect(mockRouter.get).toHaveBeenCalledWith('/ready', 'readinessController');
    expect(mockRouter.post).toHaveBeenCalledWith('/templates', 'createTemplateValidator', 'createTemplateController');
    expect(mockRouter.put).toHaveBeenCalledWith('/templates/:id', 'idValidator', 'updateTemplateValidator', 'updateTemplateController');
    expect(mockRouter.delete).toHaveBeenCalledWith('/templates/:id', 'idValidator', 'deleteTemplateController');
    expect(mockRouter.get).toHaveBeenCalledWith('/notifications', 'listValidator', 'listNotificationsController');
    expect(mockRouter.get).toHaveBeenCalledWith('/notifications/:id', 'idValidator', 'getNotificationController');
    expect(mockRouter.post).toHaveBeenCalledWith('/notifications/:id/retry', 'retryValidator', 'retryNotificationController');
    expect(mockRouter.post).toHaveBeenCalledWith('/notifications', 'createNotificationValidator', 'createNotificationController');
  });
});
