import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  Worker, UnrecoverableError, workerOn, connector, createDeliveryConnector,
  claimNotificationForDelivery, recordDeliveryResult, logger
} = vi.hoisted(() => {
  const workerOn = vi.fn();
  class UnrecoverableErrorMock extends Error {}
  return {
    Worker: vi.fn(function WorkerMock(name, processor, options) {
      return { name, processor, options, on: workerOn };
    }),
    UnrecoverableError: UnrecoverableErrorMock,
    workerOn,
    connector: { send: vi.fn(), verify: vi.fn(), close: vi.fn() },
    createDeliveryConnector: vi.fn(),
    claimNotificationForDelivery: vi.fn(), recordDeliveryResult: vi.fn(),
    logger: { info: vi.fn(), error: vi.fn() }
  };
});

vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'uuid') }));
vi.mock('bullmq', () => ({ Worker, UnrecoverableError }));
vi.mock('@tigo/logger', () => ({ logger }));
vi.mock('../../../src/utils/config.js', () => ({ default: {
  EMAIL_WORKER_CONCURRENCY: 5, SMS_WORKER_CONCURRENCY: 2,
  EMAIL_RATE_LIMIT_PER_MINUTE: 60, SMS_RATE_LIMIT_PER_MINUTE: 10,
  DELIVERY_LEASE_MS: 30000, DELIVERY_MAX_ATTEMPTS: 5, BULLMQ_PREFIX: 'p07'
} }));
vi.mock('../../../src/infrastructure/redis.client.js', () => ({
  createWorkerRedisClient: vi.fn(() => ({ redis: true }))
}));
vi.mock('../../../src/queues/notification.queue.js', () => ({
  queueNameForChannel: vi.fn((channel) => `p07-${channel.toLowerCase()}`)
}));
vi.mock('../../../src/repositories/notification.repository.js', () => ({
  claimNotificationForDelivery, recordDeliveryResult
}));
vi.mock('../../../src/connectors/connector.factory.js', () => ({ createDeliveryConnector }));

import { createDeliveryWorker } from '../../../src/workers/delivery.worker.js';

describe('delivery.worker.js', () => {
  const notification = {
    id: '42', generacion: 2, intentos: 1, destinatario: 'ana@example.com'
  };
  const job = {
    id: 'notification-42-g2', data: { notificationId: '42', generation: 2 },
    attemptsMade: 0, opts: { attempts: 3 }
  };

  beforeEach(() => {
    vi.clearAllMocks();
    createDeliveryConnector.mockReturnValue(connector);
    claimNotificationForDelivery.mockResolvedValue(notification);
    recordDeliveryResult.mockResolvedValue(notification);
    connector.send.mockResolvedValue({ messageId: 'provider-1', response: '250 accepted' });
    vi.spyOn(Date, 'now').mockReturnValueOnce(1000).mockReturnValue(1015);
  });

  it('configures global channel rate limiting, concurrency and event telemetry', () => {
    const { worker } = createDeliveryWorker('EMAIL');
    expect(worker.name).toBe('p07-email');
    expect(worker.options).toMatchObject({
      prefix: 'p07', concurrency: 5, limiter: { max: 60, duration: 60000 },
      lockDuration: 30000, maxStalledCount: 1
    });
    expect(workerOn.mock.calls.map(([event]) => event)).toEqual(['completed', 'failed', 'error']);
    workerOn.mock.calls[0][1]({ id: '1' });
    workerOn.mock.calls[1][1](undefined, new Error('failed'));
    workerOn.mock.calls[2][1](new Error('redis'));
    expect(logger.info).toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('uses independent SMS capacity', () => {
    const { worker } = createDeliveryWorker('SMS');
    expect(worker.options).toMatchObject({ concurrency: 2, limiter: { max: 10, duration: 60000 } });
  });

  it('skips obsolete, duplicate or already delivered jobs', async () => {
    claimNotificationForDelivery.mockResolvedValue(undefined);
    const { worker } = createDeliveryWorker('EMAIL');
    await expect(worker.processor(job)).resolves.toEqual({ skipped: true });
    expect(connector.send).not.toHaveBeenCalled();
  });

  it('records provider success atomically', async () => {
    const { worker } = createDeliveryWorker('EMAIL');
    await expect(worker.processor(job)).resolves.toEqual({
      delivered: true, providerMessageId: 'provider-1'
    });
    expect(claimNotificationForDelivery).toHaveBeenCalledWith('42', 2, expect.stringContaining(job.id), 30000);
    expect(recordDeliveryResult).toHaveBeenCalledWith(expect.objectContaining({
      id: '42', generation: 2, success: true, terminal: true,
      retryable: false, providerMessageId: 'provider-1', durationMs: expect.any(Number)
    }));
  });

  it('records a retryable error and lets BullMQ retry it', async () => {
    const error = Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' });
    connector.send.mockRejectedValue(error);
    const { worker } = createDeliveryWorker('EMAIL');
    await expect(worker.processor(job)).rejects.toMatchObject({ retryable: true, code: 'ETIMEDOUT' });
    expect(recordDeliveryResult).toHaveBeenCalledWith(expect.objectContaining({
      success: false, terminal: false, retryable: true, errorCode: 'ETIMEDOUT'
    }));
  });

  it.each([
    [Object.assign(new Error('rejected'), { responseCode: 550 }), job],
    [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), { ...job, attemptsMade: 2 }],
    [Object.assign(new Error('timeout'), { code: 'ETIMEDOUT' }), job, { ...notification, intentos: 4 }]
  ])('ends permanent or exhausted work with UnrecoverableError', async (error, currentJob, currentNotification = notification) => {
    claimNotificationForDelivery.mockResolvedValue(currentNotification);
    connector.send.mockRejectedValue(error);
    const { worker } = createDeliveryWorker('EMAIL');
    await expect(worker.processor(currentJob)).rejects.toBeInstanceOf(UnrecoverableError);
    expect(recordDeliveryResult).toHaveBeenCalledWith(expect.objectContaining({ terminal: true }));
  });
});
