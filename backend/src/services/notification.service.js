import { logger } from '@tigo/logger';
import { findTemplateById } from '../repositories/template.repository.js';
import {
  deleteNotificationAfterQueueFailure,
  findNotificationById,
  findNotificationByIdempotencyKey,
  findNotificationsPage,
  insertNotification
} from '../repositories/notification.repository.js';
import { enqueueNotification } from '../queues/notification.queue.js';
import { findAttemptsByNotificationId } from '../repositories/attempt.repository.js';
import { errorCodes, setError } from '../utils/errorCodes.js';

const haveSameKeys = (received, required) => {
  const receivedKeys = Object.keys(received).sort((a, b) => a.localeCompare(b));
  const requiredKeys = [...required].sort((a, b) => a.localeCompare(b));
  return receivedKeys.length === requiredKeys.length
    && receivedKeys.every((key, index) => key === requiredKeys[index]);
};

const sameVariables = (left, right) => {
  const leftKeys = Object.keys(left).sort((a, b) => a.localeCompare(b));
  const rightKeys = Object.keys(right).sort((a, b) => a.localeCompare(b));
  return leftKeys.length === rightKeys.length
    && leftKeys.every((key, index) => (
      key === rightKeys[index] && Object.is(left[key], right[key])
    ));
};

const isSameRequest = (notification, request) => (
  notification.canal === request.canal
  && notification.destinatario === request.destinatario
  && String(notification.plantillaId) === String(request.plantillaId)
  && sameVariables(notification.variables, request.variables)
);

export const createNotificationService = async (request, idempotencyKey) => {
  const template = await findTemplateById(request.plantillaId);
  if (!template) {
    throw setError('Template not found', errorCodes.NOT_FOUND);
  }

  if (template.canal !== request.canal
    || !haveSameKeys(request.variables, template.variables)) {
    throw setError('Notification does not match template', errorCodes.MISSING_REQUIRED_PARAMETER);
  }

  const created = await insertNotification({ ...request, idempotencyKey });
  if (!created) {
    const existing = await findNotificationByIdempotencyKey(idempotencyKey);
    if (!existing || !isSameRequest(existing, request)) {
      throw setError('Idempotency key already used', errorCodes.RESOURCE_CONFLICT);
    }
    return { notification: existing, created: false };
  }

  try {
    await enqueueNotification(created.id);
  } catch (queueError) {
    logger.error({
      '[QUEUE ENQUEUE ERROR]': queueError.message,
      '[NOTIFICATION ID]': created.id
    });
    try {
      await deleteNotificationAfterQueueFailure(created.id, idempotencyKey);
    } catch (compensationError) {
      logger.error({
        '[QUEUE COMPENSATION ERROR]': compensationError.message,
        '[NOTIFICATION ID]': created.id
      });
    }
    throw setError('Redis is unavailable', errorCodes.SERVICE_TEMPORARILY_UNAVAILABLE);
  }

  return { notification: created, created: true };
};

export const getNotificationService = async (id) => {
  const notification = await findNotificationById(id);
  if (!notification) {
    throw setError('Notification not found', errorCodes.NOT_FOUND);
  }

  const historialIntentos = await findAttemptsByNotificationId(id);
  return { ...notification, historialIntentos };
};

export const listNotificationsService = async ({
  canal,
  estado,
  page,
  limit
}) => {
  const offset = (BigInt(page - 1) * BigInt(limit)).toString();
  const { items, totalItems } = await findNotificationsPage({
    canal,
    estado,
    limit,
    offset
  });

  return {
    items,
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.ceil(totalItems / limit)
    }
  };
};
