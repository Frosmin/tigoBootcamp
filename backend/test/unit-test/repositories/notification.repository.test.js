import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tigo/postgres-connector', () => ({ executeQuery: vi.fn() }));

import { executeQuery } from '@tigo/postgres-connector';
import {
  deleteNotificationAfterQueueFailure,
  findNotificationById,
  findNotificationForDelivery,
  findNotificationByIdempotencyKey,
  insertNotification
} from '../../../src/repositories/notification.repository.js';

describe('notification.repository.js', () => {
  beforeEach(() => vi.clearAllMocks());

  const input = {
    canal: 'EMAIL',
    destinatario: 'user@example.com',
    plantillaId: 2,
    variables: { nombre: 'Ana' },
    idempotencyKey: 'request-1'
  };

  it('inserts an ENCOLADA notification atomically by idempotency key', async () => {
    const row = { id: 10, ...input, estado: 'ENCOLADA', intentos: 0 };
    executeQuery.mockResolvedValue([row]);

    await expect(insertNotification(input)).resolves.toEqual(row);
    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toMatch(/ON CONFLICT \(idempotency_key\) DO NOTHING/);
    expect(query).toMatch(/plantilla_id AS "plantillaId"/);
    expect(params).toEqual(['EMAIL', 'user@example.com', 2, '{"nombre":"Ana"}', 'request-1']);
  });

  it('returns undefined on an idempotency conflict', async () => {
    executeQuery.mockResolvedValue([]);
    await expect(insertNotification(input)).resolves.toBeUndefined();
  });

  it('finds the existing notification by idempotency key', async () => {
    executeQuery.mockResolvedValue([{ id: 10 }]);
    await expect(findNotificationByIdempotencyKey('request-1')).resolves.toEqual({ id: 10 });
    expect(executeQuery.mock.calls[0][1]).toEqual(['request-1']);
  });

  it('finds a notification by id using a bigint parameter', async () => {
    executeQuery.mockResolvedValue([{ id: '10', estado: 'ENCOLADA' }]);
    await expect(findNotificationById('10')).resolves.toEqual({
      id: '10',
      estado: 'ENCOLADA'
    });
    expect(executeQuery.mock.calls[0][0]).toMatch(/WHERE id = \$1::bigint/);
    expect(executeQuery.mock.calls[0][1]).toEqual(['10']);
  });

  it('loads notification and template data needed by the worker', async () => {
    executeQuery.mockResolvedValue([{ id: '10', templateName: 'confirmacion' }]);
    await expect(findNotificationForDelivery('10')).resolves.toMatchObject({
      templateName: 'confirmacion'
    });
    expect(executeQuery.mock.calls[0][0]).toMatch(/INNER JOIN plantilla/);
    expect(executeQuery.mock.calls[0][0]).toMatch(/next_attempt_at AS "nextAttemptAt"/);
  });

  it('deletes only the row created by the failed request', async () => {
    executeQuery.mockResolvedValue([]);
    await deleteNotificationAfterQueueFailure(10, 'request-1');
    expect(executeQuery.mock.calls[0][0]).toMatch(/DELETE FROM notificacion/);
    expect(executeQuery.mock.calls[0][1]).toEqual([10, 'request-1']);
  });
});
