# P07 Notificaciones

Microservicio backend para administrar plantillas y enviar notificaciones por
EMAIL o SMS. Está construido con Node.js 22, ultimate-express, Zod, PostgreSQL
y Redis.

## Funcionalidad implementada

- `GET /api/v1/health`: health check.
- `POST /api/v1/templates`: crea una plantilla.

Los siguientes casos de uso se implementarán de forma incremental: creación,
consulta y listado de notificaciones, worker de entrega, reintentos y
actualización/eliminación de plantillas.

## Crear una plantilla

```http
POST /api/v1/templates
Authorization: Bearer <APP_PASSWORD>
Content-Type: application/json
```

```json
{
  "nombre": "confirmacion-pedido",
  "canal": "EMAIL",
  "contenido": "Hola {{nombre}}, tu pedido {{pedidoId}} fue confirmado.",
  "variables": ["nombre", "pedidoId"]
}
```

Reglas:

- `canal` solo admite `EMAIL` o `SMS`.
- `nombre` es único dentro de cada canal.
- `variables` es obligatorio, pero puede ser un arreglo vacío.
- Los nombres de variables no pueden estar vacíos ni repetidos.
- El body no admite propiedades adicionales.

Respuestas:

| Estado | Descripción |
|---|---|
| `201 Created` | Plantilla creada. |
| `400 Bad Request` | Body inválido. |
| `401 Unauthorized` | Bearer ausente o inválido. |
| `409 Conflict` | El nombre ya existe para el canal. |
| `500 Internal Server Error` | Error inesperado de infraestructura. |

Ejemplo con curl:

```bash
curl --location 'http://localhost:3050/api/v1/templates' \
  --header 'Authorization: Bearer change-me' \
  --header 'Content-Type: application/json' \
  --data '{
    "nombre": "confirmacion-pedido",
    "canal": "EMAIL",
    "contenido": "Hola {{nombre}}, tu pedido {{pedidoId}} fue confirmado.",
    "variables": ["nombre", "pedidoId"]
  }'
```

## Configuración

Copiar `.env.example` a `.env` y completar:

| Variable | Uso |
|---|---|
| `PORT` | Puerto HTTP, por defecto local `3050`. |
| `API_BASE_PATH` | Ruta base; debe ser `/api/v1`. |
| `APP_PASSWORD` | Token Bearer temporal para servicios internos. |
| `P_DB_*` | Conexión administrada por `@tigo/postgres-connector`. |
| `REDIS_*` | Conexión administrada por `@tigo/redis-connector`. |

`APP_PASSWORD` es una autenticación temporal. Debe reemplazarse por el
proveedor JWT/autorización definitivo cuando ese contrato esté disponible.

## Ejecución local

1. Iniciar PostgreSQL y Redis:

```bash
docker compose up -d
```

2. Aplicar `tablas.sql` en PostgreSQL. El script recrea las tablas P07 y elimina
   sus datos existentes.

3. Iniciar el servicio:

```bash
npm run dev
```

## Pruebas

```bash
npm test
npm run coverage
```

La cobertura mínima requerida por P07 es 85%.
