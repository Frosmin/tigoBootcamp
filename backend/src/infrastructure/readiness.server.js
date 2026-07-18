import { createServer } from 'node:http';

const respond = (res, statusCode, body) => {
  res.writeHead(statusCode, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
};

export const startReadinessServer = ({ port, check }) => new Promise((resolve, reject) => {
  const server = createServer(async (req, res) => {
    if (req.url !== '/ready') {
      respond(res, 404, { status: 'NOT_FOUND' });
      return;
    }
    try {
      const dependencies = await check();
      respond(res, 200, { status: 'READY', ...dependencies });
    } catch {
      respond(res, 503, { status: 'NOT_READY' });
    }
  });
  server.once('error', reject);
  server.listen(port, '0.0.0.0', () => resolve(server));
});

export const closeReadinessServer = (server) => new Promise((resolve, reject) => {
  server.close((error) => error ? reject(error) : resolve());
});
