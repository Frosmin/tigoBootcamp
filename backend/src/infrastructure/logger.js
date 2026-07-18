import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  redact: {
    paths: [
      '*.destinatario', '*.variables', '*.contenido', '*.contenidoRenderizado',
      '*.password', '*.authorization', '*.SMTP_PASSWORD', '*.P_DB_PASSWORD', '*.REDIS_PASSWORD'
    ],
    censor: '[REDACTED]'
  }
});
