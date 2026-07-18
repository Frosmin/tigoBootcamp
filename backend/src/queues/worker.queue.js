import config from '../utils/config.js';
import { getRedisClient } from '../infrastructure/redis.client.js';

const RELEASE_LOCK_SCRIPT = `
  if redis.call('GET', KEYS[1]) == ARGV[1] then
    return redis.call('DEL', KEYS[1])
  end
  return 0
`;

const PROMOTE_DELAYED_SCRIPT = `
  local jobs = redis.call(
    'ZRANGEBYSCORE', KEYS[1], '-inf', ARGV[1], 'LIMIT', 0, ARGV[2]
  )
  local promoted = 0
  for _, notificationId in ipairs(jobs) do
    if redis.call('ZREM', KEYS[1], notificationId) == 1 then
      redis.call('XADD', KEYS[2], '*', 'notificationId', notificationId)
      promoted = promoted + 1
    end
  end
  return promoted
`;

const RATE_LIMIT_SCRIPT = `
  local redisTime = redis.call('TIME')
  local nowSeconds = tonumber(redisTime[1])
  local bucket = math.floor(nowSeconds / 60)
  local key = KEYS[1] .. ':' .. bucket
  local current = tonumber(redis.call('GET', key) or '0')
  local limit = tonumber(ARGV[1])
  if current >= limit then
    return {0, (bucket + 1) * 60000}
  end
  current = redis.call('INCR', key)
  if current == 1 then
    redis.call('EXPIRE', key, 120)
  end
  return {1, (bucket + 1) * 60000}
`;

const fieldsToObject = (fields) => {
  const result = {};
  for (let index = 0; index < fields.length; index += 2) {
    result[fields[index]] = fields[index + 1];
  }
  return result;
};

const parseEntries = (entries = []) => entries.map(([messageId, fields]) => ({
  messageId,
  ...fieldsToObject(fields)
}));

export const ensureNotificationConsumerGroup = async () => {
  try {
    await getRedisClient().xgroup(
      'CREATE',
      config.NOTIFICATION_STREAM,
      config.NOTIFICATION_CONSUMER_GROUP,
      '0',
      'MKSTREAM'
    );
  } catch (error) {
    if (!error.message.includes('BUSYGROUP')) throw error;
  }
};

export const readNotificationMessages = async (consumerName, count = 1) => {
  const response = await getRedisClient().xreadgroup(
    'GROUP', config.NOTIFICATION_CONSUMER_GROUP, consumerName,
    'COUNT', count,
    'BLOCK', config.WORKER_BLOCK_MS,
    'STREAMS', config.NOTIFICATION_STREAM, '>'
  );
  return parseEntries(response?.[0]?.[1]);
};

export const claimStaleNotificationMessages = async (
  consumerName,
  startId = '0-0',
  count = 10
) => {
  const response = await getRedisClient().xautoclaim(
    config.NOTIFICATION_STREAM,
    config.NOTIFICATION_CONSUMER_GROUP,
    consumerName,
    config.WORKER_CLAIM_IDLE_MS,
    startId,
    'COUNT', count
  );
  return {
    nextId: response?.[0] || '0-0',
    messages: parseEntries(response?.[1])
  };
};

export const acknowledgeNotificationMessage = async (messageId) => {
  return getRedisClient().xack(
    config.NOTIFICATION_STREAM,
    config.NOTIFICATION_CONSUMER_GROUP,
    messageId
  );
};

export const scheduleNotification = async (notificationId, dueAtMs) => {
  return getRedisClient().zadd(
    config.NOTIFICATION_DELAYED_SET,
    dueAtMs,
    String(notificationId)
  );
};

export const promoteDueNotifications = async (nowMs = Date.now(), count = 100) => {
  return getRedisClient().eval(
    PROMOTE_DELAYED_SCRIPT,
    2,
    config.NOTIFICATION_DELAYED_SET,
    config.NOTIFICATION_STREAM,
    nowMs,
    count
  );
};

export const acquireDeliveryLock = async (notificationId, token) => {
  const result = await getRedisClient().set(
    `notification:delivery-lock:${notificationId}`,
    token,
    'PX',
    config.WORKER_LOCK_TTL_MS,
    'NX'
  );
  return result === 'OK';
};

export const releaseDeliveryLock = async (notificationId, token) => {
  return getRedisClient().eval(
    RELEASE_LOCK_SCRIPT,
    1,
    `notification:delivery-lock:${notificationId}`,
    token
  );
};

export const isMarkedDelivered = async (notificationId) => {
  return Boolean(await getRedisClient().get(`notification:delivered:${notificationId}`));
};

export const markDelivered = async (notificationId) => {
  return getRedisClient().set(
    `notification:delivered:${notificationId}`,
    '1',
    'PX',
    config.DELIVERED_MARK_TTL_MS
  );
};

export const acquireThroughputPermit = async (channel, limit) => {
  const [allowed, retryAtMs] = await getRedisClient().eval(
    RATE_LIMIT_SCRIPT,
    1,
    `notification:rate:${channel}`,
    limit
  );
  return { allowed: Number(allowed) === 1, retryAtMs: Number(retryAtMs) };
};
