import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createServer, server } = vi.hoisted(() => {
  const server = {
    once: vi.fn(),
    listen: vi.fn(function listen(_port, _host, callback) { callback(); }),
    close: vi.fn((callback) => callback())
  };
  return { createServer: vi.fn(), server };
});

vi.mock('node:http', () => ({ createServer }));

import {
  closeReadinessServer, startReadinessServer
} from '../../../src/infrastructure/readiness.server.js';

describe('readiness.server.js', () => {
  let handler;
  let res;

  beforeEach(() => {
    vi.clearAllMocks();
    createServer.mockImplementation((callback) => { handler = callback; return server; });
    res = { writeHead: vi.fn(), end: vi.fn() };
  });

  it('serves dependency readiness and closes cleanly', async () => {
    const check = vi.fn().mockResolvedValue({ postgres: 'UP', redis: 'UP' });
    await expect(startReadinessServer({ port: 3051, check })).resolves.toBe(server);
    await handler({ url: '/ready' }, res);
    expect(res.writeHead).toHaveBeenCalledWith(200, expect.any(Object));
    expect(JSON.parse(res.end.mock.calls[0][0])).toEqual({
      status: 'READY', postgres: 'UP', redis: 'UP'
    });
    await expect(closeReadinessServer(server)).resolves.toBeUndefined();
  });

  it('returns 503 when a dependency is unavailable', async () => {
    await startReadinessServer({ port: 3051, check: vi.fn().mockRejectedValue(new Error('down')) });
    await handler({ url: '/ready' }, res);
    expect(res.writeHead).toHaveBeenCalledWith(503, expect.any(Object));
  });

  it('returns 404 without running checks for other paths', async () => {
    const check = vi.fn();
    await startReadinessServer({ port: 3051, check });
    await handler({ url: '/health' }, res);
    expect(res.writeHead).toHaveBeenCalledWith(404, expect.any(Object));
    expect(check).not.toHaveBeenCalled();
  });

  it('propagates close errors', async () => {
    server.close.mockImplementationOnce((callback) => callback(new Error('close failed')));
    await expect(closeReadinessServer(server)).rejects.toThrow('close failed');
  });
});
