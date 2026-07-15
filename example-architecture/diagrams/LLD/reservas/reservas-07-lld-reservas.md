# LLD — Servicio de Reservas

**Stack:** Node.js / ultimate-express · PostgreSQL (`pg`) · Cache Redis (holds) · Bus de eventos
**Diagrama:** [reservas-07-lld-reservas.puml](reservas-07-lld-reservas.puml)

Gestiona el ciclo de vida de la reserva mediante una máquina de estados:
`PENDIENTE → CONFIRMADA | CANCELADA | EXPIRADA`.
Crea el bloqueo temporal (*hold*) y reacciona a eventos de pago para confirmar o cancelar.

---

## Máquina de estados

| Estado | Descripción | Transición |
|--------|-------------|------------|
| `PENDIENTE` | Reserva creada con hold activo, a la espera de pago. | Estado inicial. |
| `CONFIRMADA` | Pago aprobado y reserva confirmada ante el proveedor. | ← evento `PagoProcesado` (APROBADO). |
| `CANCELADA` | Pago rechazado o cancelación explícita. | ← evento `PagoProcesado` (RECHAZADO) o `DELETE`. |
| `EXPIRADA` | El hold venció sin pago. | ← job de expiración (TTL Redis). |

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/bookings` | Crea una reserva (estado `PENDIENTE`) con hold temporal. | Bearer JWT |
| `GET` | `/bookings/{id}` | Consulta el estado y detalle de una reserva. | Bearer JWT |
| `DELETE` | `/bookings/{id}` | Cancela una reserva pendiente (libera hold). | Bearer JWT |

---

## `POST /bookings`

### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Authorization` | Sí | `Bearer <JWT>` |
| `Content-Type` | Sí | `application/json` |

### Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `ofertaId` | string | Sí | Id de la oferta obtenida en `GET /search`. |
| `searchId` | string | No | Id de la búsqueda de origen (trazabilidad). |
| `pasajeros` | array\<Pasajero\> | Sí | Datos de pasajeros/huéspedes (mín. 1). |
| `contacto` | Contacto | Sí | Email y teléfono para notificaciones. |

**Pasajero**

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `nombre` | string | Sí | Nombre completo. |
| `documento` | string | Sí | Nº de documento/pasaporte. |
| `tipo` | enum (`adulto` \| `nino`) | Sí | Tipo de pasajero. |
| `fechaNacimiento` | date | No | `YYYY-MM-DD`. |

### Ejemplo de request

```json
POST /bookings
{
  "ofertaId": "off_flt_001",
  "searchId": "srch_a1b2c3",
  "pasajeros": [
    { "nombre": "Ana Pérez", "documento": "1234567", "tipo": "adulto" }
  ],
  "contacto": { "email": "ana@example.com", "telefono": "+59170000000" }
}
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `201 Created` | Reserva creada en `PENDIENTE` con hold. | Hay disponibilidad. |
| `400 Bad Request` | Body inválido. | Validación de campos. |
| `401 Unauthorized` | Token ausente/inválido. | Middleware de seguridad. |
| `409 Conflict` | Oferta expirada / sin disponibilidad. | El proveedor ya no la ofrece. |
| `422 Unprocessable Entity` | Datos de pasajeros incompletos/incoherentes. | Reglas de negocio. |
| `502 Bad Gateway` | El proveedor no respondió al verificar. | Falla del GDS/Hoteles. |

### `201 Created` — cuerpo

```json
{
  "reservaId": "bkg_9f8e7d",
  "estado": "PENDIENTE",
  "ofertaId": "off_flt_001",
  "monto": { "total": 6200.00, "moneda": "BOB" },
  "hold": {
    "expiraEn": "2026-07-15T18:20:00Z",
    "ttlSegundos": 900
  },
  "pago": {
    "requerido": true,
    "endpoint": "/bookings/bkg_9f8e7d/pay"
  }
}
```

> El cliente debe pagar **antes de `hold.expiraEn`**. Pasado ese tiempo la reserva pasa a `EXPIRADA`.

---

## `GET /bookings/{id}`

### Path parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Id de la reserva (`reservaId`). |

### Respuestas

| Código | Significado |
|--------|-------------|
| `200 OK` | Devuelve el detalle y estado actual. |
| `401 Unauthorized` | Token inválido. |
| `403 Forbidden` | La reserva no pertenece al usuario. |
| `404 Not Found` | No existe una reserva con ese id. |

### `200 OK` — cuerpo

```json
{
  "reservaId": "bkg_9f8e7d",
  "estado": "CONFIRMADA",
  "localizador": "ABC123",
  "monto": { "total": 6200.00, "moneda": "BOB" },
  "creadaEn": "2026-07-15T18:05:00Z",
  "actualizadaEn": "2026-07-15T18:12:00Z"
}
```

---

## `DELETE /bookings/{id}`

Cancela una reserva **en estado `PENDIENTE`** y libera el hold.

### Respuestas

| Código | Significado |
|--------|-------------|
| `200 OK` | Reserva cancelada. |
| `401 Unauthorized` | Token inválido. |
| `404 Not Found` | No existe. |
| `409 Conflict` | No cancelable (ya `CONFIRMADA`; usar flujo de reembolso). |

---

## Eventos

| Dirección | Evento | Payload | Efecto |
|-----------|--------|---------|--------|
| **Emite** | `ReservaCreada` | `{ reservaId, ofertaId, monto }` | Notifica creación (trazabilidad/analytics). |
| **Emite** | `ReservaConfirmada` | `{ reservaId, localizador }` | Dispara notificación al viajero. |
| **Emite** | `ReservaCancelada` | `{ reservaId, motivo }` | Puede disparar reembolso en Pagos. |
| **Consume** | `PagoProcesado` | `{ reservaId, estado }` | `APROBADO` → confirma; `RECHAZADO` → cancela. |

---

## Errores — cuerpo estándar

```json
{
  "error": {
    "code": "OFFER_EXPIRED",
    "message": "La oferta seleccionada ya no está disponible.",
    "traceId": "b7c1e2f0-..."
  }
}
```

| `code` | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Body inválido. |
| `UNAUTHORIZED` | 401 | Token ausente/inválido. |
| `FORBIDDEN` | 403 | Reserva de otro usuario. |
| `NOT_FOUND` | 404 | Reserva inexistente. |
| `OFFER_EXPIRED` | 409 | Sin disponibilidad / oferta vencida. |
| `NOT_CANCELLABLE` | 409 | Estado no permite cancelación directa. |
| `PASSENGER_DATA_INVALID` | 422 | Datos de pasajeros incoherentes. |
| `PROVIDER_UNAVAILABLE` | 502 | Proveedor no respondió. |

## Notas de diseño

- **Hold con TTL:** el bloqueo vive en Redis (`hold:{reservaId}`); su expiración
  desencadena el paso a `EXPIRADA` (ver sección C del diagrama).
- **Confirmación asíncrona:** la reserva se confirma al recibir `PagoProcesado`, no
  en la misma llamada HTTP de creación.
- **Consistencia:** el cambio de estado en PostgreSQL y la liberación del hold ocurren
  en la misma transacción lógica del handler del evento.
