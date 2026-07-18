import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/repositories/template.repository.js', () => ({ findTemplateById: vi.fn() }));
vi.mock('../../../src/repositories/notification.repository.js', () => ({
  insertNotification: vi.fn(), findNotificationById: vi.fn(),
  findNotificationByIdempotencyKey: vi.fn(), listNotifications: vi.fn(),
  scheduleNotificationRetry: vi.fn()
}));
vi.mock('../../../src/repositories/attempt.repository.js', () => ({ findAttemptsByNotificationId: vi.fn() }));

import { findTemplateById } from '../../../src/repositories/template.repository.js';
import {
  findNotificationById, findNotificationByIdempotencyKey, insertNotification,
  listNotifications, scheduleNotificationRetry
} from '../../../src/repositories/notification.repository.js';
import { findAttemptsByNotificationId } from '../../../src/repositories/attempt.repository.js';
import {
  createNotificationService, getNotificationService,
  listNotificationsService, retryNotificationService
} from '../../../src/services/notification.service.js';

describe('notification.service.js', () => {
  const request = {
    canal: 'EMAIL', destinatario: 'user@example.com', plantillaId: 2,
    variables: { nombre: 'Ana', total: 10 }
  };
  const template = {
    id: 2, nombre: 'Confirmación', canal: 'EMAIL',
    contenido: 'Hola {{nombre}}, total {{total}}', variables: ['nombre', 'total']
  };
  const notification = { id: '9', ...request, estado: 'ENCOLADA', intentos: 0, generacion: 1 };

  beforeEach(() => {
    vi.clearAllMocks();
    findTemplateById.mockResolvedValue(template);
    insertNotification.mockResolvedValue(notification);
  });

  it('persists a rendered snapshot and outbox aggregate', async () => {
    await expect(createNotificationService(request, 'request-1')).resolves.toEqual({ notification, created: true });
    expect(insertNotification).toHaveBeenCalledWith(expect.objectContaining({
      ...request, idempotencyKey: 'request-1', asunto: 'Confirmación',
      contenidoRenderizado: 'Hola Ana, total 10', attemptsAllowed: 3
    }));
  });

  it('returns NF001 when the template does not exist', async () => {
    findTemplateById.mockResolvedValue(undefined);
    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({ errorCode: 'NF001' });
  });

  it.each([
    [{ ...template, canal: 'SMS' }, request],
    [template, { ...request, variables: { nombre: 'Ana' } }],
    [template, { ...request, variables: { nombre: 'Ana', total: 10, extra: true } }]
  ])('returns BR001 for template mismatch', async (foundTemplate, input) => {
    findTemplateById.mockResolvedValue(foundTemplate);
    await expect(createNotificationService(input, 'request-1')).rejects.toMatchObject({ errorCode: 'BR001' });
  });

  it('returns the identical idempotent resource', async () => {
    insertNotification.mockResolvedValue(undefined);
    findNotificationByIdempotencyKey.mockResolvedValue(notification);
    await expect(createNotificationService(request, 'request-1')).resolves.toEqual({ notification, created: false });
  });

  it.each([
    undefined,
    { ...notification, destinatario: 'other@example.com' },
    { ...notification, variables: { nombre: 'Ana', total: '10' } }
  ])('returns CF001 for incompatible idempotency key', async (existing) => {
    insertNotification.mockResolvedValue(undefined);
    findNotificationByIdempotencyKey.mockResolvedValue(existing);
    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({ errorCode: 'CF001' });
  });

  it('rejects SMS while no provider is configured', async () => {
    await expect(createNotificationService({ ...request, canal: 'SMS' }, 'sms-1'))
      .rejects.toMatchObject({ errorCode: 'SU001' });
    expect(findTemplateById).not.toHaveBeenCalled();
  });

  it('returns ordered attempt history', async () => {
    const attempts = [{ numero: 1, resultado: 'FALLIDO' }];
    findNotificationById.mockResolvedValue(notification);
    findAttemptsByNotificationId.mockResolvedValue(attempts);
    await expect(getNotificationService('9')).resolves.toEqual({ ...notification, historialIntentos: attempts });
  });

  it('returns an empty attempt history', async () => {
    findNotificationById.mockResolvedValue(notification);
    findAttemptsByNotificationId.mockResolvedValue([]);
    await expect(getNotificationService('9')).resolves.toMatchObject({ historialIntentos: [] });
  });

  it('returns NF001 for absent notification', async () => {
    findNotificationById.mockResolvedValue(undefined);
    await expect(getNotificationService('999')).rejects.toMatchObject({ errorCode: 'NF001' });
  });

  it('creates a stable next cursor for keyset pagination', async () => {
    listNotifications.mockResolvedValue([
      { id: '3', createdAt: '2026-07-18T03:00:00Z' },
      { id: '2', createdAt: '2026-07-18T02:00:00Z' },
      { id: '1', createdAt: '2026-07-18T01:00:00Z' }
    ]);
    const result = await listNotificationsService({ limit: 2 });
    expect(result.items).toHaveLength(2);
    expect(result.page.nextCursor).toBeTypeOf('string');
  });

  it('accepts a retry scheduled atomically', async () => {
    scheduleNotificationRetry.mockResolvedValue({ notification: { ...notification, generacion: 2 } });
    await expect(retryNotificationService('9')).resolves.toMatchObject({ generacion: 2 });
  });

  it.each([
    ['NOT_FOUND', 'NF001'], ['INVALID_STATE', 'CF001'], ['MAX_ATTEMPTS', 'CF001']
  ])('maps retry reason %s', async (reason, errorCode) => {
    scheduleNotificationRetry.mockResolvedValue({ reason });
    await expect(retryNotificationService('9')).rejects.toMatchObject({ errorCode });
  });
});
