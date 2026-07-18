import 'dotenv/config';
import { closeAllConnections, initializeDB } from './src/infrastructure/postgres.client.js';
import { OutboxPublisher } from './src/services/outbox.publisher.js';
import { closeNotificationQueues, initializeQueueEvents } from './src/queues/notification.queue.js';
import { closeAllRedisClients } from './src/infrastructure/redis.client.js';

await initializeDB();
initializeQueueEvents('EMAIL');
const publisher = new OutboxPublisher();
const running = publisher.run();

const shutdown = async () => {
  publisher.stop();
  await running;
  await closeNotificationQueues();
  await closeAllRedisClients();
  await closeAllConnections();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
