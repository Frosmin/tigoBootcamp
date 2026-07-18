import nodemailer from 'nodemailer';
import config from '../utils/config.js';

let transporter;

const getTransporter = () => {
  transporter ??= nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    pool: true,
    maxConnections: config.SMTP_MAX_CONNECTIONS,
    maxMessages: config.SMTP_MAX_MESSAGES,
    connectionTimeout: config.SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: config.SMTP_SOCKET_TIMEOUT_MS,
    auth: { user: config.SMTP_USER, pass: config.SMTP_PASSWORD }
  });
  return transporter;
};

export const emailConnector = {
  async verify() { return getTransporter().verify(); },
  async send(notification) {
    const messageId = `<p07-${notification.id}-g${notification.generacion}@tigo.local>`;
    const info = await getTransporter().sendMail({
      from: config.SMTP_FROM,
      to: notification.destinatario,
      subject: notification.asunto,
      text: notification.contenidoRenderizado,
      messageId
    });
    return { messageId: info.messageId || messageId, response: info.response || 'accepted' };
  },
  async close() { transporter?.close(); transporter = undefined; }
};
