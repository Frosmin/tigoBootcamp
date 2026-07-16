import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/utils/config.js', () => ({
  default: { APP_PASSWORD: 'test-password' }
}));

import config from '../../../src/utils/config.js';
import { authenticateBearer } from '../../../src/middleware/auth.middleware.js';

const createResponse = () => ({
  status: vi.fn().mockReturnThis(),
  json: vi.fn()
});

describe('auth.middleware.js', () => {
  beforeEach(() => {
    config.APP_PASSWORD = 'test-password';
  });

  it('calls next for the configured bearer token', () => {
    const req = { headers: { authorization: 'Bearer test-password' } };
    const res = createResponse();
    const next = vi.fn();

    authenticateBearer(req, res, next);

    expect(next).toHaveBeenCalledOnce();
    expect(res.status).not.toHaveBeenCalled();
  });

  it.each([
    [{}, 'AU003'],
    [{ authorization: 'Basic abc' }, 'AU003'],
    [{ authorization: 'Bearer wrong-password' }, 'AU001']
  ])('rejects invalid authorization headers', (headers, code) => {
    const req = { headers };
    const res = createResponse();
    const next = vi.fn();

    authenticateBearer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      error: { code, message: code === 'AU003' ? 'Missing token' : 'Invalid token' }
    });
  });

  it('returns 500 when APP_PASSWORD is not configured', () => {
    config.APP_PASSWORD = undefined;
    const req = { headers: { authorization: 'Bearer any-token' } };
    const res = createResponse();
    const next = vi.fn();

    authenticateBearer(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
