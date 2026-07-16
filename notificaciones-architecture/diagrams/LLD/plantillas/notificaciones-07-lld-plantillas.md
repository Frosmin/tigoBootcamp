# LLD — Gestión de Plantillas

**Stack:** Node.js / ultimate-express · Zod · PostgreSQL (`pg`)  
**Diagrama:** [notificaciones-07-lld-plantillas.puml](notificaciones-07-lld-plantillas.puml)

Administra las plantillas utilizadas para renderizar notificaciones por email y SMS.
Cada plantilla define su canal, contenido y lista de variables requeridas. El nombre
es único dentro de cada canal.

---

## Modelo de plantilla

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | string | Identificador de la plantilla. |
| `nombre` | string | Nombre funcional, único por canal. |
| `canal` | enum (`EMAIL` \| `SMS`) | Canal para el que puede utilizarse. |
| `contenido` | string | Cuerpo con marcadores de variables. |
| `variables` | string[] | Nombres de variables obligatorias al solicitar el envío. |

El mismo nombre puede existir una vez para `EMAIL` y una vez para `SMS`, pero no
puede repetirse dentro del mismo canal.

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/api/v1/templates` | Crea una plantilla. | Bearer token |
| `PUT` | `/api/v1/templates/{id}` | Reemplaza los datos editables de una plantilla. | Bearer token |
| `DELETE` | `/api/v1/templates/{id}` | Elimina una plantilla existente. | Bearer token |

### Headers comunes

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Authorization` | Sí | `Bearer <token>` con permisos de gestión de plantillas. |
| `Content-Type` | Sí para `POST`/`PUT` | `application/json`. |
| `Accept` | No | `application/json`. |

---

## `POST /api/v1/templates`

### Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `nombre` | string | Sí | Nombre único dentro del canal. |
| `canal` | enum (`EMAIL` \| `SMS`) | Sí | Canal de la plantilla. |
| `contenido` | string | Sí | Texto que será renderizado por el worker. |
| `variables` | string[] | Sí | Variables requeridas; puede ser una lista vacía. |

### Ejemplo de request

```http
POST /api/v1/templates
Authorization: Bearer eyJhbGciOi...
Content-Type: application/json

{
  "nombre": "confirmacion-pedido",
  "canal": "EMAIL",
  "contenido": "Hola {{nombre}}, tu pedido {{pedidoId}} fue confirmado.",
  "variables": ["nombre", "pedidoId"]
}
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `201 Created` | Plantilla creada. | Nombre disponible en el canal. |
| `400 Bad Request` | Body inválido. | Validación Zod de los campos. |
| `401 Unauthorized` | Credencial inválida. | Falla de autenticación. |
| `403 Forbidden` | Sin permiso de administración. | Falla de autorización. |
| `409 Conflict` | Nombre duplicado. | Ya existe una plantilla con el mismo nombre y canal. |

### `201 Created` — cuerpo

```json
{
  "id": "tpl_confirmacion_email",
  "nombre": "confirmacion-pedido",
  "canal": "EMAIL",
  "contenido": "Hola {{nombre}}, tu pedido {{pedidoId}} fue confirmado.",
  "variables": ["nombre", "pedidoId"]
}
```

---

## `PUT /api/v1/templates/{id}`

Actualiza nombre, canal, contenido y variables. Al comprobar la unicidad se excluye
la propia plantilla `{id}`.

### Path parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Identificador de la plantilla. |

### Ejemplo de request

```json
{
  "nombre": "confirmacion-pedido",
  "canal": "EMAIL",
  "contenido": "Hola {{nombre}}, confirmamos el pedido {{pedidoId}}.",
  "variables": ["nombre", "pedidoId"]
}
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `200 OK` | Plantilla actualizada. | Solicitud válida. |
| `400 Bad Request` | `id` o body inválidos. | Validación de entrada. |
| `401 Unauthorized` | Credencial inválida. | Falla de autenticación. |
| `403 Forbidden` | Sin permiso de administración. | Falla de autorización. |
| `404 Not Found` | Plantilla inexistente. | No existe `{id}`. |
| `409 Conflict` | Nombre duplicado en el canal. | Otro registro utiliza la combinación. |

```json
{
  "id": "tpl_confirmacion_email",
  "nombre": "confirmacion-pedido",
  "canal": "EMAIL",
  "contenido": "Hola {{nombre}}, confirmamos el pedido {{pedidoId}}.",
  "variables": ["nombre", "pedidoId"]
}
```

---

## `DELETE /api/v1/templates/{id}`

### Respuestas

| Código | Significado |
|--------|-------------|
| `204 No Content` | Plantilla eliminada; la respuesta no incluye body. |
| `400 Bad Request` | Formato de `id` inválido. |
| `401 Unauthorized` | Credencial inválida. |
| `403 Forbidden` | Sin permiso de administración. |
| `404 Not Found` | Plantilla inexistente. |

---

## Errores — cuerpo estándar

```json
{
  "error": {
    "code": "TEMPLATE_NAME_CONFLICT",
    "message": "Ya existe una plantilla con ese nombre para el canal EMAIL.",
    "traceId": "b7c1e2f0-..."
  }
}
```

| `code` | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Body o identificador inválido. |
| `UNAUTHORIZED` | 401 | Credencial ausente o inválida. |
| `FORBIDDEN` | 403 | El emisor no puede administrar plantillas. |
| `TEMPLATE_NOT_FOUND` | 404 | Plantilla inexistente. |
| `TEMPLATE_NAME_CONFLICT` | 409 | Nombre ya utilizado dentro del canal. |

## Dependencias externas

| Dependencia | Uso | Falla → efecto |
|-------------|-----|----------------|
| PostgreSQL | Persistencia y verificación de unicidad. | La operación falla sin confirmar cambios. |

## Notas de diseño

- **Unicidad:** debe existir una restricción lógica y persistente sobre
  `(nombre, canal)` para evitar carreras entre solicitudes.
- **Variables:** los nombres declarados son el contrato que valida la API de
  notificaciones antes de encolar un envío.
- **Canal:** una notificación solo puede usar una plantilla compatible con su canal.
- **Eliminación:** el endpoint sigue la política de dominio definida por el proyecto;
  el LLD documenta el resultado para una eliminación permitida.
