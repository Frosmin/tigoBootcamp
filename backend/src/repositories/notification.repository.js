import { executeQuery } from '@tigo/postgres-connector';

const COLUMNS = `
  id,
  canal,
  destinatario,
  plantilla_id AS "plantillaId",
  variables,
  estado,
  intentos,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

export const insertNotification = async ({
  canal,
  destinatario,
  plantillaId,
  variables,
  idempotencyKey
}) => {
  const query = `
    INSERT INTO notificacion (
      canal, destinatario, plantilla_id, variables, idempotency_key
    )
    VALUES ($1::varchar, $2::varchar, $3::bigint, $4::jsonb, $5::varchar)
    ON CONFLICT (idempotency_key) DO NOTHING
    RETURNING ${COLUMNS};
  `;
  const rows = await executeQuery(query, [
    canal,
    destinatario,
    plantillaId,
    JSON.stringify(variables),
    idempotencyKey
  ]);
  return rows[0];
};

export const findNotificationByIdempotencyKey = async (idempotencyKey) => {
  const query = `
    SELECT ${COLUMNS}
    FROM notificacion
    WHERE idempotency_key = $1::varchar;
  `;
  const rows = await executeQuery(query, [idempotencyKey]);
  return rows[0];
};

export const findNotificationById = async (id) => {
  const query = `
    SELECT ${COLUMNS}
    FROM notificacion
    WHERE id = $1::bigint;
  `;
  const rows = await executeQuery(query, [id]);
  return rows[0];
};

export const deleteNotificationAfterQueueFailure = async (id, idempotencyKey) => {
  const query = `
    DELETE FROM notificacion
    WHERE id = $1::bigint AND idempotency_key = $2::varchar;
  `;
  await executeQuery(query, [id, idempotencyKey]);
};
