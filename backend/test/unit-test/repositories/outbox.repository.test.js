import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/infrastructure/postgres.client.js', () => ({ executeQuery: vi.fn() }));

import { executeQuery } from '../../../src/infrastructure/postgres.client.js';
import {
  claimOutboxBatch, markOutboxPublished, releaseOutboxEvents
} from '../../../src/repositories/outbox.repository.js';

describe('outbox.repository.js', () => {
  beforeEach(() => vi.clearAllMocks());

  it('claims a leased SKIP LOCKED batch', async () => {
    executeQuery.mockResolvedValue([{ id: '1' }]);
    await expect(claimOutboxBatch(100, 30000)).resolves.toEqual([{ id: '1' }]);
    expect(executeQuery.mock.calls[0][0]).toMatch(/FOR UPDATE SKIP LOCKED/);
    expect(executeQuery.mock.calls[0][1]).toEqual([100, 30000]);
  });

  it('marks a non-empty batch as published and ignores an empty batch', async () => {
    await markOutboxPublished([]);
    expect(executeQuery).not.toHaveBeenCalled();
    await markOutboxPublished(['1', '2']);
    expect(executeQuery.mock.calls[0][0]).toMatch(/status='PUBLISHED'/);
    expect(executeQuery.mock.calls[0][1]).toEqual([['1', '2']]);
  });

  it('releases failures with a bounded error message and ignores an empty batch', async () => {
    await releaseOutboxEvents([], new Error('ignored'));
    expect(executeQuery).not.toHaveBeenCalled();
    const message = 'x'.repeat(2100);
    await releaseOutboxEvents(['3'], message);
    expect(executeQuery.mock.calls[0][0]).toMatch(/available_at/);
    expect(executeQuery.mock.calls[0][1][1]).toHaveLength(2000);
  });
});
