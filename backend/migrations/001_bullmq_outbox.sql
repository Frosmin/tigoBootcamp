-- Migración no destructiva desde el esquema P07 original.
-- Es idempotente y puede ejecutarse de nuevo después de un despliegue interrumpido.
BEGIN;

CREATE TABLE IF NOT EXISTS schema_migration (
    version VARCHAR(100) PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE plantilla ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE plantilla DROP CONSTRAINT IF EXISTS uq_plantilla_nombre_canal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_plantilla_nombre_canal_activa
    ON plantilla (nombre, canal) WHERE deleted_at IS NULL;

ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS generacion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS asunto VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS contenido_renderizado TEXT NOT NULL DEFAULT '';
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS processing_token VARCHAR(100);
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS last_error TEXT;

-- Congela una representación razonable para registros preexistentes. Las nuevas
-- notificaciones siempre se renderizan antes de insertarse.
DO $$
DECLARE
    current_notification RECORD;
    variable RECORD;
    rendered TEXT;
BEGIN
    FOR current_notification IN
        SELECT n.id, n.variables, p.nombre, p.contenido
        FROM notificacion n
        JOIN plantilla p ON p.id = n.plantilla_id
        WHERE n.contenido_renderizado = ''
    LOOP
        rendered := current_notification.contenido;
        FOR variable IN SELECT key, value FROM jsonb_each_text(current_notification.variables)
        LOOP
            rendered := REPLACE(rendered, '{{' || variable.key || '}}', variable.value);
            rendered := REPLACE(rendered, '{{ ' || variable.key || ' }}', variable.value);
        END LOOP;
        UPDATE notificacion
        SET asunto = current_notification.nombre,
            contenido_renderizado = rendered
        WHERE id = current_notification.id;
    END LOOP;
END $$;

ALTER TABLE intento ADD COLUMN IF NOT EXISTS generacion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE intento ADD COLUMN IF NOT EXISTS error_code VARCHAR(100);
ALTER TABLE intento ADD COLUMN IF NOT EXISTS retryable BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE intento ADD COLUMN IF NOT EXISTS duration_ms INTEGER;
ALTER TABLE intento ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);

CREATE TABLE IF NOT EXISTS outbox_event (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    aggregate_id BIGINT NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    generation INTEGER NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('EMAIL', 'SMS')),
    event_type VARCHAR(100) NOT NULL DEFAULT 'NOTIFICATION_REQUESTED',
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PUBLISHED')),
    publish_attempts INTEGER NOT NULL DEFAULT 0,
    available_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    locked_until TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_outbox_notification_generation UNIQUE (aggregate_id, generation)
);

CREATE INDEX IF NOT EXISTS idx_notificacion_estado_canal_created
    ON notificacion(estado, canal, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notificacion_created
    ON notificacion(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_intento_notificacion_id
    ON intento(notificacion_id, numero);
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_event(available_at, id) WHERE status = 'PENDING';

INSERT INTO schema_migration(version) VALUES ('001_bullmq_outbox')
ON CONFLICT (version) DO NOTHING;

COMMIT;
