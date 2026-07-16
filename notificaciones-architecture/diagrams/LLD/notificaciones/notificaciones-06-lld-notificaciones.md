# LLD — API de Notificaciones

**Stack:** Node.js / ultimate-express · Zod · PostgreSQL (`pg`) · Redis  
**Diagrama:** [notificaciones-06-lld-notificaciones.puml](notificaciones-06-lld-notificaciones.puml)

Expone los casos de uso para solicitar una notificación, consultar su estado e
historial y programar el reintento de un envío fallido. La entrega es asíncrona:
la API persiste la solicitud en `ENCOLADA`, publica el trabajo en Redis y responde
sin esperar al proveedor de email/SMS.

---

## Máquina de estados

| Estado | Descripción | Transición |
|--------|-------------|------------|
| `ENCOLADA` | Solicitud aceptada y pendiente de procesamiento. | Estado inicial o reintento programado. |
| `ENVIADA` | El proveedor confirmó la entrega. | Resultado exitoso del worker. |
| `FALLIDA` | La entrega no pudo completarse. | Error terminal o máximo de intentos alcanzado. |

Una notificación `ENVIADA` no puede volver a enviarse. Una `ENCOLADA` ya tiene un
trabajo pendiente y tampoco admite un reintento manual adicional.

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/notifications` | Crea y encola una notificación. | Bearer token |
| `GET` | `/api/v1/notifications/{id}` | Consulta estado e intentos de entrega. | Bearer token |
| `GET` | `/api/v1/notifications?canal&estado&page&pageSize` | Lista el historial con filtros y paginación. | Bearer token |
| `POST` | `/api/v1/notifications/{id}/retry` | Programa el reintento de una notificación fallida. | Bearer token |

---

## `POST /api/v1/notifications`

Valida la plantilla y sus variables, aplica idempotencia, persiste la notificación
y publica su identificador en la cola Redis.

### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Authorization` | Sí | `Bearer <token>` emitido para el servicio interno. |
| `Content-Type` | Sí | `application/json`. |
| `Accept` | No | `application/json`. |

### Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `canal` | enum (`EMAIL` \| `SMS`) | Sí | Canal utilizado por el conector Tigo Library. |
| `destinatario` | string | Sí | Email o número telefónico válido para el canal. |
| `plantillaId` | string | Sí | Identificador de una plantilla existente del mismo canal. |
| `variables` | object | Sí | Valores para todas las variables requeridas por la plantilla. |
| `idempotencyKey` | string | Sí | Clave única del emisor; evita crear y entregar duplicados. |

### Ejemplo de request

