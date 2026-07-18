import { beforeEach, describe, expect, it, vi } from 'vitest';

const connect = vi.fn();
const ping = vi.fn();
const disconnect = vi.fn();
const quit = vi.fn();
const on = vi.fn();
const Redis = vi.fn(function RedisMock() { return { connect, ping, disconnect, quit, on }; });

vi.mock('ioredis', () => ({ default: Redis }));
vi.mock('../../../src/utils/config.js', () => ({
  default: { REDIS_HOST: 'localhost', REDIS_PORT: 6379, REDIS_PASSWORD: 'secret' }
}));

describe('redis.client.js', () => {
  beforeEach(() => {
    vi.resetModules(); vi.clearAllMocks();
    connect.mockResolvedValue(); ping.mockResolvedValue('PONG'); quit.mockResolvedValue('OK');
  });

  it('connects, pings and exposes one producer client', async () => {
    const module = await import('../../../src/infrastructure/redis.client.js');
    const client = await module.initializeRedisClient();
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ maxRetriesPerRequest: 1, enableOfflineQueue: false }));
    expect(module.getRedisClient()).toBe(client);
    await expect(module.initializeRedisClient()).resolves.toBe(client);
  });

  it('uses persistent retry semantics for worker clients', async () => {
    const module = await import('../../../src/infrastructure/redis.client.js');
    module.createWorkerRedisClient();
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ maxRetriesPerRequest: null }));
  });

  it('disconnects and propagates initialization failure', async () => {
    ping.mockRejectedValue(new Error('down'));
    const module = await import('../../../src/infrastructure/redis.client.js');
    await expect(module.initializeRedisClient()).rejects.toThrow('down');
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('closes initialized clients', async () => {
    const module = await import('../../../src/infrastructure/redis.client.js');
    expect(() => module.getRedisClient()).toThrow();
    await module.initializeRedisClient();
    await module.closeRedisClient();
    expect(quit).toHaveBeenCalledOnce();
  });
});
