import { logger } from '@tigo/logger';
import { createTemplateSchema } from '../../schemas/template.schema.js';
import { errorCodes } from '../utils/errorCodes.js';
import { sendError } from '../utils/response.js';

const validate = (schema) => (req, res, next) => {
  logger.info({ '[REQUEST PARAMS]': req.params });
  logger.info({ '[REQUEST BODY]': req.body });

  const result = schema.safeParse(req.body);
  if (!result.success) {
    logger.info({ '[VALIDATION ISSUES]': result.error.issues });
    const { statusHttp, response } = sendError(errorCodes.MISSING_REQUIRED_PARAMETER);
    return res.status(statusHttp).json(response);
  }

  req.body = result.data;
  return next();
};

export const validateRequestMiddleware = {
  createTemplate: () => validate(createTemplateSchema)
};
