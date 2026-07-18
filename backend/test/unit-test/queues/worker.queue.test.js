import { beforeEach, describe, expect, it, vi } from 'vitest';

const redis = {
  xgroup: vi.fn(),
  xreadgroup: vi.fn(),
  xautoclaim: vi.fn(),
  xack: vi.fn(),
  zadd: vi.fn(),
  eval: vi.fn(),
  set: vi.fn(),
  get: vi.fn()
};
vi.mock('../../../src/infrastructure/redis.client.js', () => ({
  getRedisClient: () => redis
}));
vi.mock('../../../src/utils/config.js', () => ({
  default: {
    NOTIFICATION_STREAM: 'notifications:dispatch',
    NOTIFICATION_DELAYED_SET: 'notifications:delayed',
    NOTIFICATION_CONSUMER_GROUP: 'workers',
    WORKER_BLOCK_MS: 5000,
    WORKER_CLAIM_IDLE_MS: 30000,
    WORKER_LOCK_TTL_MS: 60000,
    DELIVERED_MARK_TTL_MS: 604800000
  }
}));

import {
  acknowledgeNotificationMessage,
  acquireDeliveryLock,
  acquireThroughputPermit,
  claimStaleNotificationMessages,
  ensureNotificationConsumerGroup,
  isMarkedDelivered,
  markDelivered,
  promoteDueNotifications,
  readNotificationMessages,
  releaseDeliveryLock,
  scheduleNotification
} from '../../../src/queues/worker.queue.js';

describe('worker.queue.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.values(redis).forEach((mock) => mock.mockResolvedValue(undefined));
  });

  it('creates a consumer group from the beginning and tolerates BUSYGROUP', async () => {
    redis.xgroup.mockResolvedValueOnce('OK');
    await ensureNotificationConsumerGroup();
    expect(redis.xgroup).toHaveBeenCalledWith(
      'CREATE', 'notifications:dispatch', 'workers', '0', 'MKSTREAM'
    );

    redis.xgroup.mockRejectedValueOnce(new Error('BUSYGROUP already exists'));
    await expect(ensureNotificationConsumerGroup()).resolves.toBeUndefined();
    redis.xgroup.mockRejectedValueOnce(new Error('redis down'));
    await expect(ensureNotificationConsumerGroup()).rejects.toThrow('redis down');
  });

  it('reads and parses new stream messages', async () => {
    redis.xreadgroup.mockResolvedValue([
      ['notifications:dispatch', [['1-0', ['notificationId', '42']]]]
    ]);
    await expect(readNotificationMessages('worker-1')).resolves.toEqual([
      { messageId: '1-0', notificationId: '42' }
    ]);
    redis.xreadgroup.mockResolvedValue(null);
    await expect(readNotificationMessages('worker-1')).resolves.toEqual([]);
  });

  it('claims stale messages and returns the next cursor', async () => {
    redis.xautoclaim.mockResolvedValue([
      '2-0',
      [['1-0', ['notificationId', '42']]],
      []
    ]);
    await expect(claimStaleNotificationMessages('worker-1')).resolves.toEqual({
      nextId: '2-0',
      messages: [{ messageId: '1-0', notificationId: '42' }]
    });
  });

  it('acks, schedules and promotes jobs', async () => {
    await acknowledgeNotificationMessage('1-0');
    expect(redis.xack).toHaveBeenCalledWith('notifications:dispatch', 'workers', '1-0');
    await scheduleNotification('42', 1234);
    expect(redis.zadd).toHaveBeenCalledWith('notifications:delayed', 1234, '42');
    await promoteDueNotifications(1234, 5);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('ZRANGEBYSCORE'),
      2,
      'notifications:delayed',
      'notifications:dispatch',
      1234,
      5
    );
  });

  it('uses token-protected locks and delivery markers', async () => {
    redis.set.mockResolvedValueOnce('OK');
    await expect(acquireDeliveryLock('42', 'token')).resolves.toBe(true);
    redis.set.mockResolvedValueOnce(null);
    await expect(acquireDeliveryLock('42', 'token')).resolves.toBe(false);
    await releaseDeliveryLock('42', 'token');
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('GET'"),
      1,
      'notification:delivery-lock:42',
      'token'
    );

    redis.get.mockResolvedValueOnce('1').mockResolvedValueOnce(null);
    await expect(isMarkedDelivered('42')).resolves.toBe(true);
    await expect(isMarkedDelivered('43')).resolves.toBe(false);
    await markDelivered('42');
    expect(redis.set).toHaveBeenCalledWith(
      'notification:delivered:42',
      '1',
      'PX',
      604800000
    );
  });

  it('returns the distributed channel throughput decision', async () => {
    redis.eval.mockResolvedValue([1, 60000]);
    await expect(acquireThroughputPermit('EMAIL', 60)).resolves.toEqual({
      allowed: true,
      retryAtMs: 60000
    });
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining("redis.call('TIME')"),
      1,
      'notification:rate:EMAIL',
      60
    );
  });
});
