import { afterAll, beforeAll, describe, expect, it } from 'vitest';

const enabled = process.env.RUN_INTEGRATION === 'true';
const integration = enabled ? describe : describe.skip;

integration('PostgreSQL transactional outbox + Redis + BullMQ', () => {
  let executeQuery;
  let closeAllConnections;
  let closeAllRedisClients;
  let closeNotificationQueues;
  let createDeliveryWorker;
  let createNotificationService;
  let retryNotificationService;
  let createTemplateService;
  let findNotificationById;
  let OutboxPublisher;
  let worker;
  let connector;
  let template;
  const createdNotificationIds = [];

  const waitForState = async (id, expected, timeoutMs = 10000) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const notification = await findNotificationById(id);
      if (notification?.estado === expected) return notification;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Notification ${id} did not reach ${expected}`);
  };

  beforeAll(async () => {
    const postgres = await import('@tigo/postgres-connector');
    closeAllConnections = postgres.closeAllConnections;
    await postgres.initializeDB();
    ({ executeQuery } = await import('../../src/infrastructure/postgres.client.js'));
    ({ closeAllRedisClients } = await import('../../src/infrastructure/redis.client.js'));
    ({ closeNotificationQueues } = await import('../../src/queues/notification.queue.js'));
    ({ createDeliveryWorker } = await import('../../src/workers/delivery.worker.js'));
    ({ createNotificationService, retryNotificationService } = await import('../../src/services/notification.service.js'));
    ({ createTemplateService } = await import('../../src/services/template.service.js'));
    ({ findNotificationById } = await import('../../src/repositories/notification.repository.js'));
    ({ OutboxPublisher } = await import('../../src/services/outbox.publisher.js'));

    template = await createTemplateService({
      nombre: `Integration-${Date.now()}`,
      canal: 'EMAIL',
      contenido: 'Hola {{nombre}}',
      variables: ['nombre']
    });
    ({ worker, connector } = createDeliveryWorker('EMAIL'));
    await worker.waitUntilReady();
  });

  afterAll(async () => {
    await worker?.close();
    await connector?.close();
    await closeNotificationQueues?.();
    await closeAllRedisClients?.();
    if (createdNotificationIds.length) {
      await executeQuery('DELETE FROM notificacion WHERE id=ANY($1::bigint[]);', [createdNotificationIds]);
    }
    if (template?.id) await executeQuery('DELETE FROM plantilla WHERE id=$1::bigint;', [template.id]);
    await closeAllConnections?.();
  });

  it('delivers ENCOLADA -> ENVIADA and persists the provider attempt', async () => {
    const accepted = await createNotificationService({
      canal: 'EMAIL', destinatario: 'integration@example.com',
      plantillaId: template.id, variables: { nombre: 'Ana' }
    }, `integration-flow-${Date.now()}`);
    createdNotificationIds.push(accepted.notification.id);
    expect(accepted).toMatchObject({ created: true, notification: { estado: 'ENCOLADA' } });
    const pending = await executeQuery(
      "SELECT status FROM outbox_event WHERE aggregate_id=$1::bigint AND generation=1;",
      [accepted.notification.id]
    );
    expect(pending).toEqual([{ status: 'PENDING' }]);

    await expect(new OutboxPublisher().publishOnce()).resolves.toBeGreaterThan(0);
    const delivered = await waitForState(accepted.notification.id, 'ENVIADA');
    expect(delivered).toMatchObject({ intentos: 1, providerMessageId: expect.stringContaining('fake-') });
    const attempts = await executeQuery(
      'SELECT resultado, retryable FROM intento WHERE notificacion_id=$1::bigint ORDER BY numero;',
      [accepted.notification.id]
    );
    expect(attempts).toEqual([{ resultado: 'EXITOSO', retryable: false }]);
  });

  it('accepts concurrent duplicate keys once and delivers only one job', async () => {
    const key = `integration-idempotency-${Date.now()}`;
    const request = {
      canal: 'EMAIL', destinatario: 'idempotent@example.com',
      plantillaId: template.id, variables: { nombre: 'Beto' }
    };
    const results = await Promise.all([
      createNotificationService(request, key),
      createNotificationService(request, key),
      createNotificationService(request, key)
    ]);
    const ids = new Set(results.map((result) => result.notification.id));
    expect(ids.size).toBe(1);
    expect(results.filter((result) => result.created)).toHaveLength(1);
    const [id] = ids;
    createdNotificationIds.push(id);

    await new OutboxPublisher().publishOnce();
    await waitForState(id, 'ENVIADA');
    const rows = await executeQuery(
      'SELECT COUNT(*)::integer AS count FROM intento WHERE notificacion_id=$1::bigint;', [id]
    );
    expect(rows[0].count).toBe(1);
  });

  it('fails permanently without wasting automatic retries and supports a new generation', async () => {
    const accepted = await createNotificationService({
      canal: 'EMAIL', destinatario: 'permanent-failure@example.com',
      plantillaId: template.id, variables: { nombre: 'Carla' }
    }, `integration-permanent-${Date.now()}`);
    const id = accepted.notification.id;
    createdNotificationIds.push(id);
    await new OutboxPublisher().publishOnce();
    const failed = await waitForState(id, 'FALLIDA');
    expect(failed.intentos).toBe(1);

    const retried = await retryNotificationService(id);
    expect(retried).toMatchObject({ estado: 'ENCOLADA', generacion: 2, intentos: 1 });
    await new OutboxPublisher().publishOnce();
    const failedAgain = await waitForState(id, 'FALLIDA');
    expect(failedAgain).toMatchObject({ generacion: 2, intentos: 2 });
  });

  it('retries temporary provider failures through BullMQ backoff before failing', async () => {
    const accepted = await createNotificationService({
      canal: 'EMAIL', destinatario: 'temporary-failure@example.com',
      plantillaId: template.id, variables: { nombre: 'Diego' }
    }, `integration-temporary-${Date.now()}`);
    const id = accepted.notification.id;
    createdNotificationIds.push(id);
    await new OutboxPublisher().publishOnce();
    const failed = await waitForState(id, 'FALLIDA', 15000);
    expect(failed.intentos).toBe(3);
    const attempts = await executeQuery(
      'SELECT resultado, retryable FROM intento WHERE notificacion_id=$1::bigint ORDER BY numero;', [id]
    );
    expect(attempts).toEqual([
      { resultado: 'FALLIDO', retryable: true },
      { resultado: 'FALLIDO', retryable: true },
      { resultado: 'FALLIDO', retryable: true }
    ]);
  });
});
