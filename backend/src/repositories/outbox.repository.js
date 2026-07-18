import { executeQuery } from '../infrastructure/postgres.client.js';

export const claimOutboxBatch = async (batchSize, leaseMs) => executeQuery(`
  WITH candidates AS (
    SELECT id FROM outbox_event
    WHERE status='PENDING' AND available_at <= CURRENT_TIMESTAMP
      AND (locked_until IS NULL OR locked_until < CURRENT_TIMESTAMP)
    ORDER BY id ASC FOR UPDATE SKIP LOCKED LIMIT $1::integer
  )
  UPDATE outbox_event event SET
    locked_until=CURRENT_TIMESTAMP + ($2::integer * INTERVAL '1 millisecond'),
    publish_attempts=publish_attempts+1
  FROM candidates WHERE event.id=candidates.id
  RETURNING event.id, event.aggregate_id AS "aggregateId", event.generation,
    event.channel, event.payload;
`, [batchSize, leaseMs]);

export const markOutboxPublished = async (ids) => {
  if (!ids.length) return;
  await executeQuery(`
    UPDATE outbox_event SET status='PUBLISHED', published_at=CURRENT_TIMESTAMP,
      locked_until=NULL, last_error=NULL WHERE id=ANY($1::bigint[]);
  `, [ids]);
};

export const releaseOutboxEvents = async (ids, error) => {
  if (!ids.length) return;
  await executeQuery(`
    UPDATE outbox_event SET locked_until=NULL, available_at=CURRENT_TIMESTAMP + INTERVAL '1 second',
      last_error=$2::text WHERE id=ANY($1::bigint[]);
  `, [ids, String(error).slice(0, 2000)]);
};
