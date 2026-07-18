import { executeQuery, getDB } from './postgres.client.js';

export const withTransaction = async (work) => {
  const client = await getDB().getConnection();
  try {
    await client.query('BEGIN');
    const transaction = {
      execute: async (query, params = []) => (await client.query(query, params)).rows
    };
    const result = await work(transaction);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
};

export const checkPostgres = async () => {
  await executeQuery('SELECT 1 AS healthy;');
  return true;
};
