import http from 'node:http';

const port = Number(process.env.SMS_MOCK_PORT || 4010);
const accountSid = process.env.TWILIO_ACCOUNT_SID || `AC${'0'.repeat(32)}`;
const authToken = process.env.TWILIO_AUTH_TOKEN || 'dev-twilio-token';
const expectedAuthorization = `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString('base64')}`;
const messagePath = `/2010-04-01/Accounts/${accountSid}/Messages.json`;

const server = http.createServer((request, response) => {
  if (request.method !== 'POST' || request.url !== messagePath) {
    response.writeHead(404).end();
    return;
  }
  if (request.headers.authorization !== expectedAuthorization) {
    response.writeHead(401, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ code: 20003, message: 'Authentication Error', status: 401 }));
    return;
  }
  let body = '';
  request.on('data', (chunk) => { body += chunk; });
  request.on('end', () => {
    const message = new URLSearchParams(body);
    if (!message.get('To') || !message.get('From') || !message.get('Body')) {
      response.writeHead(400, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ code: 21602, message: 'Message body is required', status: 400 }));
      return;
    }
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({
      sid: `SM${'0'.repeat(32)}`,
      status: 'queued',
      to: message.get('To'),
      from: message.get('From'),
      body: message.get('Body'),
      simulated: true
    }));
  });
});

server.listen(port, () => console.log(`Development Twilio SMS simulator on port ${port}`));
