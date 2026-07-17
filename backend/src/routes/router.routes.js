import ultimateExpress from 'ultimate-express';
import { healthController } from '../controllers/health.controller.js';
import { createTemplateController } from '../controllers/template.controller.js';
import { createNotificationController } from '../controllers/notification.controller.js';
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

router.post(
  '/notifications',
  validateRequestMiddleware.createNotification(),
  createNotificationController
);

export default router;
