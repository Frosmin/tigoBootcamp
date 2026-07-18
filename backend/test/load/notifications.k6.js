import http from 'k6/http';
import { check } from 'k6';
import { Trend } from 'k6/metrics';

const baseUrl = __ENV.BASE_URL || 'http://localhost:3050/api/v1';
const acceptedLatency = new Trend('notification_accept_latency', true);

export const options = {
  scenarios: {
    api_load: {
      executor: 'ramping-vus',
      stages: [
        { duration: '20s', target: 20 },
        { duration: '40s', target: 20 },
        { duration: '20s', target: 0 }
      ]
    }
  },
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
    notification_accept_latency: ['p(95)<500']
  }
};

export function setup() {
  const name = `k6-template-${Date.now()}`;
  const response = http.post(`${baseUrl}/templates`, JSON.stringify({
    nombre: name,
    canal: 'EMAIL',
    contenido: 'Hola {{nombre}}',
    variables: ['nombre']
  }), { headers: { 'Content-Type': 'application/json' } });
  check(response, { 'template created': (r) => r.status === 201 });
  return { templateId: response.json('id') };
}

export default function ({ templateId }) {
  const unique = `${__VU}-${__ITER}-${Date.now()}`;
  const response = http.post(`${baseUrl}/notifications`, JSON.stringify({
    canal: 'EMAIL',
    destinatario: `load-${unique}@example.com`,
    plantillaId: Number(templateId),
    variables: { nombre: unique }
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': `k6-${unique}`
    }
  });
  acceptedLatency.add(response.timings.duration);
  check(response, { 'notification accepted': (r) => r.status === 202 });
  const notificationId = response.json('id');
  if (__ITER % 3 === 0 && notificationId) {
    check(http.get(`${baseUrl}/notifications/${notificationId}`), {
      'notification queried': (r) => r.status === 200
    });
  }
  if (__ITER % 5 === 0) {
    check(http.get(`${baseUrl}/notifications?canal=EMAIL&limit=20`), {
      'history listed': (r) => r.status === 200
    });
  }
}

export function teardown({ templateId }) {
  if (templateId) http.del(`${baseUrl}/templates/${templateId}`);
}
