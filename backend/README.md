# P07 - Microservicio de notificaciones

API Node.js para administrar plantillas, crear y consultar notificaciones y
entregarlas de forma asíncrona por EMAIL o SMS. PostgreSQL es la fuente de
verdad; BullMQ/Redis coordina la ejecución, pero una caída de Redis no hace que
la API pierda una solicitud aceptada.

## Arquitectura

La API y el worker son procesos independientes:

1. `POST /api/v1/notifications` valida la plantilla y crea `notificacion` más
   `notification_outbox` dentro de la misma transacción PostgreSQL.
2. El publicador del worker reclama eventos pendientes con
   `FOR UPDATE SKIP LOCKED` y crea un job BullMQ con id `outbox-{id}`.
3. El procesador toma un advisory lock por notificación, relee el estado y la
   plantilla desde PostgreSQL, renderiza el contenido y llama al adaptador del
   canal.
4. El resultado y el contador de intentos se guardan atómicamente. Los errores
   transitorios usan backoff exponencial; los permanentes o el quinto fallo
   terminan en `FALLIDA`. Una notificación `ENVIADA` nunca vuelve a invocar al
   proveedor.

La entrega es al menos una vez. El estado PostgreSQL, el lock, el job id y las
claves idempotentes de proveedor reducen duplicados. SMTP no permite garantizar
exactamente una vez si el proceso cae después de que Gmail acepte el mensaje.

## Procesos y scripts

- `npm start`: API REST (`index.js`).
- `npm run start:worker`: publicador outbox y worker BullMQ (`worker.js`).
- `npm run dev` / `npm run dev:worker`: variantes con watch.
- `npm run dev:sms-mock`: simulador SMS local; nunca se usa como adaptador de
  producción.
- `npm test`: pruebas unitarias.
- `npm run coverage`: cobertura V8, mínimo requerido 85%.

Para desarrollo, copie `.env.example` a `.env`, aplique
`migrations/001_notification_outbox.sql` sobre una base existente y arranque la
API y el worker en terminales separadas. `tablas.sql` ya incluye el esquema
completo para una instalación nueva.

## Contrato de entrega

`POST /api/v1/notifications` requiere `Idempotency-Key`. Una creación devuelve
`202`; repetir la misma clave con el mismo payload devuelve `200`; reutilizarla
con otro payload devuelve `409`. La API responde `202` aunque Redis esté caído,
porque el evento queda pendiente en PostgreSQL.

EMAIL usa Nodemailer con Gmail App Password, mensaje de texto, asunto igual a
`plantilla.nombre` y `Message-ID` determinista. SMS usa un contrato HTTP
genérico:

```json
{
  "messageId": "notification-42",
  "to": "+59170000000",
  "message": "contenido renderizado"
}
```

El SMS incluye `Authorization: Bearer ...` e
`Idempotency-Key: notification-42`. HTTP `408`, `429` y `5xx` se reintentan; el
resto de `4xx` es terminal.

## Configuración principal

| Variable | Predeterminado |
|---|---:|
| `NOTIFICATION_QUEUE` | `notification-delivery` |
| `MAX_NOTIFICATION_ATTEMPTS` | `5` |
| `RETRY_BACKOFF_MS` | `1000` |
| `SENDS_PER_MINUTE` | `60` |
| `WORKER_CONCURRENCY` | `5` |
| `OUTBOX_POLL_INTERVAL_MS` | `1000` |
| `OUTBOX_BATCH_SIZE` | `20` |
| `OUTBOX_MAX_BACKOFF_MS` | `60000` |
| `PROVIDER_TIMEOUT_MS` | `10000` |

Además se configuran PostgreSQL (`P_DB_*`), Redis (`REDIS_*`), Gmail
(`SMTP_USER`, `SMTP_APP_PASSWORD`, `SMTP_FROM`) y el proveedor SMS
(`SMS_PROVIDER_URL`, `SMS_PROVIDER_TOKEN`). Los errores de configuración de un
canal son terminales únicamente para sus jobs.

## Docker Compose

`docker compose up --build db redis api worker` arranca procesos separados.
Redis usa AOF y `maxmemory-policy noeviction`. El simulador opcional se activa
con el perfil `development`; para usarlo configure en el worker
`SMS_PROVIDER_URL=http://sms-mock:4010/messages`.

El apagado por `SIGINT` o `SIGTERM` deja de publicar, espera al worker, cierra
BullMQ/Redis y finalmente libera PostgreSQL.
