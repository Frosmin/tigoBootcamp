import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createTransport, verify, sendMail, close } = vi.hoisted(() => ({
  createTransport: vi.fn(), verify: vi.fn(), sendMail: vi.fn(), close: vi.fn()
}));

vi.mock('nodemailer', () => ({ default: { createTransport } }));
vi.mock('../../../src/utils/config.js', () => ({ default: {
  SMTP_HOST: 'smtp.gmail.com', SMTP_PORT: 465, SMTP_SECURE: true,
  SMTP_MAX_CONNECTIONS: 5, SMTP_MAX_MESSAGES: 100,
  SMTP_CONNECTION_TIMEOUT_MS: 1000, SMTP_SOCKET_TIMEOUT_MS: 2000,
  SMTP_USER: 'user', SMTP_PASSWORD: 'password', SMTP_FROM: 'no-reply@example.com',
  DELIVERY_PROVIDER: 'smtp'
} }));

import { emailConnector } from '../../../src/connectors/email.connector.js';
import { fakeConnector } from '../../../src/connectors/fake.connector.js';
import { smsConnector } from '../../../src/connectors/sms.connector.js';
import { DeliveryError } from '../../../src/connectors/delivery.error.js';

describe('delivery connectors', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    createTransport.mockReturnValue({ verify, sendMail, close });
    verify.mockResolvedValue(true);
    sendMail.mockResolvedValue({ messageId: 'provider-id', response: '250 accepted' });
    await emailConnector.close();
  });

  it('uses one pooled SMTP transporter and a deterministic Message-ID', async () => {
    const notification = {
      id: '42', generacion: 2, destinatario: 'ana@example.com',
      asunto: 'Confirmación', contenidoRenderizado: 'Hola Ana'
    };
    await expect(emailConnector.verify()).resolves.toBe(true);
    await expect(emailConnector.send(notification)).resolves.toEqual({
      messageId: 'provider-id', response: '250 accepted'
    });
    expect(createTransport).toHaveBeenCalledOnce();
    expect(createTransport).toHaveBeenCalledWith(expect.objectContaining({
      pool: true, secure: true, auth: { user: 'user', pass: 'password' }
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: 'ana@example.com', subject: 'Confirmación', text: 'Hola Ana',
      messageId: '<p07-42-g2@tigo.local>'
    }));
    await emailConnector.close();
    expect(close).toHaveBeenCalledOnce();
  });

  it('falls back to deterministic SMTP metadata', async () => {
    sendMail.mockResolvedValue({});
    await expect(emailConnector.send({
      id: '7', generacion: 1, destinatario: 'a@b.com', asunto: 'A', contenidoRenderizado: 'B'
    })).resolves.toEqual({ messageId: '<p07-7-g1@tigo.local>', response: 'accepted' });
  });

  it('simulates successful, temporary and permanent fake deliveries', async () => {
    await expect(fakeConnector.verify()).resolves.toBe(true);
    await expect(fakeConnector.send({
      id: '1', generacion: 1, destinatario: 'ok@example.com'
    })).resolves.toMatchObject({ response: 'accepted' });
    await expect(fakeConnector.send({ destinatario: 'temporary-failure@example.com' }))
      .rejects.toMatchObject({ retryable: true, code: 'FAKE_TEMPORARY' });
    await expect(fakeConnector.send({ destinatario: 'permanent-failure@example.com' }))
      .rejects.toMatchObject({ retryable: false, code: 'FAKE_PERMANENT' });
    await expect(fakeConnector.close()).resolves.toBeUndefined();
  });

  it('keeps SMS explicitly unavailable', async () => {
    await expect(smsConnector.verify()).rejects.toBeInstanceOf(DeliveryError);
    await expect(smsConnector.send()).rejects.toMatchObject({ code: 'SMS_NOT_CONFIGURED' });
    await expect(smsConnector.close()).resolves.toBeUndefined();
  });
});
