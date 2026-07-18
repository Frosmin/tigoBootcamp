import 'dotenv/config';
import { closeAllConnections, initializeDB } from './src/infrastructure/postgres.client.js';
import app from './src/app.js';
import config from './src/utils/config.js';

await initializeDB();
const server = app.listen(config.PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${config.PORT}`);
});

const shutdown = async () => {
  server.close(async () => {
    await closeAllConnections();
    process.exit(0);
  });
};
process.once('SIGTERM', shutdown);
process.once('SIGINT', shutdown);
