# LLD - API de Notificaciones

**Stack:** Node.js, ultimate-express, Zod, PostgreSQL y Redis
**Diagrama:** [notificaciones-06-lld-notificaciones.puml](notificaciones-06-lld-notificaciones.puml)

El módulo recibe solicitudes de servicios internos que ya fueron autenticados por
la infraestructura anterior. P07 no valida tokens, usuarios ni permisos; únicamente
valida los datos de entrada y las reglas de negocio.

## Endpoints

| Método | Ruta | Resultado principal |
|---|---|---|
| `POST` | `/api/v1/notifications` | Valida la plantilla y sus variables, persiste en `ENCOLADA` y publica el trabajo. |
| `GET` | `/api/v1/notifications/{id}` | Devuelve el estado y los intentos. |
| `GET` | `/api/v1/notifications?canal&estado&page&pageSize` | Devuelve el historial filtrado y paginado. |
| `POST` | `/api/v1/notifications/{id}/retry` | Programa un reintento de una notificación `FALLIDA`. |

## Reglas

- Estados permitidos: `ENCOLADA`, `ENVIADA` y `FALLIDA`.
- Las variables faltantes bloquean el envío.
- El header `Idempotency-Key` es obligatorio. La misma clave y payload devuelve
  la notificación existente; reutilizarla con otro payload devuelve `409`.
- Una notificación `ENVIADA` no se reenvía.
- Los reintentos usan backoff exponencial hasta el máximo configurable.
- El throughput máximo por minuto es configurable.

## Entrega

El worker consume Redis, renderiza la plantilla y usa una librería genérica de
terceros para comunicarse con el proveedor externo de email/SMS. Cada resultado
se registra como un intento en PostgreSQL.

La unicidad idempotente se garantiza en PostgreSQL y Redis Streams se usa solo
como cola. Como ambas escrituras no comparten una transacción, la API elimina de
forma compensatoria la notificación nueva si falla `XADD`. Una evolución de mayor
garantía debería usar un transactional outbox y un publicador independiente.

## Errores esperados

| HTTP | Uso |
|---|---|
| `400` | Datos, filtros, id o variables inválidos. |
| `404` | Plantilla o notificación inexistente. |
| `409` | Duplicidad o reintento no permitido. |
| `500/503` | Falla interna o dependencia no disponible. |

No se definen respuestas `401` o `403`, porque autenticación y autorización están
fuera del alcance del microservicio.
