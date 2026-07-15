import { logger } from '@tigo/logger';
import { sendError } from '../utils/response.js';
import { createExampleService, getExampleService } from '../services/example.services.js';

/**
 * Controllers del recurso `example`. Patron estandar:
 *  - Miden el tiempo de ejecucion con el logger.
 *  - Delegan la logica al service.
 *  - Traducen cualquier error a una respuesta segura con sendError.
 */

export async function createExampleController(req, res) {
  let responseBody = {};
  logger.startTimer('ExecutionTimeAll');
  try {
    responseBody = await createExampleService(req.body);
    return res.status(201).json(responseBody);
  } catch (error) {
    const { statusHttp, response } = sendError(error?.errorCode);
    responseBody = response;
    return res.status(statusHttp).json(responseBody);
  } finally {
    logger.info({ '[RESPONSE BODY]': responseBody });
    logger.endTimer('ExecutionTimeAll');
  }
}

export async function getExampleController(req, res) {
  let responseBody = {};
  logger.startTimer('ExecutionTimeAll');
  try {
    responseBody = await getExampleService({ id: Number(req.params.id) });
    return res.status(200).json(responseBody);
  } catch (error) {
    const { statusHttp, response } = sendError(error?.errorCode);
    responseBody = response;
    return res.status(statusHttp).json(responseBody);
  } finally {
    logger.info({ '[RESPONSE BODY]': responseBody });
    logger.endTimer('ExecutionTimeAll');
  }
}
