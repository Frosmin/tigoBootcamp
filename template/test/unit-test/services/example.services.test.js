import { describe, it, expect, vi } from 'vitest';

// Mock del repositorio
vi.mock('../../../src/repositories/example.repository.js', () => ({
  insertExample: vi.fn(),
  selectExampleById: vi.fn()
}));

import { insertExample } from '../../../src/repositories/example.repository.js';
import { createExampleService } from '../../../src/services/example.services.js';

describe('example.services.js', () => {
  it('createExampleService should delegate to insertExample and return the row', async () => {
    const created = { id: 1, name: 'item' };
    insertExample.mockResolvedValue(created);

    const result = await createExampleService({ name: 'item' });

    expect(insertExample).toHaveBeenCalledWith({ name: 'item' });
    expect(result).toEqual(created);
  });
});
