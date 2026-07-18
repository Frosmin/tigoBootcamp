import { randomUUID } from 'node:crypto';
import { Worker, UnrecoverableError } from 'bullmq';
import { logger } from '../infrastructure/logger.js';
import config from '../utils/config.js';
import { createWorkerRedisClient } from '../infrastructure/redis.client.js';
import { queueNameForChannel } from '../queues/notification.queue.js';
import {
  claimNotificationForDelivery, recordDeliveryResult
} from '../repositories/notification.repository.js';
import { createDeliveryConnector } from '../connectors/connector.factory.js';
import { normalizeDeliveryError } from '../connectors/delivery.error.js';

export const createDeliveryWorker = (channel) => {
  const connector = createDeliveryConnector(channel);
  const connection = createWorkerRedisClient();
  const concurrency = channel === 'EMAIL' ? config.EMAIL_WORKER_CONCURRENCY : config.SMS_WORKER_CONCURRENCY;
  const rateLimit = channel === 'EMAIL' ? config.EMAIL_RATE_LIMIT_PER_MINUTE : config.SMS_RATE_LIMIT_PER_MINUTE;

  const worker = new Worker(queueNameForChannel(channel), async (job) => {
    const token = `${job.id}-${randomUUID()}`;
    const notification = await claimNotificationForDelivery(
      job.data.notificationId,
      job.data.generation,
      token,
      config.DELIVERY_LEASE_MS
    );
    if (!notification) return { skipped: true };
    const startedAt = Date.now();
    try {
      const result = await connector.send(notification);
      await recordDeliveryResult({
        id: notification.id, generation: notification.generacion, token,
        success: true, terminal: true, detail: result.response,
        retryable: false, durationMs: Date.now() - startedAt,
        providerMessageId: result.messageId
      });
      return { delivered: true, providerMessageId: result.messageId };
    } catch (rawError) {
      const error = normalizeDeliveryError(rawError);
      const attemptNumber = notification.intentos + 1;
      const exhaustedJob = job.attemptsMade + 1 >= job.opts.attempts;
      const exhaustedTotal = attemptNumber >= config.DELIVERY_MAX_ATTEMPTS;
      const terminal = !error.retryable || exhaustedJob || exhaustedTotal;
      await recordDeliveryResult({
        id: notification.id, generation: notification.generacion, token,
        success: false, terminal, detail: error.message, errorCode: error.code,
        retryable: error.retryable, durationMs: Date.now() - startedAt
      });
      if (terminal) throw new UnrecoverableError(error.message);
      throw error;
    }
  }, {
    connection,
    prefix: config.BULLMQ_PREFIX,
    concurrency,
    limiter: { max: rateLimit, duration: 60000 },
    lockDuration: config.DELIVERY_LEASE_MS,
    maxStalledCount: 1,
    metrics: { maxDataPoints: 10080 }
  });

  worker.on('completed', (job) => logger.info({ '[JOB COMPLETED]': job.id }));
  worker.on('failed', (job) => logger.error({ '[JOB FAILED]': job?.id }));
  worker.on('error', () => logger.error({ '[WORKER ERROR]': 'Redis/BullMQ worker error' }));
  return { worker, connector, connection };
};
