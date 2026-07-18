import { describe, expect, it, vi } from 'vitest';

const { addBulk, add, close, on, Queue, QueueEvents, logger } = vi.hoisted(() => {
  const bulk = vi.fn();
  const addJob = vi.fn();
  const closeQueue = vi.fn();
  return {
    addBulk: bulk,
    add: addJob,
    close: closeQueue,
    on: vi.fn(),
    logger: { error: vi.fn() },
    Queue: vi.fn(function QueueMock() { return { addBulk: bulk, add: addJob, close: closeQueue }; }),
    QueueEvents: vi.fn(function QueueEventsMock() { return { on, close: closeQueue }; })
  };
});
vi.mock('bullmq', () => ({ Queue, QueueEvents }));
vi.mock('@tigo/logger', () => ({ logger }));
vi.mock('../../../src/infrastructure/redis.client.js', () => ({ createProducerRedisClient: vi.fn(() => ({})) }));
vi.mock('../../../src/utils/config.js', () => ({ default: {
  EMAIL_QUEUE_NAME: 'notifications-email', SMS_QUEUE_NAME: 'notifications-sms', BULLMQ_PREFIX: 'p07',
  DELIVERY_BACKOFF_MS: 1000, DELIVERY_BACKOFF_JITTER: 0.5,
  JOBS_COMPLETED_AGE_SECONDS: 3600, JOBS_COMPLETED_COUNT: 1000,
  JOBS_FAILED_AGE_SECONDS: 604800, JOBS_FAILED_COUNT: 5000
} }));

import {
  closeNotificationQueues, enqueueNotification, initializeQueueEvents,
  publishOutboxEvents, queueNameForChannel
} from '../../../src/queues/notification.queue.js';

describe('notification.queue.js', () => {
  it('publishes deterministic BullMQ jobs in bulk', async () => {
    addBulk.mockResolvedValue([{ id: 'notification-42-g2' }]);
    const events = [{
      id: '7', aggregateId: '42', generation: 2, channel: 'EMAIL',
      payload: { notificationId: '42', generation: 2, channel: 'EMAIL', attemptsAllowed: 2 }
    }];
    await expect(publishOutboxEvents(events)).resolves.toHaveLength(1);
    expect(addBulk).toHaveBeenCalledWith([expect.objectContaining({
      name: 'send-email',
      opts: expect.objectContaining({
        jobId: 'notification-42-g2', attempts: 2,
        backoff: { type: 'exponential', delay: 1000, jitter: 0.5 }
      })
    })]);
  });

  it('does not initialize Redis for an empty outbox batch', async () => {
    await expect(publishOutboxEvents([])).resolves.toEqual([]);
  });

  it('maps channels to independent queues', () => {
    expect(queueNameForChannel('EMAIL')).toBe('notifications-email');
    expect(queueNameForChannel('SMS')).toBe('notifications-sms');
  });

  it('creates one QueueEvents instance and emits sanitized telemetry', () => {
    const first = initializeQueueEvents('EMAIL');
    expect(initializeQueueEvents('EMAIL')).toBe(first);
    expect(QueueEvents).toHaveBeenCalledOnce();
    const handlers = Object.fromEntries(on.mock.calls.map(([event, handler]) => [event, handler]));
    handlers.failed({ jobId: '1', failedReason: 'failure' });
    handlers.stalled({ jobId: '2' });
    handlers.error(new Error('redis'));
    expect(logger.error).toHaveBeenCalledTimes(3);
  });

  it('keeps the compatibility enqueue helper and closes all resources', async () => {
    add.mockResolvedValue({ id: 'notification-5-g1' });
    await expect(enqueueNotification('5')).resolves.toMatchObject({ id: 'notification-5-g1' });
    expect(add).toHaveBeenCalledWith('send-email', expect.objectContaining({ notificationId: '5' }), {
      jobId: 'notification-5-g1'
    });
    await closeNotificationQueues();
    expect(close).toHaveBeenCalled();
  });
});
