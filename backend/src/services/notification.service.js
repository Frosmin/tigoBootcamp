import { findTemplateById } from '../repositories/template.repository.js';
import {
  findNotificationById, findNotificationByIdempotencyKey, insertNotification,
  listNotifications, scheduleNotificationRetry
} from '../repositories/notification.repository.js';
import { findAttemptsByNotificationId } from '../repositories/attempt.repository.js';
import { errorCodes, setError } from '../utils/errorCodes.js';
import config from '../utils/config.js';
import { decodeCursor, encodeCursor } from '../utils/cursor.js';
import { renderTemplate } from './template.renderer.js';

const haveSameKeys = (received, required) => {
  const left = Object.keys(received).sort((a, b) => a.localeCompare(b));
  const right = [...required].sort((a, b) => a.localeCompare(b));
  return left.length === right.length && left.every((key, index) => key === right[index]);
};

const sameVariables = (left, right) => {
  const leftKeys = Object.keys(left).sort((a, b) => a.localeCompare(b));
  const rightKeys = Object.keys(right).sort((a, b) => a.localeCompare(b));
  return leftKeys.length === rightKeys.length && leftKeys.every((key, index) => (
    key === rightKeys[index] && Object.is(left[key], right[key])
  ));
};

const isSameRequest = (notification, request) => notification.canal === request.canal
  && notification.destinatario === request.destinatario
  && String(notification.plantillaId) === String(request.plantillaId)
  && sameVariables(notification.variables, request.variables);

export const createNotificationService = async (request, idempotencyKey) => {
  if (request.canal === 'SMS' && !config.SMS_ENABLED) {
    throw setError('SMS provider is not configured', errorCodes.SERVICE_TEMPORARILY_UNAVAILABLE);
  }
  if (request.canal === 'EMAIL' && !config.EMAIL_ENABLED) {
    throw setError('Email provider is disabled', errorCodes.SERVICE_TEMPORARILY_UNAVAILABLE);
  }
  const template = await findTemplateById(request.plantillaId);
  if (!template) throw setError('Template not found', errorCodes.NOT_FOUND);
  if (template.canal !== request.canal || !haveSameKeys(request.variables, template.variables)) {
    throw setError('Notification does not match template', errorCodes.MISSING_REQUIRED_PARAMETER);
  }
  const created = await insertNotification({
    ...request,
    idempotencyKey,
    asunto: template.nombre,
    contenidoRenderizado: renderTemplate(template.contenido, request.variables),
    attemptsAllowed: Math.min(config.DELIVERY_AUTO_ATTEMPTS, config.DELIVERY_MAX_ATTEMPTS)
  });
  if (!created) {
    const existing = await findNotificationByIdempotencyKey(idempotencyKey);
    if (!existing || !isSameRequest(existing, request)) {
      throw setError('Idempotency key already used', errorCodes.RESOURCE_CONFLICT);
    }
    return { notification: existing, created: false };
  }
  return { notification: created, created: true };
};

export const getNotificationService = async (id) => {
  const notification = await findNotificationById(id);
  if (!notification) throw setError('Notification not found', errorCodes.NOT_FOUND);
  return { ...notification, historialIntentos: await findAttemptsByNotificationId(id) };
};

export const listNotificationsService = async (query) => {
  const cursor = decodeCursor(query.cursor);
  const rows = await listNotifications({ ...query, cursor });
  const hasMore = rows.length > query.limit;
  const items = hasMore ? rows.slice(0, query.limit) : rows;
  return {
    items,
    page: {
      limit: query.limit,
      nextCursor: hasMore ? encodeCursor(items.at(-1)) : null
    }
  };
};

export const retryNotificationService = async (id) => {
  const result = await scheduleNotificationRetry(
    id,
    config.DELIVERY_MAX_ATTEMPTS,
    config.DELIVERY_AUTO_ATTEMPTS
  );
  if (result.reason === 'NOT_FOUND') throw setError('Notification not found', errorCodes.NOT_FOUND);
  if (result.reason) throw setError('Notification cannot be retried', errorCodes.RESOURCE_CONFLICT);
  return result.notification;
};
