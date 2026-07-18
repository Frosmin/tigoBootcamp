import os from 'node:os';
import { logger } from '@tigo/logger';
import config from '../utils/config.js';
import {
  acknowledgeNotificationMessage,
  claimStaleNotificationMessages,
  ensureNotificationConsumerGroup,
  promoteDueNotifications,
  readNotificationMessages
} from '../queues/worker.queue.js';

export const defaultConsumerName = () => (
  config.NOTIFICATION_CONSUMER_NAME || `${os.hostname()}-${process.pid}`
);

export const runDeliveryWorker = async ({
  processNotification,
  consumerName = defaultConsumerName(),
  signal = { stopped: false },
  dependencies = {}
}) => {
  const deps = {
    acknowledgeNotificationMessage,
    claimStaleNotificationMessages,
    ensureNotificationConsumerGroup,
    promoteDueNotifications,
    readNotificationMessages,
    ...dependencies
  };
  await deps.ensureNotificationConsumerGroup();

  const promote = async () => {
    try {
      await deps.promoteDueNotifications();
    } catch (error) {
      logger.error({ '[DELAYED PROMOTION ERROR]': error.message });
    }
  };
  const promotionTimer = setInterval(promote, config.DELAYED_PROMOTION_INTERVAL_MS);
  promotionTimer.unref?.();

  let claimCursor = '0-0';
  try {
    while (!signal.stopped) {
      const claimed = await deps.claimStaleNotificationMessages(
        consumerName,
        claimCursor
      );
      claimCursor = claimed.nextId;
      const messages = claimed.messages.length > 0
        ? claimed.messages
        : await deps.readNotificationMessages(consumerName);

      for (const message of messages) {
        if (signal.stopped) break;
        try {
          if (!message.notificationId) {
            logger.error({ '[INVALID STREAM MESSAGE]': message.messageId });
          } else {
            const result = await processNotification(message.notificationId);
            logger.info({
              '[WORKER MESSAGE]': message.messageId,
              '[NOTIFICATION ID]': message.notificationId,
              '[OUTCOME]': result?.outcome || 'COMPLETED'
            });
          }
          await deps.acknowledgeNotificationMessage(message.messageId);
        } catch (error) {
          logger.error({
            '[WORKER PROCESSING ERROR]': error.message,
            '[MESSAGE ID]': message.messageId,
            '[NOTIFICATION ID]': message.notificationId
          });
        }
      }
    }
  } finally {
    clearInterval(promotionTimer);
  }
};
