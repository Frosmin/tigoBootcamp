import Redis from 'ioredis';
import config from '../utils/config.js';

let redisClient;

export const initializeRedisClient = async () => {
  if (redisClient) return redisClient;

  const client = new Redis({
    host: config.REDIS_HOST,
    port: config.REDIS_PORT,
    password: config.REDIS_PASSWORD,
    lazyConnect: true,
    maxRetriesPerRequest: 1
  });

  try {
    await client.connect();
    await client.ping();
    redisClient = client;
    return redisClient;
  } catch (error) {
    client.disconnect();
    throw error;
  }
};

export const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client is not initialized');
  }
  return redisClient;
};

export const closeRedisClient = async () => {
  if (!redisClient) return;
  const client = redisClient;
  redisClient = undefined;
  await client.quit();
};
