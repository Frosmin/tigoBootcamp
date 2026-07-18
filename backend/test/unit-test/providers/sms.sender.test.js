import { describe, expect, it, vi } from 'vitest';
import { createSmsSender } from '../../../src/providers/sms.sender.js';

describe('sms.sender.js', () => {
  const options = { providerUrl: 'https://sms.test/messages', providerToken: 'token', timeoutMs: 50 };

  it('sends the generic contract with provider idempotency', async () => {
    const fetchImplementation = vi.fn().mockResolvedValue({
      ok: true, status: 202, json: vi.fn().mockResolvedValue({ messageId: 'provider-1' })
    });
    const send = createSmsSender({ ...options, fetchImplementation });
    await expect(send({ notificationId: '4', to: '70000000', message: 'Hola' }))
      .resolves.toEqual({ messageId: 'provider-1' });
    expect(fetchImplementation).toHaveBeenCalledWith(options.providerUrl, expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({
        Authorization: 'Bearer token', 'Idempotency-Key': 'notification-4'
      }),
      body: JSON.stringify({ messageId: 'notification-4', to: '70000000', message: 'Hola' })
    }));
  });

  it.each([408, 429, 500, 503])('treats HTTP %i as retryable', async (status) => {
    const send = createSmsSender({
      ...options,
      fetchImplementation: vi.fn().mockResolvedValue({ ok: false, status, text: vi.fn().mockResolvedValue('later') })
    });
    await expect(send({ notificationId: '4' })).rejects.toMatchObject({ name: 'Error' });
  });

  it('treats other 4xx responses and missing credentials as permanent', async () => {
    const send = createSmsSender({
      ...options,
      fetchImplementation: vi.fn().mockResolvedValue({ ok: false, status: 400, text: vi.fn().mockResolvedValue('bad') })
    });
    await expect(send({ notificationId: '4' })).rejects.toMatchObject({ name: 'PermanentDeliveryError' });
    await expect(createSmsSender({ providerUrl: undefined, providerToken: undefined })({}))
      .rejects.toMatchObject({ name: 'PermanentDeliveryError' });
  });

  it('supports successful responses without a body', async () => {
    const send = createSmsSender({
      ...options,
      fetchImplementation: vi.fn().mockResolvedValue({ ok: true, status: 204 })
    });
    await expect(send({ notificationId: '4' })).resolves.toEqual({ messageId: 'notification-4' });
  });
});
