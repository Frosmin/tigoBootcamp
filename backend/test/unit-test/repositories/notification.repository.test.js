import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/infrastructure/postgres.client.js', () => ({ executeQuery: vi.fn() }));
vi.mock('../../../src/infrastructure/postgres.transaction.js', () => ({ withTransaction: vi.fn() }));

import { executeQuery } from '../../../src/infrastructure/postgres.client.js';
import { withTransaction } from '../../../src/infrastructure/postgres.transaction.js';
import {
  findNotificationById, findNotificationByIdempotencyKey, insertNotification,
  listNotifications, scheduleNotificationRetry,
  claimNotificationForDelivery, recordDeliveryResult
} from '../../../src/repositories/notification.repository.js';

describe('notification.repository.js', () => {
  const tx = { execute: vi.fn() };
  const input = {
    canal: 'EMAIL', destinatario: 'user@example.com', plantillaId: 2,
    variables: { nombre: 'Ana' }, idempotencyKey: 'request-1', asunto: 'Hola',
    contenidoRenderizado: 'Hola Ana', attemptsAllowed: 3
  };

  beforeEach(() => {
    vi.clearAllMocks();
    withTransaction.mockImplementation((work) => work(tx));
  });

  it('inserts notification and outbox in one transaction', async () => {
    const row = { id: '10', canal: 'EMAIL', generacion: 1, estado: 'ENCOLADA' };
    tx.execute.mockResolvedValueOnce([row]).mockResolvedValueOnce([]);
    await expect(insertNotification(input)).resolves.toEqual(row);
    expect(tx.execute).toHaveBeenCalledTimes(2);
    expect(tx.execute.mock.calls[0][0]).toMatch(/ON CONFLICT \(idempotency_key\) DO NOTHING/);
    expect(tx.execute.mock.calls[1][0]).toMatch(/INSERT INTO outbox_event/);
    expect(tx.execute.mock.calls[1][1][3]).toContain('"attemptsAllowed":3');
  });

  it('does not create outbox on idempotency conflict', async () => {
    tx.execute.mockResolvedValueOnce([]);
    await expect(insertNotification(input)).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledOnce();
  });

  it('finds by idempotency key', async () => {
    executeQuery.mockResolvedValue([{ id: '10' }]);
    await expect(findNotificationByIdempotencyKey('request-1')).resolves.toEqual({ id: '10' });
    expect(executeQuery.mock.calls[0][1]).toEqual(['request-1']);
  });

  it('finds by bigint id', async () => {
    executeQuery.mockResolvedValue([{ id: '10' }]);
    await expect(findNotificationById('10')).resolves.toEqual({ id: '10' });
    expect(executeQuery.mock.calls[0][0]).toMatch(/WHERE id=\$1::bigint/);
  });

  it('builds a parameterized keyset listing', async () => {
    executeQuery.mockResolvedValue([]);
    await listNotifications({
      canal: 'EMAIL', estado: 'FALLIDA', limit: 10,
      cursor: { createdAt: '2026-07-18T00:00:00.000Z', id: '99' }
    });
    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toMatch(/\(created_at, id\) </);
    expect(params).toEqual(['EMAIL', 'FALLIDA', '2026-07-18T00:00:00.000Z', '99', 11]);
  });

  it('schedules retry and outbox atomically', async () => {
    tx.execute
      .mockResolvedValueOnce([{ id: '10', canal: 'EMAIL', estado: 'FALLIDA', intentos: 3 }])
      .mockResolvedValueOnce([{ id: '10', canal: 'EMAIL', estado: 'ENCOLADA', intentos: 3, generacion: 2 }])
      .mockResolvedValueOnce([]);
    const result = await scheduleNotificationRetry('10', 5, 3);
    expect(result.notification.generacion).toBe(2);
    expect(tx.execute.mock.calls[2][1][3]).toContain('"attemptsAllowed":2');
  });

  it.each([
    [[], 'NOT_FOUND'],
    [[{ id: '10', estado: 'ENCOLADA', intentos: 1 }], 'INVALID_STATE'],
    [[{ id: '10', estado: 'FALLIDA', intentos: 5 }], 'MAX_ATTEMPTS']
  ])('does not schedule an invalid retry (%s)', async (rows, reason) => {
    tx.execute.mockResolvedValueOnce(rows);
    await expect(scheduleNotificationRetry('10', 5, 3)).resolves.toMatchObject({ reason });
    expect(tx.execute).toHaveBeenCalledOnce();
  });

  it('lists without optional filters', async () => {
    executeQuery.mockResolvedValue([]);
    await listNotifications({ limit: 20 });
    const [query, params] = executeQuery.mock.calls.at(-1);
    expect(query).not.toMatch(/WHERE canal/);
    expect(params).toEqual([21]);
  });

  it('claims a current enqueued generation with a lease token', async () => {
    executeQuery.mockResolvedValue([{ id: '10', contenidoRenderizado: 'Hola' }]);
    await expect(claimNotificationForDelivery('10', 2, 'token', 30000))
      .resolves.toMatchObject({ id: '10' });
    expect(executeQuery.mock.calls.at(-1)[0]).toMatch(/processing_started_at/);
    expect(executeQuery.mock.calls.at(-1)[1]).toEqual(['10', 2, 'token', 30000]);
  });

  it('ignores a stale delivery token while recording', async () => {
    tx.execute.mockResolvedValueOnce([]);
    await expect(recordDeliveryResult({
      id: '10', generation: 2, token: 'stale', success: true,
      terminal: true, detail: 'accepted', retryable: false, durationMs: 10
    })).resolves.toBeUndefined();
    expect(tx.execute).toHaveBeenCalledOnce();
  });

  it.each([
    [true, true, 'ENVIADA', 'EXITOSO'],
    [false, false, 'ENCOLADA', 'FALLIDO'],
    [false, true, 'FALLIDA', 'FALLIDO']
  ])('records attempt and state atomically (%s/%s)', async (success, terminal, state, result) => {
    tx.execute
      .mockResolvedValueOnce([{ intentos: 1 }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: '10', estado: state, intentos: 2 }]);
    await expect(recordDeliveryResult({
      id: '10', generation: 2, token: 'token', success, terminal,
      detail: 'detail', errorCode: success ? undefined : 'ERR', retryable: !terminal,
      durationMs: 25, providerMessageId: success ? 'provider-1' : undefined
    })).resolves.toMatchObject({ estado: state });
    expect(tx.execute.mock.calls[1][1][3]).toBe(result);
    expect(tx.execute.mock.calls[2][1][3]).toBe(state);
  });
});
