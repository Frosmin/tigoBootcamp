import { executeQuery } from '../infrastructure/postgres.client.js';

export const findAttemptsByNotificationId = async (notificationId) => executeQuery(`
  SELECT id, notificacion_id AS "notificationId", numero, generacion, resultado,
    detalle, error_code AS "errorCode", retryable, duration_ms AS "durationMs",
    provider_message_id AS "providerMessageId", timestamp
  FROM intento WHERE notificacion_id=$1::bigint ORDER BY numero ASC;
`, [notificationId]);
