# P07 Notificaciones

Microservicio Node.js para crear plantillas, registrar notificaciones de forma
idempotente, consultar su estado y entregarlas de manera asíncrona.

## Componentes

- **API REST:** valida la solicitud, persiste la notificación en PostgreSQL y
  publica su identificador en Redis Streams.
- **Worker:** consume el stream mediante consumer groups, renderiza la plantilla,
  aplica límites por canal, entrega el mensaje y persiste el intento y el estado.
- **PostgreSQL:** fuente de verdad para plantillas, notificaciones, idempotencia e
  historial de intentos.
- **Redis:** stream principal, reintentos diferidos, locks, marca de entrega y
  limitadores de throughput.

## Endpoints implementados

| Método | Ruta | Resultado |
|---|---|---|
| `POST` | `/api/v1/templates` | Crea una plantilla. |
| `POST` | `/api/v1/notifications` | Crea y encola una notificación (`202`) o devuelve el duplicado idéntico (`200`). |
| `GET` | `/api/v1/notifications/:id` | Devuelve la notificación y su historial de intentos. |
| `GET` | `/health` | Estado del proceso API. |

Los endpoints de historial paginado, retry manual y actualización/eliminación de
plantillas corresponden a los siguientes puntos de implementación.

## Worker de entrega

El worker usa `XREADGROUP` sobre `notifications:dispatch`. El grupo se crea desde
`0`, los pendientes abandonados se recuperan con `XAUTOCLAIM` y un mensaje solo
se confirma con `XACK` después de persistir su resultado. Los reintentos se
guardan en el sorted set `notifications:delayed`; un promotor Lua mueve los
trabajos vencidos al stream sin bloquear al worker.

Valores predeterminados:

- 3 intentos totales.
- Backoff de 30 y 60 segundos tras el primer y segundo fallo, con tope de 5
  minutos.
- 60 permisos por minuto para EMAIL y 60 para SMS.

Los fallos de conexión, timeout y SMTP 4xx son reintentables. Autenticación,
destinatario inválido, SMTP 5xx y plantilla inválida son terminales. Como aún no
se definió un proveedor SMS, un SMS se registra una sola vez como `FALLIDO` con
detalle `SMS_PROVIDER_NOT_CONFIGURED` y la notificación pasa a `FALLIDA`.

EMAIL se entrega mediante Nodemailer y Gmail SMTP. Se usa un `Message-ID`
determinista por notificación para reducir duplicados. Gmail requiere una cuenta
con verificación en dos pasos y una App Password; la contraseña no debe
guardarse en Git. Consulta [App Passwords de Google](https://support.google.com/accounts/answer/185833)
y [SMTP de Nodemailer](https://nodemailer.com/smtp).

## Base de datos

Para una instalación nueva, ejecutar `tablas.sql`. Este archivo recrea las
tablas y elimina los datos existentes.

Para actualizar una base que ya contiene datos, ejecutar solamente:

```bash
psql "$P_DB_CONNECTION_STRING" -f migrations/001_worker_delivery.sql
```

La migración añade `next_attempt_at` y refuerza el historial numerado sin borrar
notificaciones existentes. El worker actualiza el contador/estado y registra el
intento en una única sentencia SQL.

## Variables de entorno

Copiar `.env.example` a `.env`. Las variables principales son:

| Variable | Predeterminado / uso |
|---|---|
| `P_DB_*` | Conexión PostgreSQL usada por `@tigo/postgres-connector`. |
| `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` | Conexión Redis usada por `ioredis`. |
| `NOTIFICATION_STREAM` | `notifications:dispatch`. |
| `NOTIFICATION_DELAYED_SET` | `notifications:delayed`. |
| `NOTIFICATION_CONSUMER_GROUP` | `notification-workers`. |
| `WORKER_CLAIM_IDLE_MS` | `30000`. |
| `WORKER_LOCK_TTL_MS` | `180000`. Debe superar el timeout máximo de entrega. |
| `DELIVERED_MARK_TTL_MS` | `604800000` (7 días); evita crecimiento ilimitado de Redis. |
| `MAX_DELIVERY_ATTEMPTS` | `3`. |
| `RETRY_BASE_DELAY_MS` | `30000`. |
| `RETRY_MAX_DELAY_MS` | `300000`. |
| `EMAIL_MAX_PER_MINUTE` | `60`. |
| `SMS_MAX_PER_MINUTE` | `60`. |
| `SMTP_USER` | Cuenta Gmail. |
| `SMTP_APP_PASSWORD` | App Password; secreto obligatorio del worker. |
| `SMTP_FROM` | Remitente del correo. |
| `SMTP_MESSAGE_ID_DOMAIN` | Dominio usado en el `Message-ID`. |
| `SMTP_*_TIMEOUT_MS` | Timeouts de conexión, saludo y socket (30 s, 30 s y 60 s). |

## Ejecución

```bash
npm install
npm start          # API
npm run worker     # worker, en otro proceso
npm test
npm run coverage
```

Con Docker Compose, PostgreSQL, Redis y el worker se levantan con:

```bash
docker compose up --build
```

La API puede ejecutarse localmente con `npm start`. Para ejecutar también la API
en Compose debe añadirse el servicio correspondiente o usarse el contenedor de
la imagen con su comando predeterminado.

## Validación manual

1. Crear una plantilla EMAIL cuyo contenido tenga variables `{{nombre}}`.
2. Crear la notificación con `POST /api/v1/notifications` y comprobar
   `estado: "ENCOLADA"`.
3. Iniciar `npm run worker` con PostgreSQL, Redis y Gmail configurados.
4. Consultar `GET /api/v1/notifications/:id` hasta observar `ENVIADA`,
   `intentos: 1` y un intento `EXITOSO`.

## Garantías y limitaciones

- PostgreSQL y Redis no comparten una transacción. La API usa compensación si
  falla `XADD`; una evolución más robusta requiere transactional outbox.
- SMTP tampoco ofrece una transacción con PostgreSQL. El lock, estado persistido,
  marca `delivered` y `Message-ID` determinista reducen duplicados, pero un corte
  entre la aceptación SMTP y la marca local impide garantizar exactly-once.
- El contenido se renderiza desde la plantilla actual. Antes de habilitar edición
  de plantillas debe adoptarse un snapshot del contenido o impedir su cambio
  mientras existan notificaciones `ENCOLADA`.
