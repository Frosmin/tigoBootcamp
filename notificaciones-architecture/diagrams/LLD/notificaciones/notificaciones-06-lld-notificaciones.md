# LLD - Notificaciones y worker

**Stack:** Node.js 22, ultimate-express, Zod, PostgreSQL, ioredis,
Redis Streams y Nodemailer.

## API disponible

| Método | Ruta | Resultado |
|---|---|---|
| `POST` | `/api/v1/notifications` | Persiste `ENCOLADA` y publica `notificationId`. |
| `GET` | `/api/v1/notifications/{id}` | Devuelve recurso e `historialIntentos`. |

La idempotencia reside en `notificacion.idempotency_key`. La misma clave con el
mismo payload devuelve `200` sin volver a ejecutar `XADD`; un payload distinto
devuelve `409 CF001`.

## Consumo

- Stream: `notifications:dispatch`.
- Grupo predeterminado: `notification-workers`, creado desde `0`.
- Lectura: `XREADGROUP`; recuperación: `XAUTOCLAIM`.
- Confirmación: `XACK` solo después de que el procesador haya persistido el
  resultado o determinado que el trabajo puede descartarse con seguridad.
- Los fallos inesperados permanecen pendientes para ser reclamados.

## Estado e intentos

El worker solo entrega filas `ENCOLADA`. `recordDeliveryAttempt` usa una única
sentencia SQL con CTE para incrementar `intentos`, actualizar `estado` y
`next_attempt_at`, e insertar el historial con el mismo número de intento.

| Resultado | Estado | Acción adicional |
|---|---|---|
| Éxito | `ENVIADA` | Marca `delivered` antes de persistir. |
| Fallo reintentable | `ENCOLADA` | Guarda `next_attempt_at` y hace `ZADD`. |
| Fallo terminal o máximo | `FALLIDA` | No vuelve a programar. |
| Sin throughput | sin cambio | Difiere sin consumir intento. |

El backoff predeterminado es 30 y 60 segundos, con 3 intentos totales y tope
configurable de 5 minutos.

## Entrega por canal

- **EMAIL:** Gmail SMTP mediante Nodemailer, credenciales solo por variables de
  entorno y `Message-ID` determinista.
- **SMS:** conector preparado sin proveedor. Produce el error terminal
  `SMS_PROVIDER_NOT_CONFIGURED`.

Timeouts/conexión y SMTP 4xx se clasifican como reintentables. Autenticación,
destinatario inválido, SMTP 5xx, plantilla inválida y SMS no configurado son
terminales.

## Coordinación Redis

- Lock por notificación con `SET NX PX` y liberación Lua validando el token.
- Marca temporal `notification:delivered:{id}` (7 días por defecto) para
  recuperar el caso en que SMTP aceptó el correo pero falló la escritura
  PostgreSQL posterior, sin acumular claves indefinidamente.
- Límite fijo por minuto separado para EMAIL y SMS.
- Sorted set `notifications:delayed`; un script Lua elimina y publica los
  trabajos vencidos de forma indivisible.

## Limitaciones

PostgreSQL, Redis y SMTP no forman una transacción atómica. Estas defensas
reducen fuertemente duplicados, pero no permiten garantizar exactly-once ante un
corte entre la aceptación SMTP y la marca `delivered`. El siguiente nivel de
robustez para la publicación API es transactional outbox. Antes de permitir
editar plantillas se debe guardar un snapshot o bloquear cambios con trabajos
`ENCOLADA`.
