const integer = (name, fallback, { min = 0, max = Number.MAX_SAFE_INTEGER } = {}) => {
  const raw = process.env[name] ?? String(fallback);
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer between ${min} and ${max}`);
  }
  return value;
};

const boolean = (name, fallback = false) => {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  throw new Error(`${name} must be true or false`);
};

const config = {
  API_BASE_PATH: process.env.API_BASE_PATH || '/api/v1',
  PORT: integer('PORT', 3000, { min: 1, max: 65535 }),
  WORKER_HEALTH_PORT: integer('WORKER_HEALTH_PORT', 3051, { min: 1, max: 65535 }),
  REDIS_HOST: process.env.REDIS_HOST || 'localhost',
  REDIS_PORT: integer('REDIS_PORT', 6379, { min: 1, max: 65535 }),
  REDIS_PASSWORD: process.env.REDIS_PASSWORD || undefined,
  BULLMQ_PREFIX: process.env.BULLMQ_PREFIX || 'p07',
  EMAIL_QUEUE_NAME: process.env.EMAIL_QUEUE_NAME || 'notifications-email',
  SMS_QUEUE_NAME: process.env.SMS_QUEUE_NAME || 'notifications-sms',
  DELIVERY_MAX_ATTEMPTS: integer('DELIVERY_MAX_ATTEMPTS', 5, { min: 1, max: 20 }),
  DELIVERY_AUTO_ATTEMPTS: integer('DELIVERY_AUTO_ATTEMPTS', 3, { min: 1, max: 20 }),
  DELIVERY_BACKOFF_MS: integer('DELIVERY_BACKOFF_MS', 1000, { min: 100, max: 3600000 }),
  DELIVERY_BACKOFF_JITTER: Number(process.env.DELIVERY_BACKOFF_JITTER || 0.5),
  DELIVERY_LEASE_MS: integer('DELIVERY_LEASE_MS', 60000, { min: 1000, max: 3600000 }),
  EMAIL_RATE_LIMIT_PER_MINUTE: integer('EMAIL_RATE_LIMIT_PER_MINUTE', 60, { min: 1, max: 100000 }),
  EMAIL_WORKER_CONCURRENCY: integer('EMAIL_WORKER_CONCURRENCY', 5, { min: 1, max: 500 }),
  SMS_RATE_LIMIT_PER_MINUTE: integer('SMS_RATE_LIMIT_PER_MINUTE', 60, { min: 1, max: 100000 }),
  SMS_WORKER_CONCURRENCY: integer('SMS_WORKER_CONCURRENCY', 5, { min: 1, max: 500 }),
  OUTBOX_BATCH_SIZE: integer('OUTBOX_BATCH_SIZE', 100, { min: 1, max: 1000 }),
  OUTBOX_POLL_INTERVAL_MS: integer('OUTBOX_POLL_INTERVAL_MS', 250, { min: 50, max: 60000 }),
  OUTBOX_LEASE_MS: integer('OUTBOX_LEASE_MS', 30000, { min: 1000, max: 3600000 }),
  JOBS_COMPLETED_AGE_SECONDS: integer('JOBS_COMPLETED_AGE_SECONDS', 3600, { min: 60 }),
  JOBS_COMPLETED_COUNT: integer('JOBS_COMPLETED_COUNT', 1000, { min: 1 }),
  JOBS_FAILED_AGE_SECONDS: integer('JOBS_FAILED_AGE_SECONDS', 604800, { min: 60 }),
  JOBS_FAILED_COUNT: integer('JOBS_FAILED_COUNT', 5000, { min: 1 }),
  EMAIL_ENABLED: boolean('EMAIL_ENABLED', true),
  SMS_ENABLED: boolean('SMS_ENABLED', false),
  DELIVERY_PROVIDER: process.env.DELIVERY_PROVIDER || 'smtp',
  WORKER_CHANNEL: process.env.WORKER_CHANNEL || 'EMAIL',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: integer('SMTP_PORT', 465, { min: 1, max: 65535 }),
  SMTP_SECURE: boolean('SMTP_SECURE', true),
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASSWORD: process.env.SMTP_PASSWORD,
  SMTP_FROM: process.env.SMTP_FROM,
  SMTP_MAX_CONNECTIONS: integer('SMTP_MAX_CONNECTIONS', 5, { min: 1, max: 100 }),
  SMTP_MAX_MESSAGES: integer('SMTP_MAX_MESSAGES', 100, { min: 1, max: 10000 }),
  SMTP_CONNECTION_TIMEOUT_MS: integer('SMTP_CONNECTION_TIMEOUT_MS', 10000, { min: 1000 }),
  SMTP_SOCKET_TIMEOUT_MS: integer('SMTP_SOCKET_TIMEOUT_MS', 30000, { min: 1000 })
};

if (!Number.isFinite(config.DELIVERY_BACKOFF_JITTER)
  || config.DELIVERY_BACKOFF_JITTER < 0
  || config.DELIVERY_BACKOFF_JITTER > 1) {
  throw new Error('DELIVERY_BACKOFF_JITTER must be between 0 and 1');
}

if (config.DELIVERY_AUTO_ATTEMPTS > config.DELIVERY_MAX_ATTEMPTS) {
  throw new Error('DELIVERY_AUTO_ATTEMPTS cannot exceed DELIVERY_MAX_ATTEMPTS');
}

if (!['EMAIL', 'SMS'].includes(config.WORKER_CHANNEL)) {
  throw new Error('WORKER_CHANNEL must be EMAIL or SMS');
}

export const validateWorkerConfig = (channel) => {
  if (channel === 'EMAIL' && config.EMAIL_ENABLED && config.DELIVERY_PROVIDER === 'smtp') {
    if (!config.SMTP_USER || !config.SMTP_PASSWORD || !config.SMTP_FROM) {
      throw new Error('SMTP_USER, SMTP_PASSWORD and SMTP_FROM are required for the EMAIL worker');
    }
  }
  if (channel === 'SMS' && !config.SMS_ENABLED) {
    throw new Error('SMS provider is not configured');
  }
};

export default config;
