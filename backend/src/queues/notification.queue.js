import config from '../utils/config.js';
import { getRedisClient } from '../infrastructure/redis.client.js';

export const enqueueNotification = async (notificationId) => {
  return getRedisClient().xadd(
    config.NOTIFICATION_STREAM,
    '*',
    'notificationId',
    String(notificationId)
  );
};
