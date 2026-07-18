BEGIN;

CREATE TABLE IF NOT EXISTS plantilla (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    canal VARCHAR(50) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
    contenido TEXT NOT NULL,
    variables VARCHAR(100)[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMPTZ,
    CONSTRAINT ck_plantilla_nombre_no_vacio CHECK (BTRIM(nombre) <> ''),
    CONSTRAINT ck_plantilla_contenido_no_vacio CHECK (BTRIM(contenido) <> ''),
    CONSTRAINT ck_plantilla_variables_sin_nulos CHECK (ARRAY_POSITION(variables, NULL) IS NULL)
);

ALTER TABLE plantilla ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE plantilla DROP CONSTRAINT IF EXISTS uq_plantilla_nombre_canal;
CREATE UNIQUE INDEX IF NOT EXISTS uq_plantilla_nombre_canal_activa
    ON plantilla (nombre, canal) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS notificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canal VARCHAR(50) NOT NULL CHECK (canal IN ('EMAIL', 'SMS')),
    destinatario VARCHAR(255) NOT NULL,
    plantilla_id BIGINT NOT NULL REFERENCES plantilla(id) ON DELETE RESTRICT,
    variables JSONB NOT NULL CHECK (JSONB_TYPEOF(variables) = 'object'),
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    estado VARCHAR(50) NOT NULL DEFAULT 'ENCOLADA' CHECK (estado IN ('ENCOLADA', 'ENVIADA', 'FALLIDA')),
    intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    generacion INTEGER NOT NULL DEFAULT 1 CHECK (generacion > 0),
    asunto VARCHAR(255) NOT NULL DEFAULT '',
    contenido_renderizado TEXT NOT NULL DEFAULT '',
    processing_token VARCHAR(100),
    processing_started_at TIMESTAMPTZ,
    provider_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_notificacion_destinatario_no_vacio CHECK (BTRIM(destinatario) <> '')
);

ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS generacion INTEGER NOT NULL DEFAULT 1;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS asunto VARCHAR(255) NOT NULL DEFAULT '';
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS contenido_renderizado TEXT NOT NULL DEFAULT '';
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS processing_token VARCHAR(100);
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS provider_message_id VARCHAR(255);
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE notificacion ADD COLUMN IF NOT EXISTS last_error TEXT;

CREATE TABLE IF NOT EXISTS intento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notificacion_id BIGINT NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL CHECK (numero > 0),
    generacion INTEGER NOT NULL DEFAULT 1,
    resultado VARCHAR(20) NOT NULL CHECK (resultado IN ('EXITOSO', 'FALLIDO')),
    detalle TEXT,
    error_code VARCHAR(100),
    retryable BOOLEAN NOT NULL DEFAULT FALSE,
    duration_ms INTEGER,
    provider_message_id VARCHAR(255),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_intento_notificacion_numero UNIQUE (notificacion_id, numero)
);

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

CREATE INDEX IF NOT EXISTS idx_notificacion_plantilla_id ON notificacion(plantilla_id);
CREATE INDEX IF NOT EXISTS idx_notificacion_estado_canal_created
    ON notificacion(estado, canal, created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_notificacion_created ON notificacion(created_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_intento_notificacion_id ON intento(notificacion_id, numero);
CREATE INDEX IF NOT EXISTS idx_outbox_pending
    ON outbox_event(available_at, id) WHERE status = 'PENDING';

COMMIT;
