# LLD - Gestión de Plantillas

**Stack:** Node.js, ultimate-express, Zod y PostgreSQL
**Diagrama:** [notificaciones-07-lld-plantillas.puml](notificaciones-07-lld-plantillas.puml)

El módulo administra las plantillas de email y SMS. Los consumidores ya llegan
autenticados; P07 valida los datos, pero no tokens, usuarios ni permisos.

## Modelo

| Campo | Tipo | Regla |
|---|---|---|
| `id` | bigint | Identificador generado por PostgreSQL. |
| `nombre` | string | Obligatorio y único dentro del canal. |
| `canal` | `EMAIL` o `SMS` | Obligatorio. |
| `contenido` | string | Obligatorio y no vacío. |
| `variables` | string[] | Lista de variables requeridas; puede estar vacía. |

La base de datos garantiza la unicidad de `(nombre, canal)`.

## Endpoints

| Método | Ruta | Respuestas principales |
|---|---|---|
| `POST` | `/api/v1/templates` | `201`, `400` o `409`. |
| `PUT` | `/api/v1/templates/{id}` | `200`, `400`, `404` o `409`. |
| `DELETE` | `/api/v1/templates/{id}` | `204`, `400` o `404`. |

No se definen respuestas `401` o `403`, porque autenticación y autorización están
fuera del alcance del microservicio.
