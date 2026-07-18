import { describe, expect, it, vi } from 'vitest';
import { DeliveryConnector } from '../../../src/delivery/delivery.connector.js';
import { EmailConnector } from '../../../src/delivery/email.connector.js';
import { SmsConnector } from '../../../src/delivery/sms.connector.js';

describe('delivery connectors', () => {
  it('requires subclasses to implement send', async () => {
    await expect(new DeliveryConnector().send()).rejects.toThrow('must be implemented');
  });

  it('sends email with deterministic Message-ID', async () => {
    const sendMail = vi.fn().mockResolvedValue({ messageId: 'provider-id' });
    const connector = new EmailConnector({
      transporter: { sendMail },
      from: 'sender@gmail.com',
      messageIdDomain: 'gmail.com'
    });

    await connector.send({
      notificationId: '9',
      destinatario: 'user@example.com',
      asunto: 'confirmacion',
      contenido: 'Hola'
    });

    expect(sendMail).toHaveBeenCalledWith({
      from: 'sender@gmail.com',
      to: 'user@example.com',
      subject: 'confirmacion',
      text: 'Hola',
      messageId: '<notification-9@gmail.com>'
    });
  });

  it('classifies SMTP failures', async () => {
    const connector = new EmailConnector({
      transporter: { sendMail: vi.fn().mockRejectedValue({ code: 'ETIMEDOUT' }) },
      from: 'sender@gmail.com',
      messageIdDomain: 'gmail.com'
    });
    await expect(connector.send({})).rejects.toMatchObject({ retryable: true });
  });

  it('keeps SMS as an explicit terminal connector', async () => {
    await expect(new SmsConnector().send()).rejects.toMatchObject({
      code: 'SMS_PROVIDER_NOT_CONFIGURED',
      retryable: false
    });
  });
});
