/**
 * Punto unico para leer variables de entorno.
 * Agregar aqui cada variable que use el microservicio, con su valor por
 * defecto cuando aplique. El resto del codigo debe importar desde este modulo
 * y nunca leer process.env directamente.
 */
const numberFromEnv = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const booleanFromEnv = (value, fallback) => {
  if (value === undefined) return fallback;
  return value.toLowerCase() === 'true';
};

export default {
  API_BASE_PATH: process.env.API_BASE_PATH || '/api/v1',
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT || 6379),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  NOTIFICATION_STREAM: process.env.NOTIFICATION_STREAM || 'notifications:dispatch',
  NOTIFICATION_DELAYED_SET: process.env.NOTIFICATION_DELAYED_SET || 'notifications:delayed',
  NOTIFICATION_CONSUMER_GROUP: process.env.NOTIFICATION_CONSUMER_GROUP || 'notification-workers',
  NOTIFICATION_CONSUMER_NAME: process.env.NOTIFICATION_CONSUMER_NAME,
  WORKER_BLOCK_MS: numberFromEnv(process.env.WORKER_BLOCK_MS, 5000),
  WORKER_CLAIM_IDLE_MS: numberFromEnv(process.env.WORKER_CLAIM_IDLE_MS, 30000),
  WORKER_LOCK_TTL_MS: numberFromEnv(process.env.WORKER_LOCK_TTL_MS, 180000),
  DELIVERED_MARK_TTL_MS: numberFromEnv(
    process.env.DELIVERED_MARK_TTL_MS,
    604800000
  ),
  DELAYED_PROMOTION_INTERVAL_MS: numberFromEnv(
    process.env.DELAYED_PROMOTION_INTERVAL_MS,
    1000
  ),
  MAX_DELIVERY_ATTEMPTS: numberFromEnv(process.env.MAX_DELIVERY_ATTEMPTS, 3),
  RETRY_BASE_DELAY_MS: numberFromEnv(process.env.RETRY_BASE_DELAY_MS, 30000),
  RETRY_MAX_DELAY_MS: numberFromEnv(process.env.RETRY_MAX_DELAY_MS, 300000),
  EMAIL_MAX_PER_MINUTE: numberFromEnv(process.env.EMAIL_MAX_PER_MINUTE, 60),
  SMS_MAX_PER_MINUTE: numberFromEnv(process.env.SMS_MAX_PER_MINUTE, 60),
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: numberFromEnv(process.env.SMTP_PORT, 465),
  SMTP_SECURE: booleanFromEnv(process.env.SMTP_SECURE, true),
  SMTP_CONNECTION_TIMEOUT_MS: numberFromEnv(
    process.env.SMTP_CONNECTION_TIMEOUT_MS,
    30000
  ),
  SMTP_GREETING_TIMEOUT_MS: numberFromEnv(
    process.env.SMTP_GREETING_TIMEOUT_MS,
    30000
  ),
  SMTP_SOCKET_TIMEOUT_MS: numberFromEnv(
    process.env.SMTP_SOCKET_TIMEOUT_MS,
    60000
  ),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_APP_PASSWORD: process.env.SMTP_APP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM || process.env.SMTP_USER,
  SMTP_MESSAGE_ID_DOMAIN: process.env.SMTP_MESSAGE_ID_DOMAIN
};
