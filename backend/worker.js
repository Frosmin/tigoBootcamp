import 'dotenv/config';
import { closeAllConnections, initializeDB } from './src/infrastructure/postgres.client.js';
import config, { validateWorkerConfig } from './src/utils/config.js';
import { createDeliveryWorker } from './src/workers/delivery.worker.js';
import { closeAllRedisClients } from './src/infrastructure/redis.client.js';
import { checkPostgres } from './src/infrastructure/postgres.transaction.js';
import {
  closeReadinessServer, startReadinessServer
} from './src/infrastructure/readiness.server.js';

validateWorkerConfig(config.WORKER_CHANNEL);
await initializeDB();
const { worker, connector, connection } = createDeliveryWorker(config.WORKER_CHANNEL);
await worker.waitUntilReady();
await connector.verify();
const readinessServer = await startReadinessServer({
  port: config.WORKER_HEALTH_PORT,
  check: async () => {
    await Promise.all([checkPostgres(), connection.ping(), connector.verify()]);
    return { postgres: 'UP', redis: 'UP', provider: 'UP' };
  }
});

const shutdown = async () => {
  await closeReadinessServer(readinessServer);
  await worker.close();
  await connector.close();
  await closeAllRedisClients();
  await closeAllConnections();
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
