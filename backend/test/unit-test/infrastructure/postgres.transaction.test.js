import { beforeEach, describe, expect, it, vi } from 'vitest';

const { query, release, getConnection, executeQuery } = vi.hoisted(() => {
  const queryMock = vi.fn();
  const releaseMock = vi.fn();
  return {
    query: queryMock,
    release: releaseMock,
    getConnection: vi.fn(() => ({ query: queryMock, release: releaseMock })),
    executeQuery: vi.fn()
  };
});

vi.mock('@tigo/postgres-connector', () => ({ getDB: vi.fn(() => ({ getConnection })) }));
vi.mock('../../../src/infrastructure/postgres.client.js', () => ({ executeQuery }));

import {
  checkPostgres, withTransaction
} from '../../../src/infrastructure/postgres.transaction.js';

describe('postgres.transaction.js', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    query.mockResolvedValue({ rows: [] });
  });

  it('commits and exposes parameterized execution', async () => {
    query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rows: [] });
    await expect(withTransaction((tx) => tx.execute('SELECT $1', [1])))
      .resolves.toEqual([{ id: 1 }]);
    expect(query.mock.calls.map(([sql]) => sql)).toEqual(['BEGIN', 'SELECT $1', 'COMMIT']);
    expect(release).toHaveBeenCalledOnce();
  });

  it('rolls back and releases on failure', async () => {
    query.mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('broken'))
      .mockResolvedValueOnce({ rows: [] });
    await expect(withTransaction((tx) => tx.execute('BROKEN'))).rejects.toThrow('broken');
    expect(query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(release).toHaveBeenCalledOnce();
  });

  it('checks PostgreSQL readiness', async () => {
    executeQuery.mockResolvedValue([{ healthy: 1 }]);
    await expect(checkPostgres()).resolves.toBe(true);
    expect(executeQuery).toHaveBeenCalledWith('SELECT 1 AS healthy;');
  });
});
