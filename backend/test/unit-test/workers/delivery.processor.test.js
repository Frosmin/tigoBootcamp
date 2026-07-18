import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DeliveryError } from '../../../src/delivery/delivery.error.js';
import { createDeliveryProcessor } from '../../../src/workers/delivery.processor.js';

describe('delivery.processor.js', () => {
  const notification = {
    id: '9',
    canal: 'EMAIL',
    destinatario: 'user@example.com',
    variables: { nombre: 'Ana' },
    estado: 'ENCOLADA',
    intentos: 0,
    nextAttemptAt: null,
    templateName: 'confirmacion',
    templateContent: 'Hola {{nombre}}'
  };
  let deps;
  let emailConnector;
  let smsConnector;
  let processNotification;

  beforeEach(() => {
    deps = {
      acquireDeliveryLock: vi.fn().mockResolvedValue(true),
      releaseDeliveryLock: vi.fn().mockResolvedValue(1),
      findNotificationForDelivery: vi.fn().mockResolvedValue(notification),
      recordDeliveryAttempt: vi.fn().mockResolvedValue({ numero: 1 }),
      renderTemplate: vi.fn().mockReturnValue('Hola Ana'),
      acquireThroughputPermit: vi.fn().mockResolvedValue({ allowed: true, retryAtMs: 60000 }),
      isMarkedDelivered: vi.fn().mockResolvedValue(false),
      markDelivered: vi.fn().mockResolvedValue('OK'),
      scheduleNotification: vi.fn().mockResolvedValue(1),
      now: vi.fn(() => 100000),
      token: vi.fn(() => 'token')
    };
    emailConnector = { send: vi.fn().mockResolvedValue({ accepted: ['user@example.com'] }) };
    smsConnector = { send: vi.fn() };
    processNotification = createDeliveryProcessor({
      emailConnector,
      smsConnector,
      dependencies: deps
    });
  });

  it('ignores a concurrently locked duplicate', async () => {
    deps.acquireDeliveryLock.mockResolvedValue(false);
    await expect(processNotification('9')).resolves.toEqual({ outcome: 'DUPLICATE_LOCKED' });
    expect(deps.findNotificationForDelivery).not.toHaveBeenCalled();
    expect(deps.releaseDeliveryLock).not.toHaveBeenCalled();
  });

  it.each([
    [undefined, 'NOT_FOUND'],
    [{ ...notification, estado: 'ENVIADA' }, 'ALREADY_SENT'],
    [{ ...notification, estado: 'FALLIDA' }, 'ALREADY_FAILED']
  ])('discards missing or terminal notifications', async (found, outcome) => {
    deps.findNotificationForDelivery.mockResolvedValue(found);
    await expect(processNotification('9')).resolves.toMatchObject({ outcome });
    expect(emailConnector.send).not.toHaveBeenCalled();
    expect(deps.releaseDeliveryLock).toHaveBeenCalledWith('9', 'token');
  });

  it('reschedules a retry that is not due yet without sending', async () => {
    deps.findNotificationForDelivery.mockResolvedValue({
      ...notification,
      nextAttemptAt: new Date(120000).toISOString()
    });
    await expect(processNotification('9')).resolves.toEqual({
      outcome: 'NOT_DUE',
      dueAtMs: 120000
    });
    expect(deps.scheduleNotification).toHaveBeenCalledWith('9', 120000);
    expect(emailConnector.send).not.toHaveBeenCalled();
  });

  it('recovers database state from the delivered guard without resending', async () => {
    deps.isMarkedDelivered.mockResolvedValue(true);
    await expect(processNotification('9')).resolves.toEqual({
      outcome: 'RECOVERED_DELIVERED'
    });
    expect(deps.recordDeliveryAttempt).toHaveBeenCalledWith({
      notificationId: '9',
      result: 'EXITOSO',
      detail: 'RECOVERED_FROM_DELIVERED_GUARD',
      state: 'ENVIADA'
    });
    expect(emailConnector.send).not.toHaveBeenCalled();
  });

  it('defers for throughput without consuming an attempt', async () => {
    deps.acquireThroughputPermit.mockResolvedValue({ allowed: false, retryAtMs: 160000 });
    await expect(processNotification('9')).resolves.toEqual({
      outcome: 'RATE_LIMITED',
      dueAtMs: 160000
    });
    expect(deps.scheduleNotification).toHaveBeenCalledWith('9', 160000);
    expect(deps.recordDeliveryAttempt).not.toHaveBeenCalled();
  });

  it('sends email, marks delivery and persists success', async () => {
    await expect(processNotification('9')).resolves.toEqual({ outcome: 'SENT' });
    expect(emailConnector.send).toHaveBeenCalledWith({
      notificationId: '9',
      destinatario: 'user@example.com',
      asunto: 'confirmacion',
      contenido: 'Hola Ana'
    });
    expect(deps.markDelivered).toHaveBeenCalledWith('9');
    expect(deps.recordDeliveryAttempt).toHaveBeenCalledWith({
      notificationId: '9',
      result: 'EXITOSO',
      detail: null,
      state: 'ENVIADA'
    });
  });

  it('persists ENVIADA even when the Redis delivered marker is unavailable', async () => {
    deps.markDelivered.mockRejectedValue(new Error('redis unavailable'));

    await expect(processNotification('9')).resolves.toEqual({ outcome: 'SENT' });

    expect(deps.recordDeliveryAttempt).toHaveBeenCalledWith({
      notificationId: '9',
      result: 'EXITOSO',
      detail: null,
      state: 'ENVIADA'
    });
  });

  it('propagates success persistence failures without recording a false delivery failure', async () => {
    deps.recordDeliveryAttempt.mockRejectedValue(new Error('database unavailable'));

    await expect(processNotification('9')).rejects.toThrow('database unavailable');

    expect(deps.markDelivered).toHaveBeenCalledWith('9');
    expect(deps.recordDeliveryAttempt).toHaveBeenCalledTimes(1);
  });

  it('records a retryable failure and schedules exponential backoff', async () => {
    emailConnector.send.mockRejectedValue(
      new DeliveryError('ETIMEDOUT', 'timeout', true)
    );
    await expect(processNotification('9')).resolves.toEqual({
      outcome: 'RETRY_SCHEDULED',
      dueAtMs: 130000
    });
    expect(deps.recordDeliveryAttempt).toHaveBeenCalledWith({
      notificationId: '9',
      result: 'FALLIDO',
      detail: 'ETIMEDOUT: timeout',
      state: 'ENCOLADA',
      nextAttemptAt: new Date(130000).toISOString()
    });
    expect(deps.scheduleNotification).toHaveBeenCalledWith('9', 130000);
  });

  it('marks FALLIDA after exhausting the configured attempts', async () => {
    deps.findNotificationForDelivery.mockResolvedValue({ ...notification, intentos: 2 });
    emailConnector.send.mockRejectedValue(
      new DeliveryError('ETIMEDOUT', 'timeout', true)
    );
    await expect(processNotification('9')).resolves.toEqual({
      outcome: 'FAILED',
      retryable: true
    });
    expect(deps.recordDeliveryAttempt).toHaveBeenCalledWith(expect.objectContaining({
      result: 'FALLIDO',
      state: 'FALLIDA'
    }));
    expect(deps.scheduleNotification).not.toHaveBeenCalled();
  });

  it('marks terminal connector and render failures as FALLIDA', async () => {
    emailConnector.send.mockRejectedValueOnce(
      new DeliveryError('EAUTH', 'invalid credentials', false)
    );
    await expect(processNotification('9')).resolves.toMatchObject({
      outcome: 'FAILED',
      retryable: false
    });

    deps.renderTemplate.mockImplementationOnce(() => {
      throw new DeliveryError('TEMPLATE_RENDER_ERROR', 'missing variable', false);
    });
    await expect(processNotification('9')).resolves.toMatchObject({
      outcome: 'FAILED',
      retryable: false
    });
  });

  it('uses the SMS connector for SMS jobs', async () => {
    deps.findNotificationForDelivery.mockResolvedValue({ ...notification, canal: 'SMS' });
    smsConnector.send.mockRejectedValue(
      new DeliveryError('SMS_PROVIDER_NOT_CONFIGURED', 'not configured', false)
    );
    await expect(processNotification('9')).resolves.toMatchObject({ outcome: 'FAILED' });
    expect(smsConnector.send).toHaveBeenCalledOnce();
    expect(emailConnector.send).not.toHaveBeenCalled();
  });

  it('does not hide a completed result when lock release fails', async () => {
    deps.releaseDeliveryLock.mockRejectedValue(new Error('redis down'));
    await expect(processNotification('9')).resolves.toEqual({ outcome: 'SENT' });
  });
});
