import { executeQuery } from '@tigo/postgres-connector';

const COLUMNS = 'id, nombre, canal, contenido, variables';

export const insertTemplate = async ({ nombre, canal, contenido, variables }) => {
  const query = `
    INSERT INTO plantilla (nombre, canal, contenido, variables)
    VALUES ($1::varchar, $2::varchar, $3::text, $4::varchar[])
    ON CONFLICT (nombre, canal) DO NOTHING
    RETURNING ${COLUMNS};
  `;

  const rows = await executeQuery(query, [nombre, canal, contenido, variables]);
  return rows[0];
};

export const findTemplateById = async (id) => {
  const query = `
    SELECT ${COLUMNS}
    FROM plantilla
    WHERE id = $1::bigint;
  `;
  const rows = await executeQuery(query, [id]);
  return rows[0];
};