```http
POST /api/v1/notifications
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "canal": "EMAIL",
  "destinatario": "ana@example.com",
  "plantillaId": "tpl_bienvenida_email",
  "variables": {
    "nombre": "Ana",
    "codigo": "ABC123"
  },
  "idempotencyKey": "orders-8492-confirmation"
}
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `202 Accepted` | Notificación creada en `ENCOLADA`. | Solicitud nueva y válida. |
| `200 OK` | Devuelve la notificación existente. | La `idempotencyKey` ya fue procesada. |
| `400 Bad Request` | Body inválido o variables incompletas. | Validación Zod o de la plantilla. |
| `401 Unauthorized` | Credencial ausente o inválida. | Falla de autenticación. |
| `403 Forbidden` | El emisor no puede utilizar la operación. | Falla de autorización. |
| `404 Not Found` | La plantilla no existe. | `plantillaId` desconocido. |

### `202 Accepted` — cuerpo

```json
{
  "id": "ntf_7f18d2",
  "canal": "EMAIL",
  "destinatario": "ana@example.com",
  "plantillaId": "tpl_bienvenida_email",
  "estado": "ENCOLADA",
  "intentos": 0,
  "creadaEn": "2026-07-15T22:10:00Z"
}
```

Una respuesta idempotente `200 OK` devuelve el mismo `id` y el estado actual sin
crear otro registro ni publicar un segundo trabajo.

---

## `GET /api/v1/notifications/{id}`

### Path parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Identificador de la notificación. |

### Respuestas

| Código | Significado |
|--------|-------------|
| `200 OK` | Devuelve la notificación y su historial de intentos. |
| `400 Bad Request` | Formato de `id` inválido. |
| `401 Unauthorized` | Credencial inválida. |
| `403 Forbidden` | Emisor sin permiso de consulta. |
| `404 Not Found` | Notificación inexistente. |

### `200 OK` — cuerpo

```json
{
  "id": "ntf_7f18d2",
  "canal": "EMAIL",
  "destinatario": "ana@example.com",
  "plantillaId": "tpl_bienvenida_email",
  "estado": "ENVIADA",
  "intentos": 2,
  "creadaEn": "2026-07-15T22:10:00Z",
  "intentosEntrega": [
    {
      "id": "att_001",
      "numero": 1,
      "resultado": "FALLIDO",
      "detalle": "Timeout del proveedor",
      "timestamp": "2026-07-15T22:10:05Z"
    },
    {
      "id": "att_002",
      "numero": 2,
      "resultado": "EXITOSO",
      "detalle": "Entrega confirmada",
      "timestamp": "2026-07-15T22:10:20Z"
    }
  ]
}
```

---

## `GET /api/v1/notifications`

### Query parameters

| Parámetro | Tipo | Requerido | Descripción |
|-----------|------|-----------|-------------|
| `canal` | enum (`EMAIL` \| `SMS`) | No | Filtra por canal. |
| `estado` | enum (`ENCOLADA` \| `ENVIADA` \| `FALLIDA`) | No | Filtra por estado. |
| `page` | integer (≥ 1) | No | Página solicitada; el valor por defecto es configurable. |
| `pageSize` | integer (≥ 1) | No | Elementos por página; límite configurable. |

El endpoint devuelve `200 OK` aun cuando no existan resultados.

```json
{
  "items": [
    {
      "id": "ntf_7f18d2",
      "canal": "EMAIL",
      "destinatario": "ana@example.com",
      "estado": "ENVIADA",
      "intentos": 2,
      "creadaEn": "2026-07-15T22:10:00Z"
    }
  ],
  "page": 1,
  "pageSize": 20,
  "totalItems": 1,
  "totalPages": 1
}
```

---

## `POST /api/v1/notifications/{id}/retry`

Solo admite notificaciones en `FALLIDA`, con intentos disponibles y sin otro
reintento activo. La API cambia el estado a `ENCOLADA` y programa el trabajo con
backoff; no espera a que el worker lo ejecute.

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `202 Accepted` | Reintento programado. | Estado `FALLIDA` y quedan intentos. |
| `400 Bad Request` | `id` inválido. | Validación de parámetros. |
| `401 Unauthorized` | Credencial inválida. | Falla de autenticación. |
| `403 Forbidden` | Operación no autorizada. | Falla de autorización. |
| `404 Not Found` | Notificación inexistente. | No existe `{id}`. |
| `409 Conflict` | Reintento no permitido. | Estado `ENVIADA`/`ENCOLADA`, máximo alcanzado o reintento activo. |

```json
{
  "id": "ntf_7f18d2",
  "estado": "ENCOLADA",
  "reintentoProgramado": true
}
```

---

## Errores — cuerpo estándar

```json
{
  "error": {
    "code": "MISSING_TEMPLATE_VARIABLES",
    "message": "Faltan variables requeridas por la plantilla.",
    "details": [
      { "field": "variables.codigo", "issue": "required" }
    ],
    "traceId": "b7c1e2f0-..."
  }
}
```

| `code` | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Body, parámetros, filtros o paginación inválidos. |
| `MISSING_TEMPLATE_VARIABLES` | 400 | No se enviaron todas las variables requeridas. |
| `UNAUTHORIZED` | 401 | Credencial ausente o inválida. |
| `FORBIDDEN` | 403 | Emisor sin permisos suficientes. |
| `NOTIFICATION_TEMPLATE_NOT_FOUND` | 404 | Plantilla inexistente. |
| `NOTIFICATION_NOT_FOUND` | 404 | Notificación inexistente. |
| `ALREADY_DELIVERED` | 409 | La notificación ya está `ENVIADA`. |
| `DELIVERY_ALREADY_PENDING` | 409 | La notificación ya está `ENCOLADA`. |
| `MAX_RETRIES_REACHED` | 409 | Se alcanzó el máximo configurable de intentos. |
| `RETRY_ALREADY_SCHEDULED` | 409 | Ya existe un reintento activo. |

## Dependencias externas

| Dependencia | Uso | Falla → efecto |
|-------------|-----|----------------|
| PostgreSQL | Plantillas, notificaciones e intentos. | La API devuelve error de servicio y no confirma el encolado. |
| Redis | Idempotencia, cola y trabajos diferidos. | No se acepta una solicitud si no puede garantizarse su encolado. |

## Notas de diseño

- **Idempotencia:** la misma `idempotencyKey` devuelve el registro existente y no
  genera una segunda entrega.
- **Validación previa:** plantilla y variables se validan antes de publicar el trabajo.
- **Procesamiento asíncrono:** `202 Accepted` confirma encolado, no entrega.
- **Configuración:** `pageSize`, máximo de intentos y demoras de backoff no se fijan
  en este contrato; provienen de la configuración del proyecto.
