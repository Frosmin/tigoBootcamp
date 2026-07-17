import { describe, expect, it, vi } from 'vitest';

const xadd = vi.fn();
vi.mock('../../../src/infrastructure/redis.client.js', () => ({
  getRedisClient: () => ({ xadd })
}));
vi.mock('../../../src/utils/config.js', () => ({
  default: { NOTIFICATION_STREAM: 'notifications:dispatch' }
}));

import { enqueueNotification } from '../../../src/queues/notification.queue.js';

describe('notification.queue.js', () => {
  it('publishes only the notification id to the configured stream', async () => {
    xadd.mockResolvedValue('1-0');
    await expect(enqueueNotification(42)).resolves.toBe('1-0');
    expect(xadd).toHaveBeenCalledWith(
      'notifications:dispatch', '*', 'notificationId', '42'
    );
  });
});
