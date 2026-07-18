import Redis from 'ioredis';
import config from '../utils/config.js';

const clients = new Set();

const baseOptions = () => ({
  host: config.REDIS_HOST,
  port: config.REDIS_PORT,
  password: config.REDIS_PASSWORD,
  lazyConnect: true,
  retryStrategy: (attempt) => Math.min(attempt * 1000, 20000)
});

export const createProducerRedisClient = () => {
  const client = new Redis({
    ...baseOptions(),
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false
  });
  client.on('error', () => {});
  clients.add(client);
  return client;
};

export const createWorkerRedisClient = () => {
  const client = new Redis({ ...baseOptions(), maxRetriesPerRequest: null });
  client.on('error', () => {});
  clients.add(client);
  return client;
};

let legacyClient;
export const initializeRedisClient = async () => {
  if (legacyClient) return legacyClient;
  const client = createProducerRedisClient();
  try {
    await client.connect();
    await client.ping();
    legacyClient = client;
    return legacyClient;
  } catch (error) {
    clients.delete(client);
    client.disconnect();
    throw error;
  }
};
export const getRedisClient = () => {
  if (!legacyClient) throw new Error('Redis client is not initialized');
  return legacyClient;
};
export const closeRedisClient = async () => {
  if (!legacyClient) return;
  const client = legacyClient;
  legacyClient = undefined;
  clients.delete(client);
  await client.quit();
};

export const closeAllRedisClients = async () => {
  const pending = [...clients].map(async (client) => {
    try { await client.quit(); } catch { client.disconnect(); }
  });
  clients.clear();
  legacyClient = undefined;
  await Promise.allSettled(pending);
};
