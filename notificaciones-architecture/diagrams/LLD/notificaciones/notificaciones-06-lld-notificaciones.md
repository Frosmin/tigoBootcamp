# LLD - Notificaciones

**Stack:** Node.js, ultimate-express, Zod, PostgreSQL, BullMQ y Redis

**API:** [notificaciones-06-lld-notificaciones.puml](notificaciones-06-lld-notificaciones.puml)

**Entrega asíncrona:** [notificaciones-08-lld-entrega-asincrona.puml](notificaciones-08-lld-entrega-asincrona.puml)

Los servicios internos llegan previamente autenticados. P07 no valida tokens,
usuarios ni permisos; valida entradas y reglas de negocio.

## Endpoints

| Método | Ruta | Resultado principal |
|---|---|---|
| `POST` | `/api/v1/notifications` | Crea una solicitud durable en `ENCOLADA`. Devuelve `202`, `200` para repetición idempotente idéntica o `409` para payload distinto. |
| `GET` | `/api/v1/notifications/{id}` | Devuelve el recurso y `historialIntentos` ordenado. |
| `GET` | `/api/v1/notifications?canal&estado&page&limit` | Devuelve historial filtrado y paginado. |
| `POST` | `/api/v1/notifications/{id}/retry` | Programa un reintento de una notificación `FALLIDA`. |

## Persistencia y transactional outbox

PostgreSQL es la fuente de verdad. `insertNotification` crea `notificacion` y
`notification_outbox` dentro de una misma transacción. Por ello, la API puede
responder `202 Accepted` después del `COMMIT` aunque Redis esté temporalmente
inaccesible; no elimina la notificación ni devuelve `503` por un fallo posterior
de publicación.

El Outbox Publisher reclama eventos pendientes mediante
`FOR UPDATE SKIP LOCKED`, crea jobs BullMQ con `jobId = outbox-{id}` y marca el
evento como publicado. Si Redis falla, incrementa `publish_attempts`, conserva
el error y mueve `available_at` aplicando backoff.

## Entrega y reintentos

El BullMQ Worker aplica concurrencia y un límite de envíos por minuto. Antes de
entregar obtiene un advisory lock PostgreSQL por notificación, vuelve a consultar
su estado y omite una notificación que ya esté `ENVIADA`.

Cada invocación al proveedor produce una fila `intento` e incrementa el contador
de la notificación. Los fallos transitorios mantienen `ENCOLADA` y BullMQ
programa el siguiente intento con backoff exponencial. Un error permanente o el
último intento cambia el estado a `FALLIDA`.

El reintento manual bloquea la fila con `SELECT FOR UPDATE`; si la notificación
está `FALLIDA` y quedan intentos, actualiza a `ENCOLADA` y crea otro evento outbox
diferido en la misma transacción. Solicitudes concurrentes quedan serializadas y
una segunda solicitud observa `ENCOLADA`, por lo que recibe `409`.

## Idempotencia y garantía de entrega

- `Idempotency-Key` es obligatorio y único en PostgreSQL.
- La misma clave y payload devuelve el recurso existente; otro payload devuelve `409`.
- El job ID estable evita duplicar un job para el mismo evento outbox.
- Advisory lock, estado `ENVIADA` e identificadores deterministas hacia los proveedores reducen duplicados.
- La entrega es **al menos una vez**; no se promete exactly-once frente a una caída después de la aceptación del proveedor.
- Redis conserva jobs, demoras, reintentos y rate limiting de BullMQ, pero no estados, intentos ni idempotencia de negocio.

## Errores esperados

| HTTP | Uso |
|---|---|
| `400` | Body, header, filtros, paginación, id o variables inválidos. |
| `404` | Plantilla o notificación inexistente. |
| `409` | Idempotencia conflictiva o reintento no permitido. |
| `500/503` | Falla interna o dependencia no disponible fuera de la aceptación durable ya confirmada. |

No se definen respuestas `401` o `403`, porque autenticación y autorización
están fuera del alcance del microservicio.
