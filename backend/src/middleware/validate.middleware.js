import { logger } from '../infrastructure/logger.js';
import { createTemplateSchema, updateTemplateSchema } from '../../schemas/template.schema.js';
import {
  createNotificationSchema, getNotificationParamsSchema,
  listNotificationsQuerySchema, retryNotificationParamsSchema
} from '../../schemas/notification.schema.js';
import { errorCodes } from '../utils/errorCodes.js';
import { sendError } from '../utils/response.js';

const reject = (res, issues) => {
  logger.info({ '[VALIDATION ISSUES]': issues });
  const { statusHttp, response } = sendError(errorCodes.MISSING_REQUIRED_PARAMETER);
  return res.status(statusHttp).json(response);
};

const validatePart = (schema, part) => (req, res, next) => {
  const result = schema.safeParse(req[part]);
  if (!result.success) return reject(res, result.error.issues);
  req[part] = result.data;
  return next();
};

const validateNotification = (req, res, next) => {
  const idempotencyKey = req.get?.('Idempotency-Key') ?? req.headers?.['idempotency-key'];
  const result = createNotificationSchema.safeParse({ idempotencyKey, body: req.body });
  if (!result.success) return reject(res, result.error.issues);
  req.body = result.data.body;
  req.idempotencyKey = result.data.idempotencyKey;
  return next();
};

export const validateRequestMiddleware = {
  createTemplate: () => validatePart(createTemplateSchema, 'body'),
  updateTemplate: () => validatePart(updateTemplateSchema, 'body'),
  createNotification: () => validateNotification,
  getNotification: () => validatePart(getNotificationParamsSchema, 'params'),
  retryNotification: () => validatePart(retryNotificationParamsSchema, 'params'),
  listNotifications: () => validatePart(listNotificationsQuerySchema, 'query')
};
