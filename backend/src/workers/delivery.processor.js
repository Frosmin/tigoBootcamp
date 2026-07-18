import { randomUUID } from 'node:crypto';
import { logger } from '@tigo/logger';
import config from '../utils/config.js';
import { findNotificationForDelivery } from '../repositories/notification.repository.js';
import { recordDeliveryAttempt } from '../repositories/attempt.repository.js';
import { renderTemplate } from '../domain/template.renderer.js';
import { calculateRetryDelay } from '../domain/retry.policy.js';
import {
  acquireDeliveryLock,
  acquireThroughputPermit,
  isMarkedDelivered,
  markDelivered,
  releaseDeliveryLock,
  scheduleNotification
} from '../queues/worker.queue.js';
import { deliveryErrorDetail, toDeliveryError } from '../delivery/delivery.error.js';

const defaultDependencies = {
  findNotificationForDelivery,
  recordDeliveryAttempt,
  renderTemplate,
  acquireDeliveryLock,
  acquireThroughputPermit,
  isMarkedDelivered,
  markDelivered,
  releaseDeliveryLock,
  scheduleNotification,
  now: () => Date.now(),
  token: () => randomUUID()
};

export const createDeliveryProcessor = ({
  emailConnector,
  smsConnector,
  dependencies = {}
}) => {
  const deps = { ...defaultDependencies, ...dependencies };

  return async (notificationId) => {
    const lockToken = deps.token();
    const locked = await deps.acquireDeliveryLock(notificationId, lockToken);
    if (!locked) return { outcome: 'DUPLICATE_LOCKED' };

    try {
      const notification = await deps.findNotificationForDelivery(notificationId);
      if (!notification) return { outcome: 'NOT_FOUND' };
      if (notification.estado === 'ENVIADA') return { outcome: 'ALREADY_SENT' };
      if (notification.estado === 'FALLIDA') return { outcome: 'ALREADY_FAILED' };

      const nowMs = deps.now();
      const nextAttemptMs = notification.nextAttemptAt
        ? new Date(notification.nextAttemptAt).getTime()
        : 0;
      if (nextAttemptMs > nowMs) {
        await deps.scheduleNotification(notificationId, nextAttemptMs);
        return { outcome: 'NOT_DUE', dueAtMs: nextAttemptMs };
      }

      if (await deps.isMarkedDelivered(notificationId)) {
        await deps.recordDeliveryAttempt({
          notificationId,
          result: 'EXITOSO',
          detail: 'RECOVERED_FROM_DELIVERED_GUARD',
          state: 'ENVIADA'
        });
        return { outcome: 'RECOVERED_DELIVERED' };
      }

      let contenido;
      try {
        contenido = deps.renderTemplate(
          notification.templateContent,
          notification.variables
        );
      } catch (error) {
        const renderError = toDeliveryError(error);
        await deps.recordDeliveryAttempt({
          notificationId,
          result: 'FALLIDO',
          detail: deliveryErrorDetail(renderError),
          state: 'FALLIDA'
        });
        return { outcome: 'FAILED', retryable: false };
      }
      const limit = notification.canal === 'EMAIL'
        ? config.EMAIL_MAX_PER_MINUTE
        : config.SMS_MAX_PER_MINUTE;
      const permit = await deps.acquireThroughputPermit(notification.canal, limit);
      if (!permit.allowed) {
        await deps.scheduleNotification(notificationId, permit.retryAtMs);
        return { outcome: 'RATE_LIMITED', dueAtMs: permit.retryAtMs };
      }

      const connector = notification.canal === 'EMAIL' ? emailConnector : smsConnector;
      let deliveryError;
      try {
        await connector.send({
          notificationId,
          destinatario: notification.destinatario,
          asunto: notification.templateName,
          contenido
        });
      } catch (error) {
        deliveryError = toDeliveryError(error);
      }

      if (!deliveryError) {
        try {
          await deps.markDelivered(notificationId);
        } catch (error) {
          logger.error({
            '[DELIVERED MARK ERROR]': error.message,
            '[NOTIFICATION ID]': notificationId
          });
        }
        await deps.recordDeliveryAttempt({
          notificationId,
          result: 'EXITOSO',
          detail: null,
          state: 'ENVIADA'
        });
        return { outcome: 'SENT' };
      }

      const attemptNumber = Number(notification.intentos) + 1;
      const exhausted = attemptNumber >= config.MAX_DELIVERY_ATTEMPTS;

      if (!deliveryError.retryable || exhausted) {
        await deps.recordDeliveryAttempt({
          notificationId,
          result: 'FALLIDO',
          detail: deliveryErrorDetail(deliveryError),
          state: 'FALLIDA'
        });
        return { outcome: 'FAILED', retryable: deliveryError.retryable };
      }

      const delayMs = calculateRetryDelay(
        attemptNumber,
        config.RETRY_BASE_DELAY_MS,
        config.RETRY_MAX_DELAY_MS
      );
      const dueAtMs = nowMs + delayMs;
      await deps.recordDeliveryAttempt({
        notificationId,
        result: 'FALLIDO',
        detail: deliveryErrorDetail(deliveryError),
        state: 'ENCOLADA',
        nextAttemptAt: new Date(dueAtMs).toISOString()
      });
      await deps.scheduleNotification(notificationId, dueAtMs);
      return { outcome: 'RETRY_SCHEDULED', dueAtMs };
    } finally {
      try {
        await deps.releaseDeliveryLock(notificationId, lockToken);
      } catch (error) {
        logger.error({
          '[DELIVERY LOCK RELEASE ERROR]': error.message,
          '[NOTIFICATION ID]': notificationId
        });
      }
    }
  };
};
