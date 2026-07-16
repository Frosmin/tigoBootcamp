# tigo.micro.template

Template base para microservicios Node.js de Tigo Money. Provee la estructura,
convenciones y configuracion base (incluye `Dockerfile`) listas para clonar y
empezar un nuevo servicio.

Incluye un recurso de ejemplo (`example`) sobre PostgreSQL con dos operaciones
—insertar y obtener por id— que demuestran el patron
`route -> middleware(zod) -> controller -> service -> repository`. Se debe
reemplazar por el modelo y los endpoints reales del microservicio.

## Tabla de contenidos
- Stack
- Estructura del proyecto
- Como crear un nuevo servicio a partir del template
- Arquitectura y convenciones
- Modelo de datos de ejemplo
- Endpoints de ejemplo
- Variables de entorno
- Ejecucion local
- Scripts
- Testing
- Docker

## Stack
- Node.js 22 (ESM, `"type": "module"`)
- `ultimate-express` como framework HTTP
- `zod` para validacion de esquemas
- `helmet` + CSP para hardening
- `express-prom-bundle` para metricas Prometheus (`/metrics`)
- `@tigo/postgres-connector` para acceso a PostgreSQL
- `@tigo/logger`, `@tigo/redis-connector`, `@tigo/error-code` (registry interno)
- `vitest` para pruebas unitarias y cobertura

## Estructura del proyecto
```
.
├── index.js                  # Bootstrap: carga .env, inicializa la BD y levanta el server
├── src/
│   ├── app.js                # Configuracion de la app (middlewares, seguridad, rutas)
│   ├── routes/
│   │   └── router.routes.js   # Definicion de endpoints
│   ├── controllers/          # Orquestan request/response, delegan al service
│   ├── services/             # Logica de negocio
│   ├── repositories/         # Acceso a datos (SQL parametrizado)
│   ├── middleware/
│   │   └── validate.middleware.js  # Validacion de request con zod
│   └── utils/
│       ├── config.js          # Lectura centralizada de variables de entorno
│       ├── constants.js       # Constantes de la app
│       ├── errorCodes.js      # Catalogo de codigos de error + setError()
│       └── response.js        # sendError(): respuesta de error homogenea
├── schemas/                  # Esquemas zod por endpoint
├── test/unit-test/           # Pruebas unitarias (espeja la estructura de src/)
├── Dockerfile                # Imagen de produccion (con OpenTelemetry)
├── vitest.config.js
├── .npmrc                    # Registry interno @tigo
└── .env.example              # Plantilla de variables de entorno
```

## Como crear un nuevo servicio a partir del template
1. Clonar/copiar este repositorio con el nombre del nuevo servicio
   (`tigo.micro.<dominio>.<funcion>`).
2. Actualizar `package.json`: `name`, `description` y `repository.url`.
3. Definir el `API_BASE_PATH` en `.env` y en `src/utils/config.js`.
4. Reemplazar el recurso de ejemplo por el modelo real:
   - Crear la tabla en la base de datos.
   - Ajustar los schemas en `schemas/`.
   - Ajustar el repositorio (`src/repositories/`), el service y el controller.
   - Registrar los endpoints en `src/routes/router.routes.js` y su validacion
     en `src/middleware/validate.middleware.js`.
5. Escribir las pruebas unitarias en `test/unit-test/` (meta de cobertura: 80%).
6. Actualizar este README con la descripcion real del servicio.

## Arquitectura y convenciones
- **Capas**: la ruta valida con un middleware/schema; el controller orquesta la
  peticion; el service contiene la logica de negocio; el repository encapsula el
  SQL. El SQL nunca vive fuera de `src/repositories/`.
- **SQL seguro**: todas las consultas usan parametros (`$1, $2, ...`), nunca
  interpolacion de strings. Los parametros se tipan explicitamente
  (`$4::numeric`, `$6::date`, ...) para que Postgres no infiera el tipo desde el
  literal por defecto de un `COALESCE` (evita errores como `invalid input syntax
  for type integer` al enviar decimales).
- **Config centralizada**: no leer `process.env` fuera de `src/utils/config.js`
  (las librerias `@tigo/*` leen sus propias variables internamente).
- **Errores**: en los services lanzar `setError(mensaje, errorCodes.XXX)`; los
  controllers los traducen con `sendError()` a `{ error: { code, message } }` y
  su HTTP correspondiente (via `@tigo/error-code`).
- **Validacion**: cada endpoint tiene un schema `zod` `.strict()` que valida
  body + params + headers (`x-clientid`, `x-traceid`).
- **Logging**: usar `@tigo/logger`; los controllers miden el tiempo de ejecucion
  con `startTimer`/`endTimer`.
- **ESM**: imports con extension `.js` explicita.

## Modelo de datos de ejemplo
Tabla `example` (crear en la base de datos antes de usar los endpoints):

