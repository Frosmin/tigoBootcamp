CREATE TABLE IF NOT EXISTS notification_outbox (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notification_id BIGINT NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    published_at TIMESTAMP WITH TIME ZONE,
    publish_attempts INTEGER NOT NULL DEFAULT 0 CHECK (publish_attempts >= 0),
    available_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_pending
    ON notification_outbox(available_at, id)
    WHERE published_at IS NULL;

INSERT INTO notification_outbox (notification_id)
SELECT notificacion.id
FROM notificacion
WHERE notificacion.estado = 'ENCOLADA'
  AND NOT EXISTS (
      SELECT 1
      FROM notification_outbox
      WHERE notification_outbox.notification_id = notificacion.id
  );
