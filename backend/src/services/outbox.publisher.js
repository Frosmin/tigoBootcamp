import { logger } from '../infrastructure/logger.js';
import config from '../utils/config.js';
import {
  claimOutboxBatch, markOutboxPublished, releaseOutboxEvents
} from '../repositories/outbox.repository.js';
import { publishOutboxEvents } from '../queues/notification.queue.js';

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export class OutboxPublisher {
  constructor() { this.running = false; }

  async publishOnce() {
    const events = await claimOutboxBatch(config.OUTBOX_BATCH_SIZE, config.OUTBOX_LEASE_MS);
    if (!events.length) return 0;
    const groups = Object.groupBy(events, (event) => event.channel);
    for (const channelEvents of Object.values(groups)) {
      const ids = channelEvents.map((event) => event.id);
      try {
        await publishOutboxEvents(channelEvents);
        await markOutboxPublished(ids);
      } catch (error) {
        logger.error({ '[OUTBOX PUBLISH ERROR]': error.message, '[COUNT]': ids.length });
        await releaseOutboxEvents(ids, error.message);
      }
    }
    return events.length;
  }

  async run() {
    this.running = true;
    while (this.running) {
      try {
        const count = await this.publishOnce();
        if (count === 0) await wait(config.OUTBOX_POLL_INTERVAL_MS);
      } catch (error) {
        logger.error({ '[OUTBOX LOOP ERROR]': error.message });
        await wait(config.OUTBOX_POLL_INTERVAL_MS);
      }
    }
  }

  stop() { this.running = false; }
}
