import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@tigo/postgres-connector', () => ({ executeQuery: vi.fn() }));

import { executeQuery } from '@tigo/postgres-connector';
import {
  deleteNotificationAfterQueueFailure,
  findNotificationById,
  findNotificationByIdempotencyKey,
  findNotificationsPage,
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

  it('deletes only the row created by the failed request', async () => {
    executeQuery.mockResolvedValue([]);
    await deleteNotificationAfterQueueFailure(10, 'request-1');
    expect(executeQuery.mock.calls[0][0]).toMatch(/DELETE FROM notificacion/);
    expect(executeQuery.mock.calls[0][1]).toEqual([10, 'request-1']);
  });

  it('returns a filtered page with its total count', async () => {
    const items = [
      { id: '10', canal: 'EMAIL', estado: 'FALLIDA' },
      { id: '9', canal: 'EMAIL', estado: 'FALLIDA' }
    ];
    executeQuery
      .mockResolvedValueOnce([{ totalItems: '5' }])
      .mockResolvedValueOnce(items);

    await expect(findNotificationsPage({
      canal: 'EMAIL',
      estado: 'FALLIDA',
      limit: 2,
      offset: '2'
    })).resolves.toEqual({ items, totalItems: 5 });

    const [countQuery, countParams] = executeQuery.mock.calls[0];
    const [pageQuery, pageParams] = executeQuery.mock.calls[1];
    expect(countQuery).toMatch(/COUNT\(\*\) AS "totalItems"/);
    expect(countQuery).toMatch(/\$1::varchar IS NULL OR canal = \$1::varchar/);
    expect(countQuery).toMatch(/\$2::varchar IS NULL OR estado = \$2::varchar/);
    expect(countParams).toEqual(['EMAIL', 'FALLIDA']);
    expect(pageQuery).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(pageQuery).toMatch(/LIMIT \$3::integer/);
    expect(pageQuery).toMatch(/OFFSET \$4::bigint/);
    expect(pageParams).toEqual(['EMAIL', 'FALLIDA', 2, '2']);
  });

  it('uses null parameters when filters are absent', async () => {
    executeQuery
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    await expect(findNotificationsPage({
      limit: 20,
      offset: '0'
    })).resolves.toEqual({ items: [], totalItems: 0 });

    expect(executeQuery.mock.calls[0][1]).toEqual([null, null]);
    expect(executeQuery.mock.calls[1][1]).toEqual([null, null, 20, '0']);
  });
});
