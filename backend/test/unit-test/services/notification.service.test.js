import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../../src/repositories/template.repository.js', () => ({
  findTemplateById: vi.fn()
}));
vi.mock('../../../src/repositories/notification.repository.js', () => ({
  insertNotification: vi.fn(),
  findNotificationByIdempotencyKey: vi.fn(),
  deleteNotificationAfterQueueFailure: vi.fn()
}));
vi.mock('../../../src/queues/notification.queue.js', () => ({
  enqueueNotification: vi.fn()
}));

import { findTemplateById } from '../../../src/repositories/template.repository.js';
import {
  deleteNotificationAfterQueueFailure,
  findNotificationByIdempotencyKey,
  insertNotification
} from '../../../src/repositories/notification.repository.js';
import { enqueueNotification } from '../../../src/queues/notification.queue.js';
import { createNotificationService } from '../../../src/services/notification.service.js';

describe('notification.service.js', () => {
  const request = {
    canal: 'EMAIL',
    destinatario: 'user@example.com',
    plantillaId: 2,
    variables: { nombre: 'Ana', total: 10 }
  };
  const template = {
    id: 2,
    canal: 'EMAIL',
    variables: ['nombre', 'total']
  };
  const notification = {
    id: 9,
    ...request,
    estado: 'ENCOLADA',
    intentos: 0
  };

  beforeEach(() => {
    vi.clearAllMocks();
    findTemplateById.mockResolvedValue(template);
    insertNotification.mockResolvedValue(notification);
    enqueueNotification.mockResolvedValue('1-0');
  });

  it('persists and enqueues a valid notification', async () => {
    await expect(createNotificationService(request, 'request-1')).resolves.toEqual({
      notification,
      created: true
    });
    expect(insertNotification).toHaveBeenCalledWith({ ...request, idempotencyKey: 'request-1' });
    expect(enqueueNotification).toHaveBeenCalledWith(9);
  });

  it('returns NF001 when the template does not exist', async () => {
    findTemplateById.mockResolvedValue(undefined);
    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({
      errorCode: 'NF001'
    });
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it.each([
    [{ ...template, canal: 'SMS' }, request],
    [template, { ...request, variables: { nombre: 'Ana' } }],
    [template, { ...request, variables: { nombre: 'Ana', total: 10, extra: true } }]
  ])('returns BR001 when the notification does not match the template', async (foundTemplate, input) => {
    findTemplateById.mockResolvedValue(foundTemplate);
    await expect(createNotificationService(input, 'request-1')).rejects.toMatchObject({
      errorCode: 'BR001'
    });
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it('returns an identical existing notification without enqueuing again', async () => {
    insertNotification.mockResolvedValue(undefined);
    findNotificationByIdempotencyKey.mockResolvedValue(notification);

    await expect(createNotificationService(request, 'request-1')).resolves.toEqual({
      notification,
      created: false
    });
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it.each([
    [undefined],
    [{ ...notification, destinatario: 'other@example.com' }],
    [{ ...notification, variables: { nombre: 'Ana', total: '10' } }]
  ])('returns CF001 when an idempotency key cannot represent this request', async (existing) => {
    insertNotification.mockResolvedValue(undefined);
    findNotificationByIdempotencyKey.mockResolvedValue(existing);

    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({
      errorCode: 'CF001'
    });
    expect(enqueueNotification).not.toHaveBeenCalled();
  });

  it('compensates the insert and returns SU001 when Redis fails', async () => {
    enqueueNotification.mockRejectedValue(new Error('redis down'));

    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({
      errorCode: 'SU001'
    });
    expect(deleteNotificationAfterQueueFailure).toHaveBeenCalledWith(9, 'request-1');
  });

  it('keeps SU001 when compensation also fails', async () => {
    enqueueNotification.mockRejectedValue(new Error('redis down'));
    deleteNotificationAfterQueueFailure.mockRejectedValue(new Error('database down'));

    await expect(createNotificationService(request, 'request-1')).rejects.toMatchObject({
      errorCode: 'SU001'
    });
  });
});
