import ultimateExpress from 'ultimate-express';
import { healthController } from '../controllers/health.controller.js';
import {
  createTemplateController,
  deleteTemplateController,
  updateTemplateController
} from '../controllers/template.controller.js';
import {
  createNotificationController,
  getNotificationController
} from '../controllers/notification.controller.js';
import { validateRequestMiddleware } from '../middleware/validate.middleware.js';
const { Router } = ultimateExpress;

const router = Router();

// Health check (sin validacion)
router.get('/health', healthController);

router.post(
  '/templates',
  validateRequestMiddleware.createTemplate(),
  createTemplateController
);

router.put(
  '/templates/:id',
  validateRequestMiddleware.templateId(),
  validateRequestMiddleware.updateTemplate(),
  updateTemplateController
);

router.delete(
  '/templates/:id',
  validateRequestMiddleware.templateId(),
  deleteTemplateController
);

router.get(
  '/notifications/:id',
  validateRequestMiddleware.getNotification(),
  getNotificationController
);

router.post(
  '/notifications',
  validateRequestMiddleware.createNotification(),
  createNotificationController
);

export default router;
