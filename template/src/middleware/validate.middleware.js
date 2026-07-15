import { logger } from '@tigo/logger';
import { createExampleSchema, idParamSchema } from '../../schemas/example.schema.js';
import constants from '../utils/constants.js';
import { sendError } from '../utils/response.js';

/**
 * Factory de validacion. Combina body + params + headers relevantes y los
 * valida contra un schema de Zod. Si falla, responde con BAD_REQUEST.
 */
const validate = (schema) => (req, res, next) => {
  try {
    logger.info({ '[REQUEST HEADERS]': req.headers });
    logger.info({ '[REQUEST PARAMS]': req.params });
    logger.info({ '[REQUEST BODY]': req.body });

    const xtraceid = req.headers['x-traceid'];
    const xclientid = req.headers['x-clientid'];

    const data = {
      ...req.body,
      ...req.params,
      xtraceid,
      xclientid
    };

    const result = schema.safeParse(data);
    if (!result.success) {
      logger.info(`Validation failed ${JSON.stringify(result?.error?.issues)}`);
      throw new Error('Invalid request data');
    }
    next();
  } catch (error) {
    const { statusHttp, response } = sendError(constants.errors.BAD_REQUEST);
    res.status(statusHttp).json(response);
  }
};

export const validateRequestMiddleware = {
  createExample: () => validate(createExampleSchema),
  getExample: () => validate(idParamSchema)
};
