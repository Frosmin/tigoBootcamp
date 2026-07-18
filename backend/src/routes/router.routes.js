import ultimateExpress from 'ultimate-express';
import { healthController, readinessController } from '../controllers/health.controller.js';
import {
  createTemplateController, deleteTemplateController, updateTemplateController
} from '../controllers/template.controller.js';
import {
  createNotificationController, getNotificationController,
  listNotificationsController, retryNotificationController
} from '../controllers/notification.controller.js';
import { validateRequestMiddleware as validate } from '../middleware/validate.middleware.js';

const router = ultimateExpress.Router();
router.get('/health', healthController);
router.get('/ready', readinessController);

router.post('/templates', validate.createTemplate(), createTemplateController);
router.put('/templates/:id', validate.getNotification(), validate.updateTemplate(), updateTemplateController);
router.delete('/templates/:id', validate.getNotification(), deleteTemplateController);

router.get('/notifications', validate.listNotifications(), listNotificationsController);
router.get('/notifications/:id', validate.getNotification(), getNotificationController);
router.post('/notifications/:id/retry', validate.retryNotification(), retryNotificationController);
router.post('/notifications', validate.createNotification(), createNotificationController);

export default router;
