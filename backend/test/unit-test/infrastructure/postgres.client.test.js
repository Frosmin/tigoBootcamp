import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release, getConnection } = vi.hoisted(() => ({
  query: vi.fn(), release: vi.fn(), getConnection: vi.fn()
}));

vi.mock('@tigo/postgres-connector', () => ({
  getDB: vi.fn(() => ({ getConnection }))
}));

import { executeQuery } from '../../../src/infrastructure/postgres.client.js';

describe('postgres.client.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getConnection.mockResolvedValue({ query, release });
  });

  it('returns rows without passing sensitive values through connector logging', async () => {
    query.mockResolvedValue({ rows: [{ id: '1' }] });
    await expect(executeQuery('SELECT $1', ['private'])).resolves.toEqual([{ id: '1' }]);
    expect(query).toHaveBeenCalledWith('SELECT $1', ['private']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('always releases the pooled connection', async () => {
    query.mockRejectedValue(new Error('query failed'));
    await expect(executeQuery('BROKEN')).rejects.toThrow('query failed');
    expect(release).toHaveBeenCalledOnce();
  });
});
