import ultimateExpress from 'ultimate-express';
import { healthController } from '../controllers/health.controller.js';
import { createTemplateController } from '../controllers/template.controller.js';
import { authenticateBearer } from '../middleware/auth.middleware.js';
import { validateRequestMiddleware } from '../middleware/validate.middleware.js';
const { Router } = ultimateExpress;

const router = Router();

// Health check (sin validacion)
router.get('/health', healthController);

router.post(
  '/templates',
  authenticateBearer,
  validateRequestMiddleware.createTemplate(),
  createTemplateController
);

export default router;
