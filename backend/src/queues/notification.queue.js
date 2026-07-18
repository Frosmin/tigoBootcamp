import { Queue, QueueEvents } from 'bullmq';
import { logger } from '../infrastructure/logger.js';
import config from '../utils/config.js';
import { createProducerRedisClient } from '../infrastructure/redis.client.js';

const queues = new Map();
const queueEvents = new Map();
let connection;

export const queueNameForChannel = (channel) => channel === 'EMAIL'
  ? config.EMAIL_QUEUE_NAME
  : config.SMS_QUEUE_NAME;

export const getNotificationQueue = (channel) => {
  if (!queues.has(channel)) {
    connection ??= createProducerRedisClient();
    queues.set(channel, new Queue(queueNameForChannel(channel), {
      connection,
      prefix: config.BULLMQ_PREFIX
    }));
  }
  return queues.get(channel);
};

const jobOptions = (event) => ({
  jobId: `notification-${event.aggregateId}-g${event.generation}`,
  attempts: event.payload.attemptsAllowed,
  backoff: {
    type: 'exponential',
    delay: config.DELIVERY_BACKOFF_MS,
    jitter: config.DELIVERY_BACKOFF_JITTER
  },
  removeOnComplete: {
    age: config.JOBS_COMPLETED_AGE_SECONDS,
    count: config.JOBS_COMPLETED_COUNT
  },
  removeOnFail: {
    age: config.JOBS_FAILED_AGE_SECONDS,
    count: config.JOBS_FAILED_COUNT
  }
});

export const publishOutboxEvents = async (events) => {
  if (!events.length) return [];
  const channel = events[0].channel;
  const queue = getNotificationQueue(channel);
  return queue.addBulk(events.map((event) => ({
    name: `send-${channel.toLowerCase()}`,
    data: event.payload,
    opts: jobOptions(event)
  })));
};

export const initializeQueueEvents = (channel) => {
  if (queueEvents.has(channel)) return queueEvents.get(channel);
  const events = new QueueEvents(queueNameForChannel(channel), {
    connection: {
      host: config.REDIS_HOST,
      port: config.REDIS_PORT,
      password: config.REDIS_PASSWORD,
      maxRetriesPerRequest: null
    },
    prefix: config.BULLMQ_PREFIX
  });
  events.on('failed', ({ jobId }) => logger.error({
    '[QUEUE EVENT]': 'failed', '[JOB ID]': jobId
  }));
  events.on('stalled', ({ jobId }) => logger.error({ '[QUEUE EVENT]': 'stalled', '[JOB ID]': jobId }));
  events.on('error', (error) => logger.error({ '[QUEUE EVENTS ERROR]': error.message }));
  queueEvents.set(channel, events);
  return events;
};

export const closeNotificationQueues = async () => {
  await Promise.allSettled([
    ...[...queueEvents.values()].map((events) => events.close()),
    ...[...queues.values()].map((queue) => queue.close())
  ]);
  queueEvents.clear();
  queues.clear();
  connection = undefined;
};

// Backward-compatible name for callers/tests while using BullMQ underneath.
export const enqueueNotification = async (notificationId) => getNotificationQueue('EMAIL').add(
  'send-email',
  { notificationId: String(notificationId), generation: 1, channel: 'EMAIL' },
  { jobId: `notification-${notificationId}-g1` }
);
