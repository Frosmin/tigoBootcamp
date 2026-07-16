import { describe, it, expect, vi } from 'vitest';

// Mock del connector de Postgres
vi.mock('@tigo/postgres-connector', () => ({
  executeQuery: vi.fn()
}));

import { executeQuery } from '@tigo/postgres-connector';
import { insertExample } from '../../../src/repositories/example.repository.js';

describe('example.repository.js', () => {
  it('insertExample should run INSERT and return the created row', async () => {
    const row = { id: 1, name: 'item' };
    executeQuery.mockResolvedValue([row]);

    const result = await insertExample({ name: 'item' });

    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toMatch(/INSERT INTO example/);
    expect(params[0]).toBe('item');
    expect(result).toEqual(row);
  });
});
