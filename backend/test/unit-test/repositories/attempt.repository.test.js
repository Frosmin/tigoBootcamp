import { describe, expect, it, vi } from 'vitest';

vi.mock('@tigo/postgres-connector', () => ({ executeQuery: vi.fn() }));

import { executeQuery } from '@tigo/postgres-connector';
import {
  findAttemptsByNotificationId,
  recordDeliveryAttempt
} from '../../../src/repositories/attempt.repository.js';

describe('attempt.repository.js', () => {
  it('returns attempts ordered by their sequence number', async () => {
    const attempts = [
      {
        id: '1',
        notificationId: '10',
        numero: 1,
        resultado: 'FALLIDO',
        detalle: 'timeout'
      }
    ];
    executeQuery.mockResolvedValue(attempts);

    await expect(findAttemptsByNotificationId('10')).resolves.toEqual(attempts);
    const [query, params] = executeQuery.mock.calls[0];
    expect(query).toMatch(/notificacion_id AS "notificationId"/);
    expect(query).toMatch(/ORDER BY numero ASC/);
    expect(params).toEqual(['10']);
  });

  it('records an attempt and state transition atomically', async () => {
    executeQuery.mockResolvedValue([{ numero: 2, estado: 'FALLIDA' }]);
    const input = {
      notificationId: '10',
      result: 'FALLIDO',
      detail: 'SMTP_ERROR',
      state: 'FALLIDA'
    };
    await expect(recordDeliveryAttempt(input)).resolves.toEqual({
      numero: 2,
      estado: 'FALLIDA'
    });
    const [query, params] = executeQuery.mock.calls.at(-1);
    expect(query).toMatch(/WITH updated AS/);
    expect(query).toMatch(/intentos = intentos \+ 1/);
    expect(query).toMatch(/WHERE id = \$1::bigint AND estado = 'ENCOLADA'/);
    expect(params).toEqual(['10', 'FALLIDA', null, 'FALLIDO', 'SMTP_ERROR']);
  });
});
