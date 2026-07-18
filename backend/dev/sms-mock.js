import http from 'node:http';

const port = Number(process.env.SMS_MOCK_PORT || 4010);
const token = process.env.SMS_PROVIDER_TOKEN || 'dev-sms-token';

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== '/messages') {
    response.writeHead(404).end();
    return;
  }
  if (request.headers.authorization !== `Bearer ${token}`) {
    response.writeHead(401).end('invalid token');
    return;
  }
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    try {
      const message = JSON.parse(body);
      response.writeHead(202, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ messageId: message.messageId, simulated: true }));
    } catch {
      response.writeHead(400).end('invalid JSON');
    }
  });
});

server.listen(port, () => console.log(`Development SMS simulator on port ${port}`));
