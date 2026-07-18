import { executeQuery } from '../infrastructure/postgres.client.js';
import { withTransaction } from '../infrastructure/postgres.transaction.js';

const COLUMNS = `
  id, canal, destinatario, plantilla_id AS "plantillaId", variables,
  estado, intentos, generacion, asunto,
  provider_message_id AS "providerMessageId", sent_at AS "sentAt",
  last_error AS "lastError", created_at AS "createdAt", updated_at AS "updatedAt"
`;

const insertOutbox = async (tx, notification, attemptsAllowed) => {
  await tx.execute(`
    INSERT INTO outbox_event (aggregate_id, generation, channel, payload)
    VALUES ($1::bigint, $2::integer, $3::varchar, $4::jsonb)
    ON CONFLICT (aggregate_id, generation) DO NOTHING;
  `, [notification.id, notification.generacion, notification.canal, JSON.stringify({
    notificationId: String(notification.id),
    generation: notification.generacion,
    channel: notification.canal,
    attemptsAllowed
  })]);
};

export const insertNotification = async ({
  canal, destinatario, plantillaId, variables, idempotencyKey,
  asunto, contenidoRenderizado, attemptsAllowed
}) => withTransaction(async (tx) => {
  const rows = await tx.execute(`
    INSERT INTO notificacion (
      canal, destinatario, plantilla_id, variables, idempotency_key, asunto, contenido_renderizado
    ) VALUES ($1::varchar, $2::varchar, $3::bigint, $4::jsonb, $5::varchar, $6::varchar, $7::text)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING ${COLUMNS};
  `, [canal, destinatario, plantillaId, JSON.stringify(variables), idempotencyKey, asunto, contenidoRenderizado]);
  if (!rows[0]) return undefined;
  await insertOutbox(tx, rows[0], attemptsAllowed);
  return rows[0];
});

export const findNotificationByIdempotencyKey = async (idempotencyKey) => {
  const rows = await executeQuery(`SELECT ${COLUMNS} FROM notificacion WHERE idempotency_key=$1::varchar;`, [idempotencyKey]);
  return rows[0];
};

export const findNotificationById = async (id) => {
  const rows = await executeQuery(`SELECT ${COLUMNS} FROM notificacion WHERE id=$1::bigint;`, [id]);
  return rows[0];
};

export const listNotifications = async ({ canal, estado, limit, cursor }) => {
  const params = [];
  const conditions = [];
  if (canal) { params.push(canal); conditions.push(`canal=$${params.length}::varchar`); }
  if (estado) { params.push(estado); conditions.push(`estado=$${params.length}::varchar`); }
  if (cursor) {
    params.push(cursor.createdAt, cursor.id);
    conditions.push(`(created_at, id) < ($${params.length - 1}::timestamptz, $${params.length}::bigint)`);
  }
  params.push(limit + 1);
  return executeQuery(`
    SELECT ${COLUMNS} FROM notificacion
    ${conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''}
    ORDER BY created_at DESC, id DESC LIMIT $${params.length}::integer;
  `, params);
};

export const scheduleNotificationRetry = async (id, maxAttempts, autoAttempts) => withTransaction(async (tx) => {
  const rows = await tx.execute(`SELECT ${COLUMNS} FROM notificacion WHERE id=$1::bigint FOR UPDATE;`, [id]);
  const notification = rows[0];
  if (!notification) return { reason: 'NOT_FOUND' };
  if (notification.estado !== 'FALLIDA') return { reason: 'INVALID_STATE', notification };
  if (notification.intentos >= maxAttempts) return { reason: 'MAX_ATTEMPTS', notification };
  const remaining = maxAttempts - notification.intentos;
  const updatedRows = await tx.execute(`
    UPDATE notificacion SET estado='ENCOLADA', generacion=generacion+1,
      processing_token=NULL, processing_started_at=NULL, last_error=NULL, updated_at=CURRENT_TIMESTAMP
    WHERE id=$1::bigint RETURNING ${COLUMNS};
  `, [id]);
  const updated = updatedRows[0];
  await insertOutbox(tx, updated, Math.min(autoAttempts, remaining));
  return { notification: updated };
});

export const claimNotificationForDelivery = async (id, generation, token, leaseMs) => {
  const rows = await executeQuery(`
    UPDATE notificacion SET processing_token=$3::varchar, processing_started_at=CURRENT_TIMESTAMP,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=$1::bigint AND generacion=$2::integer AND estado='ENCOLADA'
      AND (processing_token IS NULL OR processing_started_at < CURRENT_TIMESTAMP - ($4::integer * INTERVAL '1 millisecond'))
    RETURNING ${COLUMNS}, contenido_renderizado AS "contenidoRenderizado";
  `, [id, generation, token, leaseMs]);
  return rows[0];
};

export const recordDeliveryResult = async ({
  id, generation, token, success, terminal, detail, errorCode,
  retryable, durationMs, providerMessageId
}) => withTransaction(async (tx) => {
  const locked = await tx.execute(`
    SELECT intentos FROM notificacion
    WHERE id=$1::bigint AND generacion=$2::integer AND processing_token=$3::varchar
    FOR UPDATE;
  `, [id, generation, token]);
  if (!locked[0]) return undefined;
  const attemptNumber = locked[0].intentos + 1;
  await tx.execute(`
    INSERT INTO intento (
      notificacion_id, numero, generacion, resultado, detalle, error_code,
      retryable, duration_ms, provider_message_id
    ) VALUES ($1::bigint,$2::integer,$3::integer,$4::varchar,$5::text,$6::varchar,$7::boolean,$8::integer,$9::varchar);
  `, [id, attemptNumber, generation, success ? 'EXITOSO' : 'FALLIDO', detail, errorCode,
    retryable, durationMs, providerMessageId]);
  const state = success ? 'ENVIADA' : (terminal ? 'FALLIDA' : 'ENCOLADA');
  const rows = await tx.execute(`
    UPDATE notificacion SET estado=$4::varchar, intentos=$5::integer,
      processing_token=NULL, processing_started_at=NULL,
      provider_message_id=COALESCE($6::varchar, provider_message_id),
      sent_at=CASE WHEN $4::varchar='ENVIADA' THEN CURRENT_TIMESTAMP ELSE sent_at END,
      last_error=CASE WHEN $4::varchar='ENVIADA' THEN NULL ELSE $7::text END,
      updated_at=CURRENT_TIMESTAMP
    WHERE id=$1::bigint AND generacion=$2::integer AND processing_token=$3::varchar
    RETURNING ${COLUMNS};
  `, [id, generation, token, state, attemptNumber, providerMessageId, detail]);
  return rows[0];
});
