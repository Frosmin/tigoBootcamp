import { beforeEach, describe, expect, it, vi } from 'vitest';

const connect = vi.fn();
const ping = vi.fn();
const disconnect = vi.fn();
const quit = vi.fn();
const Redis = vi.fn(function RedisMock() {
  return { connect, ping, disconnect, quit };
});

vi.mock('ioredis', () => ({ default: Redis }));
vi.mock('../../../src/utils/config.js', () => ({
  default: { REDIS_HOST: 'localhost', REDIS_PORT: 6379, REDIS_PASSWORD: 'secret' }
}));

describe('redis.client.js', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    connect.mockResolvedValue(undefined);
    ping.mockResolvedValue('PONG');
    quit.mockResolvedValue('OK');
  });

  it('connects, pings and exposes one client', async () => {
    const module = await import('../../../src/infrastructure/redis.client.js');
    const client = await module.initializeRedisClient();
    expect(Redis).toHaveBeenCalledWith(expect.objectContaining({ lazyConnect: true }));
    expect(connect).toHaveBeenCalledOnce();
    expect(ping).toHaveBeenCalledOnce();
    expect(module.getRedisClient()).toBe(client);
    await expect(module.initializeRedisClient()).resolves.toBe(client);
  });

  it('disconnects and propagates an initialization failure', async () => {
    ping.mockRejectedValue(new Error('down'));
    const module = await import('../../../src/infrastructure/redis.client.js');
    await expect(module.initializeRedisClient()).rejects.toThrow('down');
    expect(disconnect).toHaveBeenCalledOnce();
  });

  it('fails before initialization and can close an initialized client', async () => {
    const module = await import('../../../src/infrastructure/redis.client.js');
    expect(() => module.getRedisClient()).toThrow('Redis client is not initialized');
    await module.closeRedisClient();
    await module.initializeRedisClient();
    await module.closeRedisClient();
    expect(quit).toHaveBeenCalledOnce();
    expect(() => module.getRedisClient()).toThrow('Redis client is not initialized');
  });
});
