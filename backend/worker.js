import 'dotenv/config';
import { initializeDB, closeAllConnections } from '@tigo/postgres-connector';
import { logger } from '@tigo/logger';
import {
  closeRedisClient,
  initializeRedisClient
} from './src/infrastructure/redis.client.js';
import { createEmailConnector } from './src/delivery/email.connector.js';
import { SmsConnector } from './src/delivery/sms.connector.js';
import { createDeliveryProcessor } from './src/workers/delivery.processor.js';
import { runDeliveryWorker } from './src/workers/delivery.worker.js';

const signal = { stopped: false };
const stop = () => {
  signal.stopped = true;
};
process.once('SIGINT', stop);
process.once('SIGTERM', stop);

try {
  await initializeDB();
  await initializeRedisClient();
  const emailConnector = await createEmailConnector();
  const processNotification = createDeliveryProcessor({
    emailConnector,
    smsConnector: new SmsConnector()
  });
  logger.info({ '[WORKER]': 'Notification delivery worker started' });
  await runDeliveryWorker({ processNotification, signal });
} catch (error) {
  logger.error({ '[WORKER FATAL ERROR]': error.message });
  process.exitCode = 1;
} finally {
  await Promise.allSettled([closeRedisClient(), closeAllConnections()]);
  logger.info({ '[WORKER]': 'Notification delivery worker stopped' });
}
