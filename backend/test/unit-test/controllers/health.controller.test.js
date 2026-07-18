import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/infrastructure/postgres.transaction.js', () => ({ checkPostgres: vi.fn() }));

import { checkPostgres } from '../../../src/infrastructure/postgres.transaction.js';
import {
  healthController, readinessController
} from '../../../src/controllers/health.controller.js';

describe('health.controller.js', () => {
  let res;
  beforeEach(() => {
    vi.clearAllMocks();
    res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
  });

  it('reports liveness without dependencies', () => {
    healthController({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'UP' });
  });

  it('reports readiness when PostgreSQL responds', async () => {
    checkPostgres.mockResolvedValue(true);
    await readinessController({}, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: 'READY', postgres: 'UP' });
  });

  it('reports 503 when PostgreSQL is unavailable', async () => {
    checkPostgres.mockRejectedValue(new Error('down'));
    await readinessController({}, res);
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({ status: 'NOT_READY', postgres: 'DOWN' });
  });
});
