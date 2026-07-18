import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import {
  closeAllConnections,
  getDB,
  initializeDB
} from '@tigo/postgres-connector';
import {
  closeRedisConnection,
  createQueueRedisConnection,
  createWorkerRedisConnection
} from '../../src/infrastructure/redis.client.js';
import { createNotificationQueue } from '../../src/queues/notification.queue.js';
import { insertNotification } from '../../src/repositories/notification.repository.js';
import { publishOutboxBatch } from '../../src/services/outbox.publisher.js';
import { createNotificationProcessor } from '../../src/workers/notification.processor.js';
import { createNotificationWorker } from '../../src/workers/notification.worker.js';

const waitFor = async (assertion, timeoutMs = 5000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await assertion();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }
  throw lastError;
};

describe('notification delivery smoke', () => {
  let queueConnection;
  let workerConnection;
  let queue;
  let worker;
  let templateId;
  let notificationId;

  beforeAll(async () => {
    await initializeDB();
    queueConnection = createQueueRedisConnection();
    workerConnection = createWorkerRedisConnection();
    queue = createNotificationQueue(queueConnection);
  });

  afterAll(async () => {
    if (worker) await worker.close();
    if (queue) await queue.close();
    await Promise.all([
      closeRedisConnection(queueConnection),
      closeRedisConnection(workerConnection)
    ]);
    const client = await getDB().getConnection();
    try {
      if (notificationId) {
        await client.query('DELETE FROM notificacion WHERE id = $1::bigint;', [notificationId]);
      }
      if (templateId) {
        await client.query('DELETE FROM plantilla WHERE id = $1::bigint;', [templateId]);
      }
    } finally {
      client.release();
      await closeAllConnections();
    }
  });

  it('moves a real PostgreSQL outbox event through real Redis to ENVIADA', async () => {
    const emailSender = vi.fn().mockResolvedValue({ messageId: 'smoke-provider-id' });
    const processor = createNotificationProcessor({
      emailSender,
      smsSender: vi.fn(),
      maxAttempts: 5
    });
    worker = createNotificationWorker({
      connection: workerConnection,
      processor,
      logger: { error: vi.fn() }
    });

    const client = await getDB().getConnection();
    try {
      const template = await client.query(`
        INSERT INTO plantilla (nombre, canal, contenido, variables)
        VALUES ($1, 'EMAIL', 'Hola {{nombre}}', ARRAY['nombre'])
        RETURNING id;
      `, [`smoke-${randomUUID()}`]);
      templateId = template.rows[0].id;
    } finally {
      client.release();
    }

    const notification = await insertNotification({
      canal: 'EMAIL',
      destinatario: 'smoke@example.com',
      plantillaId: templateId,
      variables: { nombre: 'Bootcamp' },
      idempotencyKey: randomUUID()
    });
    notificationId = notification.id;

    await expect(publishOutboxBatch(queue, { warn: vi.fn(), error: vi.fn() }))
      .resolves.toBeGreaterThanOrEqual(1);

    await waitFor(async () => {
      const stateClient = await getDB().getConnection();
      try {
        const result = await stateClient.query(`
          SELECT estado, intentos,
            (SELECT COUNT(*)::integer FROM intento WHERE notificacion_id = $1) AS attempts
          FROM notificacion WHERE id = $1;
        `, [notificationId]);
        expect(result.rows[0]).toMatchObject({
          estado: 'ENVIADA', intentos: 1, attempts: 1
        });
      } finally {
        stateClient.release();
      }
    });
    expect(emailSender).toHaveBeenCalledOnce();
  });
});
