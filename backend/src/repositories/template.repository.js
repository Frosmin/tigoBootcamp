import { executeQuery } from '../infrastructure/postgres.client.js';

const COLUMNS = `id, nombre, canal, contenido, variables,
  created_at AS "createdAt", updated_at AS "updatedAt"`;

export const insertTemplate = async ({ nombre, canal, contenido, variables }) => {
  const rows = await executeQuery(`
    INSERT INTO plantilla (nombre, canal, contenido, variables)
    VALUES ($1::varchar, $2::varchar, $3::text, $4::varchar[])
    ON CONFLICT (nombre, canal) WHERE deleted_at IS NULL DO NOTHING
    RETURNING ${COLUMNS};
  `, [nombre, canal, contenido, variables]);
  return rows[0];
};

export const findTemplateById = async (id) => {
  const rows = await executeQuery(`
    SELECT ${COLUMNS} FROM plantilla
    WHERE id = $1::bigint AND deleted_at IS NULL;
  `, [id]);
  return rows[0];
};

export const updateTemplate = async (id, { nombre, canal, contenido, variables }) => {
  const rows = await executeQuery(`
    UPDATE plantilla
    SET nombre=$2::varchar, canal=$3::varchar, contenido=$4::text,
        variables=$5::varchar[], updated_at=CURRENT_TIMESTAMP
    WHERE id=$1::bigint AND deleted_at IS NULL
      AND NOT EXISTS (
        SELECT 1 FROM plantilla other
        WHERE other.nombre=$2::varchar AND other.canal=$3::varchar
          AND other.deleted_at IS NULL AND other.id <> $1::bigint
      )
    RETURNING ${COLUMNS};
  `, [id, nombre, canal, contenido, variables]);
  return rows[0];
};

export const softDeleteTemplate = async (id) => {
  const rows = await executeQuery(`
    UPDATE plantilla SET deleted_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
    WHERE id=$1::bigint AND deleted_at IS NULL RETURNING id;
  `, [id]);
  return rows[0];
};
