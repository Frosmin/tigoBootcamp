DROP TABLE IF EXISTS intento CASCADE;
DROP TABLE IF EXISTS notificacion CASCADE;
DROP TABLE IF EXISTS plantilla CASCADE;

CREATE TABLE plantilla (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    canal VARCHAR(50) NOT NULL,
    contenido TEXT NOT NULL,
    variables VARCHAR(100)[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_plantilla_nombre_canal UNIQUE (nombre, canal),
    CONSTRAINT ck_plantilla_nombre_no_vacio CHECK (BTRIM(nombre) <> ''),
    CONSTRAINT ck_plantilla_canal CHECK (canal IN ('EMAIL', 'SMS')),
    CONSTRAINT ck_plantilla_contenido_no_vacio CHECK (BTRIM(contenido) <> ''),
    CONSTRAINT ck_plantilla_variables_sin_nulos CHECK (
        ARRAY_POSITION(variables, NULL) IS NULL
    )
);


CREATE TABLE notificacion (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    canal VARCHAR(50) NOT NULL,
    destinatario VARCHAR(255) NOT NULL,
    plantilla_id BIGINT NOT NULL REFERENCES plantilla(id) ON DELETE RESTRICT,
    estado VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    intentos INTEGER NOT NULL DEFAULT 0 CHECK (intentos >= 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE TABLE intento (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    notificacion_id BIGINT NOT NULL REFERENCES notificacion(id) ON DELETE CASCADE,
    resultado TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);


CREATE INDEX idx_notificacion_plantilla_id ON notificacion(plantilla_id);
CREATE INDEX idx_notificacion_estado ON notificacion(estado);
CREATE INDEX idx_intento_notificacion_id ON intento(notificacion_id);
