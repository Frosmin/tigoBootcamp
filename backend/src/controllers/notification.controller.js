import { logger } from '../infrastructure/logger.js';
import {
  createNotificationService, getNotificationService,
  listNotificationsService, retryNotificationService
} from '../services/notification.service.js';
import { sendError } from '../utils/response.js';

const errorResponse = (res, error) => {
  logger.error({ '[NOTIFICATION ERROR]': error.message });
  const { statusHttp, response } = sendError(error?.errorCode);
  return res.status(statusHttp).json(response);
};

export async function createNotificationController(req, res) {
  try {
    const result = await createNotificationService(req.body, req.idempotencyKey);
    return res.status(result.created ? 202 : 200).json(result.notification);
  } catch (error) { return errorResponse(res, error); }
}

export async function getNotificationController(req, res) {
  try { return res.status(200).json(await getNotificationService(req.params.id)); }
  catch (error) { return errorResponse(res, error); }
}

export async function listNotificationsController(req, res) {
  try { return res.status(200).json(await listNotificationsService(req.query)); }
  catch (error) { return errorResponse(res, error); }
}

export async function retryNotificationController(req, res) {
  try { return res.status(202).json(await retryNotificationService(req.params.id)); }
  catch (error) { return errorResponse(res, error); }
}
