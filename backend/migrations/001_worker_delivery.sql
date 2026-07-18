ALTER TABLE notificacion
    ADD COLUMN IF NOT EXISTS next_attempt_at TIMESTAMP WITH TIME ZONE;

ALTER TABLE intento
    ADD COLUMN IF NOT EXISTS numero INTEGER,
    ADD COLUMN IF NOT EXISTS detalle TEXT;

WITH numbered AS (
    SELECT id,
           ROW_NUMBER() OVER (
               PARTITION BY notificacion_id
               ORDER BY timestamp, id
           ) AS attempt_number
    FROM intento
    WHERE numero IS NULL
)
UPDATE intento AS target
SET numero = numbered.attempt_number
FROM numbered
WHERE target.id = numbered.id;

ALTER TABLE intento
    ALTER COLUMN numero SET NOT NULL,
    ALTER COLUMN resultado TYPE VARCHAR(20);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'uq_intento_notificacion_numero'
    ) THEN
        ALTER TABLE intento
            ADD CONSTRAINT uq_intento_notificacion_numero
            UNIQUE (notificacion_id, numero);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'ck_intento_resultado'
    ) THEN
        ALTER TABLE intento
            ADD CONSTRAINT ck_intento_resultado
            CHECK (resultado IN ('EXITOSO', 'FALLIDO'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_notificacion_next_attempt_at
    ON notificacion(next_attempt_at)
    WHERE estado = 'ENCOLADA';
