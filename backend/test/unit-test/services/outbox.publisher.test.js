import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  claimOutboxBatch, markOutboxPublished, releaseOutboxEvents,
  publishOutboxEvents, logger
} = vi.hoisted(() => ({
  claimOutboxBatch: vi.fn(), markOutboxPublished: vi.fn(), releaseOutboxEvents: vi.fn(),
  publishOutboxEvents: vi.fn(), logger: { error: vi.fn() }
}));

vi.mock('@tigo/logger', () => ({ logger }));
vi.mock('../../../src/utils/config.js', () => ({ default: {
  OUTBOX_BATCH_SIZE: 100, OUTBOX_LEASE_MS: 30000, OUTBOX_POLL_INTERVAL_MS: 1
} }));
vi.mock('../../../src/repositories/outbox.repository.js', () => ({
  claimOutboxBatch, markOutboxPublished, releaseOutboxEvents
}));
vi.mock('../../../src/queues/notification.queue.js', () => ({ publishOutboxEvents }));

import { OutboxPublisher } from '../../../src/services/outbox.publisher.js';

describe('outbox.publisher.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markOutboxPublished.mockResolvedValue();
    releaseOutboxEvents.mockResolvedValue();
    publishOutboxEvents.mockResolvedValue([]);
  });

  it('returns zero without touching BullMQ when no events are pending', async () => {
    claimOutboxBatch.mockResolvedValue([]);
    await expect(new OutboxPublisher().publishOnce()).resolves.toBe(0);
    expect(publishOutboxEvents).not.toHaveBeenCalled();
  });

  it('publishes and acknowledges each channel independently', async () => {
    const events = [
      { id: '1', channel: 'EMAIL' },
      { id: '2', channel: 'EMAIL' },
      { id: '3', channel: 'SMS' }
    ];
    claimOutboxBatch.mockResolvedValue(events);
    await expect(new OutboxPublisher().publishOnce()).resolves.toBe(3);
    expect(publishOutboxEvents).toHaveBeenCalledTimes(2);
    expect(markOutboxPublished).toHaveBeenCalledWith(['1', '2']);
    expect(markOutboxPublished).toHaveBeenCalledWith(['3']);
  });

  it('releases only the failed channel lease for recovery', async () => {
    claimOutboxBatch.mockResolvedValue([{ id: '1', channel: 'EMAIL' }]);
    publishOutboxEvents.mockRejectedValue(new Error('redis down'));
    await expect(new OutboxPublisher().publishOnce()).resolves.toBe(1);
    expect(releaseOutboxEvents).toHaveBeenCalledWith(['1'], 'redis down');
    expect(logger.error).toHaveBeenCalled();
  });

  it('runs until stopped after an idle poll', async () => {
    const publisher = new OutboxPublisher();
    claimOutboxBatch.mockImplementation(async () => {
      publisher.stop();
      return [];
    });
    await expect(publisher.run()).resolves.toBeUndefined();
    expect(claimOutboxBatch).toHaveBeenCalledOnce();
  });

  it('survives a repository failure and can stop cleanly', async () => {
    const publisher = new OutboxPublisher();
    claimOutboxBatch.mockImplementation(async () => {
      publisher.stop();
      throw new Error('postgres down');
    });
    await expect(publisher.run()).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith({ '[OUTBOX LOOP ERROR]': 'postgres down' });
  });
});
