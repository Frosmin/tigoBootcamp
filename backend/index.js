import 'dotenv/config';
import { initializeDB } from '@tigo/postgres-connector';
import app from './src/app.js';
import { initializeRedisClient } from './src/infrastructure/redis.client.js';

const PORT = process.env.PORT || 3000;

// Inicializa el pool de conexiones a Postgres antes de aceptar trafico.
await initializeDB();
await initializeRedisClient();

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
