import { logger } from '@tigo/logger';
import config from '../utils/config.js';
import { errorCodes } from '../utils/errorCodes.js';
import { sendError } from '../utils/response.js';

const sendAuthError = (res, errorCode) => {
  const { statusHttp, response } = sendError(errorCode);
  return res.status(statusHttp).json(response);
};

export const authenticateBearer = (req, res, next) => {
  const authorization = req.headers.authorization;

  if (!authorization) {
    return sendAuthError(res, errorCodes.MISSING_TOKEN);
  }

  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return sendAuthError(res, errorCodes.MISSING_TOKEN);
  }

  if (!config.APP_PASSWORD) {
    logger.error('APP_PASSWORD is not configured');
    return sendAuthError(res, errorCodes.GENERIC_INTERNAL_SERVER_ERROR);
  }

  if (match[1] !== config.APP_PASSWORD) {
    return sendAuthError(res, errorCodes.INVALID_TOKEN);
  }

  return next();
};
