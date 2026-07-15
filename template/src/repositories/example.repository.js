import { executeQuery } from '@tigo/postgres-connector';

/**
 * Capa de acceso a datos del recurso `example`.
 * Aisla el SQL del resto de la aplicacion. Todas las consultas usan
 * parametros ($1, $2, ...) para evitar inyeccion SQL.
 */

const TABLE = 'example';

const COLUMNS = `
  id, name, description, quantity, price, active,
  registration_date, created_at, updated_at
`;

export const insertExample = async ({ name, description, quantity, price, active, registration_date }) => {
  const query = `
    INSERT INTO ${TABLE} (name, description, quantity, price, active, registration_date)
    VALUES (
      $1::varchar,
      $2::varchar,
      COALESCE($3::integer, 0),
      COALESCE($4::numeric, 0),
      COALESCE($5::boolean, TRUE),
      COALESCE($6::date, CURRENT_DATE)
    )
    RETURNING ${COLUMNS};
  `;
  const params = [
    name,
    description ?? null,
    quantity ?? null,
    price ?? null,
    active ?? null,
    registration_date ?? null
  ];
  const rows = await executeQuery(query, params);
  return rows[0];
};

export const selectExampleById = async (id) => {
  const query = `SELECT ${COLUMNS} FROM ${TABLE} WHERE id = $1;`;
  const rows = await executeQuery(query, [id]);
  return rows[0];
};