```sql
CREATE TABLE example (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description VARCHAR(500),
    quantity INTEGER NOT NULL DEFAULT 0
        CHECK (quantity >= 0),
    price NUMERIC(12, 2) NOT NULL DEFAULT 0
        CHECK (price >= 0),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    registration_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

| Columna | Tipo | Notas |
|---|---|---|
| `id` | `BIGINT` identity | PK, gestionado por la BD |
| `name` | `VARCHAR(100)` | obligatorio |
| `description` | `VARCHAR(500)` | opcional |
| `quantity` | `INTEGER` | default `0`, `>= 0` |
| `price` | `NUMERIC(12,2)` | default `0`, `>= 0` |
| `active` | `BOOLEAN` | default `TRUE` |
| `registration_date` | `DATE` | default `CURRENT_DATE` |
| `created_at` | `TIMESTAMPTZ` | gestionado por la BD |
| `updated_at` | `TIMESTAMPTZ` | gestionado por la BD |

## Endpoints de ejemplo
Base: `http://localhost:${PORT}${API_BASE_PATH}` (con el `.env.example`:
`http://localhost:3050/v1`). Headers en los endpoints del recurso:
`X-ClientId` (obligatorio), `X-traceId` (opcional), `Content-Type: application/json`.

| Metodo | Ruta | Descripcion |
|---|---|---|
| `GET` | `/health` | Health check (`{ "status": "UP" }`) |
| `POST` | `/examples` | Inserta un registro y lo devuelve (201) |
| `GET` | `/examples/:id` | Obtiene un registro por id (404 si no existe) |

Insertar un registro:
```bash
curl --location 'http://localhost:3050/v1/examples' \
--header 'X-ClientId: MI-TIGO' \
--header 'X-traceId: 1' \
--header 'Content-Type: application/json' \
--data '{
  "name": "Producto A",
  "description": "Descripcion opcional",
  "quantity": 10,
  "price": 99.90,
  "active": true,
  "registration_date": "2026-07-14"
}'
```

Obtener el registro insertado (reemplazar `1` por el `id` retornado):
```bash
curl --location 'http://localhost:3050/v1/examples/1' \
--header 'X-ClientId: MI-TIGO' \
--header 'X-traceId: 1'
```

> Los campos `description`, `quantity`, `price`, `active` y `registration_date`
> son opcionales: si se omiten, se aplican los valores por defecto de la tabla.
> El `POST` devuelve el registro completo con `id`, `created_at` y `updated_at`.

## Variables de entorno

| Variable | Requerida | Ejemplo |
|---|---|---|
| `PORT` | Si | `3050` |
| `API_BASE_PATH` | Si | `/v1` |
| `P_DB_HOST` | Si | `localhost` |
| `P_DB_PORT` | Si | `5432` |
| `P_DB_NAME` | Si | `mydatabase` |
| `P_DB_USER` | Si | `postgres` |
| `P_DB_PASSWORD` | Si | `postgres123` |
| `P_DB_MAX_CONNECTIONS` | No | `10` |
| `P_DB_CONNECTION_STRING` | No | `postgresql://user:pass@host:5432/db` (tiene prioridad) |
| `REDIS_HOST` / `REDIS_PORT` / `REDIS_PASSWORD` | Si (`@tigo/redis-connector`) | ver `.env.example` |

Copiar `.env.example` a `.env` y completar los valores.

> Nota: si el servicio no usa Redis, elimina `initializeRedis()` de
> `src/app.js`, la dependencia `@tigo/redis-connector` de `package.json` y sus
> variables `REDIS_*`.

## Ejecucion local
1. Instalar dependencias (requiere acceso al registry interno `@tigo`):
```bash
npm install
```
2. Configurar `.env` a partir de `.env.example`.
3. Crear la tabla `example` en la base de datos (ver [Modelo de datos de ejemplo](#modelo-de-datos-de-ejemplo)).
4. Ejecutar (queda escuchando en `http://localhost:${PORT}`, ej. `3050`):
```bash
npm run dev    # modo watch
npm start      # modo normal
```

## Scripts
- `npm start`: ejecuta `node index.js`.
- `npm run dev`: ejecuta `node --watch index.js`.
- `npm test`: pruebas unitarias con Vitest.
- `npm run coverage`: pruebas unitarias con cobertura.

## Testing
- Pruebas unitarias en `test/unit-test/` con Vitest, espejando la estructura de `src/`.
- El template trae **un test de ejemplo por capa** (repository, service, controller,
  middleware, route, app); ampliar la cobertura al implementar el servicio real.
- El acceso a BD se mockea (`@tigo/postgres-connector`); no se requiere una base
  real para correr las pruebas.
- Cobertura minima esperada del proyecto: `80%`.
- Ejecutar: `npm run coverage`.

## Docker
Imagen de produccion definida en `Dockerfile` (Node 22 slim, usuario no root,
instrumentacion OpenTelemetry). Build y ejecucion local:
```bash
docker build -t tigo.micro.template .
docker run --rm -p 3050:3050 --env-file .env tigo.micro.template
```
El puerto interno lo define `PORT`; ajusta el mapeo `-p host:PORT` segun tu `.env`.
