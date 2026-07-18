import config from '../utils/config.js';
import { DeliveryConnector } from './delivery.connector.js';
import { DeliveryError, toDeliveryError } from './delivery.error.js';

export class EmailConnector extends DeliveryConnector {
  constructor({ transporter, from, messageIdDomain }) {
    super();
    this.transporter = transporter;
    this.from = from;
    this.messageIdDomain = messageIdDomain;
  }

  async send({ notificationId, destinatario, asunto, contenido }) {
    try {
      return await this.transporter.sendMail({
        from: this.from,
        to: destinatario,
        subject: asunto,
        text: contenido,
        messageId: `<notification-${notificationId}@${this.messageIdDomain}>`
      });
    } catch (error) {
      throw toDeliveryError(error);
    }
  }
}

export const createEmailConnector = async () => {
  if (!config.SMTP_USER || !config.SMTP_APP_PASSWORD || !config.SMTP_FROM) {
    throw new DeliveryError(
      'SMTP_NOT_CONFIGURED',
      'SMTP_USER, SMTP_APP_PASSWORD and SMTP_FROM are required',
      false
    );
  }

  const messageIdDomain = config.SMTP_MESSAGE_ID_DOMAIN
    || config.SMTP_FROM.split('@')[1];
  if (!messageIdDomain) {
    throw new DeliveryError(
      'SMTP_MESSAGE_ID_DOMAIN_INVALID',
      'SMTP_MESSAGE_ID_DOMAIN or a valid SMTP_FROM domain is required',
      false
    );
  }

  const { default: nodemailer } = await import('nodemailer');
  const transporter = nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    connectionTimeout: config.SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: config.SMTP_GREETING_TIMEOUT_MS,
    socketTimeout: config.SMTP_SOCKET_TIMEOUT_MS,
    auth: {
      user: config.SMTP_USER,
      pass: config.SMTP_APP_PASSWORD
    }
  });
  await transporter.verify();

  return new EmailConnector({
    transporter,
    from: config.SMTP_FROM,
    messageIdDomain
  });
};
