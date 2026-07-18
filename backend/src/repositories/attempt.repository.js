import { executeQuery } from '@tigo/postgres-connector';

export const findAttemptsByNotificationId = async (notificationId) => {
  const query = `
    SELECT
      id,
      notificacion_id AS "notificationId",
      numero,
      resultado,
      detalle,
      timestamp
    FROM intento
    WHERE notificacion_id = $1::bigint
    ORDER BY numero ASC;
  `;
  return executeQuery(query, [notificationId]);
};

export const recordDeliveryAttempt = async ({
  notificationId,
  result,
  detail,
  state,
  nextAttemptAt = null
}) => {
  const query = `
    WITH updated AS (
      UPDATE notificacion
      SET
        intentos = intentos + 1,
        estado = $2::varchar,
        next_attempt_at = $3::timestamptz,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1::bigint AND estado = 'ENCOLADA'
      RETURNING intentos, estado, next_attempt_at
    ), inserted AS (
      INSERT INTO intento (
        notificacion_id, numero, resultado, detalle
      )
      SELECT $1::bigint, intentos, $4::varchar, $5::text
      FROM updated
      RETURNING id, numero, resultado, detalle, timestamp
    )
    SELECT
      inserted.id AS "attemptId",
      inserted.numero,
      inserted.resultado,
      inserted.detalle,
      inserted.timestamp,
      updated.estado,
      updated.next_attempt_at AS "nextAttemptAt"
    FROM inserted
    CROSS JOIN updated;
  `;
  const rows = await executeQuery(query, [
    notificationId,
    state,
    nextAttemptAt,
    result,
    detail
  ]);
  return rows[0];
};
