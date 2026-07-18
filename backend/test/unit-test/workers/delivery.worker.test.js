import { describe, expect, it, vi } from 'vitest';
import {
  defaultConsumerName,
  runDeliveryWorker
} from '../../../src/workers/delivery.worker.js';

const createDependencies = (overrides = {}) => ({
  ensureNotificationConsumerGroup: vi.fn().mockResolvedValue(undefined),
  claimStaleNotificationMessages: vi.fn().mockResolvedValue({
    nextId: '0-0',
    messages: []
  }),
  readNotificationMessages: vi.fn().mockResolvedValue([]),
  acknowledgeNotificationMessage: vi.fn().mockResolvedValue(1),
  promoteDueNotifications: vi.fn().mockResolvedValue(0),
  ...overrides
});

describe('delivery worker', () => {
  it('builds a stable non-empty default consumer name', () => {
    expect(defaultConsumerName()).toMatch(/.+/);
  });

  it('processes and acknowledges a new message after persistence succeeds', async () => {
    const signal = { stopped: false };
    const processNotification = vi.fn().mockImplementation(async () => {
      signal.stopped = true;
    });
    const dependencies = createDependencies({
      readNotificationMessages: vi.fn().mockResolvedValue([
        { messageId: '1-0', notificationId: '42' }
      ])
    });

    await runDeliveryWorker({
      processNotification,
      consumerName: 'worker-test',
      signal,
      dependencies
    });

    expect(dependencies.ensureNotificationConsumerGroup).toHaveBeenCalledOnce();
    expect(processNotification).toHaveBeenCalledWith('42');
    expect(dependencies.acknowledgeNotificationMessage).toHaveBeenCalledWith('1-0');
  });

  it('claims and processes pending messages before reading new ones', async () => {
    const signal = { stopped: false };
    const processNotification = vi.fn().mockImplementation(async () => {
      signal.stopped = true;
    });
    const dependencies = createDependencies({
      claimStaleNotificationMessages: vi.fn().mockResolvedValue({
        nextId: '9-0',
        messages: [{ messageId: '2-0', notificationId: '51' }]
      })
    });

    await runDeliveryWorker({
      processNotification,
      signal,
      dependencies
    });

    expect(processNotification).toHaveBeenCalledWith('51');
    expect(dependencies.readNotificationMessages).not.toHaveBeenCalled();
    expect(dependencies.acknowledgeNotificationMessage).toHaveBeenCalledWith('2-0');
  });

  it('does not acknowledge when processing fails, leaving the message pending', async () => {
    const signal = { stopped: false };
    const processNotification = vi.fn().mockImplementation(async () => {
      signal.stopped = true;
      throw new Error('database unavailable');
    });
    const dependencies = createDependencies({
      readNotificationMessages: vi.fn().mockResolvedValue([
        { messageId: '3-0', notificationId: '73' }
      ])
    });

    await runDeliveryWorker({ processNotification, signal, dependencies });

    expect(dependencies.acknowledgeNotificationMessage).not.toHaveBeenCalled();
  });

  it('acknowledges malformed messages so they cannot poison the group', async () => {
    const signal = { stopped: false };
    const dependencies = createDependencies({
      readNotificationMessages: vi.fn().mockImplementation(async () => {
        return [{ messageId: '4-0' }];
      }),
      acknowledgeNotificationMessage: vi.fn().mockImplementation(async () => {
        signal.stopped = true;
        return 1;
      })
    });

    await runDeliveryWorker({
      processNotification: vi.fn(),
      signal,
      dependencies
    });

    expect(dependencies.acknowledgeNotificationMessage).toHaveBeenCalledWith('4-0');
  });

  it('does not start another message after shutdown is requested', async () => {
    const signal = { stopped: false };
    const processNotification = vi.fn().mockImplementation(async () => {
      signal.stopped = true;
    });
    const dependencies = createDependencies({
      readNotificationMessages: vi.fn().mockResolvedValue([
        { messageId: '5-0', notificationId: '80' },
        { messageId: '6-0', notificationId: '81' }
      ])
    });

    await runDeliveryWorker({ processNotification, signal, dependencies });

    expect(processNotification).toHaveBeenCalledTimes(1);
    expect(dependencies.acknowledgeNotificationMessage).toHaveBeenCalledTimes(1);
  });
});
