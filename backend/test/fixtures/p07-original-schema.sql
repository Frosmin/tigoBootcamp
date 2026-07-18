CREATE TABLE plantilla (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    canal VARCHAR(50) NOT NULL,
    contenido TEXT NOT NULL,
    variables VARCHAR(100)[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plantilla_nombre_canal UNIQUE (nombre, canal),
    CONSTRAINT ck_plantilla_canal CHECK (canal IN ('EMAIL', 'SMS'))
);

CREATE TABLE notificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canal VARCHAR(50) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    plantilla_id BIGINT NOT NULL REFERENCES plantilla(id) ON DELETE RESTRICT,
    variables JSONB NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    estado VARCHAR(50) NOT NULL DEFAULT 'ENCOLADA',
    intentos INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE intento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notificacion_id BIGINT NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    numero INTEGER NOT NULL,
    resultado VARCHAR(20) NOT NULL,
    detalle TEXT,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_intento_notificacion_numero UNIQUE (notificacion_id, numero)
);

CREATE INDEX idx_notificacion_plantilla_id ON notificacion(plantilla_id);
CREATE INDEX idx_notificacion_estado ON notificacion(estado);
CREATE INDEX idx_intento_notificacion_id ON intento(notificacion_id);

INSERT INTO plantilla(nombre, canal, contenido, variables)
VALUES ('Bienvenida', 'EMAIL', 'Hola {{nombre}}', ARRAY['nombre']);

INSERT INTO notificacion(canal, destinatario, plantilla_id, variables, idempotency_key)
VALUES ('EMAIL', 'legacy@example.com', 1, '{"nombre":"Ana"}', 'legacy-request-1');
