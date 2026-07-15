# LLD — Servicio de Búsqueda

**Stack:** Node.js / ultimate-express · Cache Redis · Conectores GDS y Hoteles
**Diagrama:** [reservas-06-lld-busqueda.puml](reservas-06-lld-busqueda.puml)

Responsable de agregar y normalizar disponibilidad y tarifas de vuelos y hoteles.
No persiste datos de negocio: solo lee de proveedores externos y cachea resultados.

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `GET` | `/search` | Busca ofertas de vuelos y/o hoteles según criterios. | Bearer JWT |

---

## `GET /search`

Busca disponibilidad. Consulta cache primero; ante *miss* llama en paralelo al GDS
de vuelos y al proveedor de hoteles, combina y ordena resultados.

### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Authorization` | Sí | `Bearer <JWT>` |
| `Accept` | No | `application/json` (por defecto) |

### Query parameters

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `tipo` | enum (`vuelo` \| `hotel` \| `ambos`) | Sí | Qué tipo de oferta buscar. | `ambos` |
| `origen` | string (IATA) | Condicional¹ | Ciudad/aeropuerto de origen. | `VVI` |
| `destino` | string (IATA) | Sí | Ciudad/aeropuerto de destino. | `MAD` |
| `fechaSalida` | date (`YYYY-MM-DD`) | Sí | Fecha de ida / check-in. | `2026-08-01` |
| `fechaRegreso` | date (`YYYY-MM-DD`) | No | Fecha de vuelta / check-out. | `2026-08-10` |
| `adultos` | integer (≥1) | Sí | Nº de adultos. | `2` |
| `ninos` | integer (≥0) | No | Nº de niños. | `1` |
| `habitaciones` | integer (≥1) | No | Solo para `hotel`/`ambos`. | `1` |
| `moneda` | string (ISO 4217) | No | Moneda de las tarifas. Def. `USD`. | `BOB` |
| `page` | integer (≥1) | No | Página de resultados. Def. `1`. | `1` |
| `pageSize` | integer (1–100) | No | Tamaño de página. Def. `20`. | `20` |

> ¹ `origen` es requerido cuando `tipo` es `vuelo` o `ambos`.

### Ejemplo de request

```http
GET /search?tipo=ambos&origen=VVI&destino=MAD&fechaSalida=2026-08-01&fechaRegreso=2026-08-10&adultos=2&moneda=BOB
Authorization: Bearer eyJhbGciOi...
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `200 OK` | Ofertas encontradas (puede ser lista vacía). | Búsqueda exitosa (cache hit o miss). |
| `206 Partial Content` | Resultados **parciales**. | Un proveedor falló/expiró; se devuelve lo disponible. |
| `400 Bad Request` | Parámetros inválidos o faltantes. | Validación de query params. |
| `401 Unauthorized` | Token ausente o inválido. | Falla el middleware de seguridad. |
| `429 Too Many Requests` | Límite de tasa superado. | Rate limiting. |
| `502 Bad Gateway` | Todos los proveedores fallaron. | Sin datos de ningún proveedor. |
| `503 Service Unavailable` | Servicio saturado / dependencia caída. | Circuit breaker abierto. |

### `200 OK` — cuerpo

```json
{
  "searchId": "srch_a1b2c3",
  "moneda": "BOB",
  "totalResultados": 42,
  "page": 1,
  "pageSize": 20,
  "ofertas": [
    {
      "tipo": "vuelo",
      "ofertaId": "off_flt_001",
      "aerolinea": "Boliviana de Aviación",
      "origen": "VVI",
      "destino": "MAD",
      "salida": "2026-08-01T08:30:00Z",
      "llegada": "2026-08-01T23:10:00Z",
      "escalas": 1,
      "precio": { "monto": 6200.00, "moneda": "BOB" },
      "validoHasta": "2026-07-15T18:00:00Z"
    },
    {
      "tipo": "hotel",
      "ofertaId": "off_htl_007",
      "nombre": "Hotel Central Madrid",
      "estrellas": 4,
      "checkIn": "2026-08-01",
      "checkOut": "2026-08-10",
      "habitaciones": 1,
      "precio": { "monto": 8900.00, "moneda": "BOB" },
      "validoHasta": "2026-07-15T18:00:00Z"
    }
  ]
}
```

> El campo `ofertaId` es el que luego se envía a **Reservas** (`POST /bookings`).
> `validoHasta` indica hasta cuándo la tarifa se considera vigente.

### `206 Partial Content` — cuerpo

Igual estructura que `200`, con un bloque adicional que indica qué proveedor falló:

```json
{
  "searchId": "srch_a1b2c3",
  "ofertas": [ /* solo vuelos */ ],
  "advertencias": [
    { "proveedor": "hoteles", "motivo": "timeout", "codigo": "PROVIDER_TIMEOUT" }
  ]
}
```

### Errores — cuerpo estándar

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "El parámetro 'destino' es requerido.",
    "details": [
      { "field": "destino", "issue": "required" }
    ],
    "traceId": "b7c1e2f0-..."
  }
}
```

| `code` | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Uno o más parámetros inválidos. |
| `UNAUTHORIZED` | 401 | Token ausente/inválido/expirado. |
| `RATE_LIMITED` | 429 | Demasiadas solicitudes. |
| `PROVIDER_UNAVAILABLE` | 502 | Ningún proveedor respondió. |
| `SERVICE_UNAVAILABLE` | 503 | Circuit breaker abierto / saturación. |

---

## Dependencias externas

| Dependencia | Uso | Falla → efecto |
|-------------|-----|----------------|
| Cache (Redis) | Lee/escribe resultados con TTL. | Se salta cache, se consulta a proveedores. |
| GDS de Vuelos | Tarifas de aerolíneas. | `206` sin vuelos, o `502` si también falla hoteles. |
| Proveedor de Hoteles | Tarifas hoteleras. | `206` sin hoteles, o `502` si también falla vuelos. |

## Notas de diseño

- **Idempotencia:** `GET` es naturalmente idempotente; la clave de cache se deriva
  del hash de los criterios de búsqueda normalizados.
- **Degradación elegante:** timeout por proveedor; se devuelven resultados parciales
  (`206`) en lugar de fallar toda la búsqueda.
- **Sin efectos de negocio:** este backend nunca crea reservas ni cobra.
