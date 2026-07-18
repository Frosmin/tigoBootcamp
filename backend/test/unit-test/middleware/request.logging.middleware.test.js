import { describe, expect, it, vi } from 'vitest';

const { logger } = vi.hoisted(() => ({ logger: { info: vi.fn() } }));
vi.mock('@tigo/logger', () => ({ logger }));
vi.mock('node:crypto', () => ({ randomUUID: vi.fn(() => 'generated-trace') }));

import { safeHttpLoggerMiddleware } from '../../../src/middleware/request.logging.middleware.js';

describe('request.logging.middleware.js', () => {
  it('logs only method, path and trace id', () => {
    const req = {
      method: 'POST', originalUrl: '/api/v1/notifications?secret=1',
      headers: { 'x-traceid': 'trace-1', authorization: 'Bearer secret' },
      body: { destinatario: 'private@example.com', variables: { nombre: 'Ana' } }
    };
    const next = vi.fn();
    safeHttpLoggerMiddleware()(req, {}, next);
    expect(logger.info).toHaveBeenCalledWith({
      '[HTTP METHOD]': 'POST', '[HTTP PATH]': '/api/v1/notifications', '[TRACE ID]': 'trace-1'
    });
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('private@example.com');
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain('Bearer secret');
    expect(next).toHaveBeenCalledOnce();
  });

  it('generates a trace id when the header is absent', () => {
    const req = { method: 'GET', originalUrl: '/ready', headers: {} };
    safeHttpLoggerMiddleware()(req, {}, vi.fn());
    expect(req.traceId).toBe('generated-trace');
  });
});
