import { randomUUID } from 'node:crypto';
import { logger } from '../infrastructure/logger.js';

export const safeHttpLoggerMiddleware = () => (req, _res, next) => {
  const traceId = req.headers?.['x-traceid'] || randomUUID();
  req.traceId = traceId;
  logger.info({
    '[HTTP METHOD]': req.method,
    '[HTTP PATH]': req.originalUrl?.split('?')[0],
    '[TRACE ID]': traceId
  });
  next();
};
