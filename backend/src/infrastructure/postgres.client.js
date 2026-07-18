import pg from 'pg';

const { Pool } = pg;
let pool;

const databaseConfig = () => process.env.P_DB_CONNECTION_STRING
  ? {
      connectionString: process.env.P_DB_CONNECTION_STRING,
      max: Number(process.env.P_DB_MAX_CONNECTIONS || 20)
    }
  : {
      host: process.env.P_DB_HOST,
      port: Number(process.env.P_DB_PORT || 5432),
      database: process.env.P_DB_NAME,
      user: process.env.P_DB_USER,
      password: process.env.P_DB_PASSWORD,
      max: Number(process.env.P_DB_MAX_CONNECTIONS || 20)
    };

export const initializeDB = async () => {
  if (pool) return pool;
  const candidate = new Pool(databaseConfig());
  const client = await candidate.connect();
  client.release();
  pool = candidate;
  return pool;
};

export const getDB = () => {
  if (!pool) throw new Error('PostgreSQL is not initialized');
  return { getConnection: () => pool.connect() };
};

export const executeQuery = async (query, params = []) => {
  const client = await getDB().getConnection();
  try {
    return (await client.query(query, params)).rows;
  } finally {
    client.release();
  }
};

export const closeAllConnections = async () => {
  const activePool = pool;
  pool = undefined;
  if (activePool) await activePool.end();
};
