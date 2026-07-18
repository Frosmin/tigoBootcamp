# P07 - Notificaciones

Microservicio Node.js 22 para enviar notificaciones desde plantillas. PostgreSQL
es la fuente de verdad, un transactional outbox desacopla la API de Redis y
BullMQ ejecuta envíos, límites de throughput y reintentos con backoff.

## Procesos

- `npm run start:api`: API REST; requiere PostgreSQL, pero no Redis.
- `npm run start:outbox`: publica eventos PostgreSQL en BullMQ por lotes.
- `npm run start:worker`: consume el canal indicado por `WORKER_CHANNEL`.

Cada worker expone `GET /ready` en `WORKER_HEALTH_PORT` y comprueba PostgreSQL,
Redis y el proveedor configurado. Docker usa ese endpoint para no declarar sana
una réplica que no puede entregar mensajes.

`docker compose up --build` inicia PostgreSQL, Redis, API, outbox y worker EMAIL.
Sin `.env` usa el proveedor fake para desarrollo. Para Gmail, copiar
`.env.example` a `.env`, usar `DELIVERY_PROVIDER=smtp` y reemplazar las
credenciales de ejemplo.

Para una base P07 existente, ejecutar primero la migración no destructiva:

```bash
psql "$P_DB_CONNECTION_STRING" -v ON_ERROR_STOP=1 -f migrations/001_bullmq_outbox.sql
```

`tablas.sql` queda como esquema idempotente para instalaciones nuevas; ninguno de
los dos flujos elimina tablas ni datos.

## API

| Método | Ruta | Descripción |
|---|---|---|
| GET | `/api/v1/health` | Liveness. |
| GET | `/api/v1/ready` | Readiness PostgreSQL de la API. |
| POST | `/api/v1/templates` | Crea una plantilla. |
| PUT | `/api/v1/templates/{id}` | Reemplaza una plantilla activa. |
| DELETE | `/api/v1/templates/{id}` | Borrado lógico. |
| POST | `/api/v1/notifications` | Persiste `ENCOLADA` y outbox; requiere `Idempotency-Key`. |
| GET | `/api/v1/notifications/{id}` | Estado e historial de intentos. |
| GET | `/api/v1/notifications?canal&estado&limit&cursor` | Historial con cursor. |
| POST | `/api/v1/notifications/{id}/retry` | Reintento manual de una `FALLIDA`. |

Las plantillas usan placeholders `{{variable}}`. La lista `variables` debe
coincidir exactamente con los placeholders y el payload del envío debe contener
exactamente esas claves. El nombre de la plantilla se usa como asunto y el
contenido renderizado queda congelado al aceptar la solicitud.

## Consistencia y recuperación

Notificación y outbox se insertan en una transacción. El publicador reclama filas
con `FOR UPDATE SKIP LOCKED`, usa `Queue.addBulk()` y jobs deterministas
`notification-{id}-g{generacion}`. Si cae después de publicar y antes de marcar el
outbox, la repetición es deduplicada por BullMQ y por la guarda PostgreSQL.

SMTP no ofrece exactly-once transaccional. Un crash después del ACK SMTP y antes
del commit puede producir una repetición; se reduce el riesgo con `Message-ID`
determinista, leases y la prohibición de reenviar estados `ENVIADA`.

SMS está modelado como conector futuro. Con `SMS_ENABLED=false`, la API devuelve
`503` antes de persistir una solicitud SMS. Para pruebas, usar
`DELIVERY_PROVIDER=fake`; destinatarios que contienen `temporary-failure` o
`permanent-failure` simulan esos resultados.

## Calidad

```bash
npm test
npm run coverage
npm run test:integration
docker compose config
k6 run test/load/notifications.k6.js
```

La cobertura falla por debajo de 85%. El contrato completo está en
`docs/openapi.yaml`, los controles en `docs/nist.md` y los escenarios en
`docs/test-cases.md`.
