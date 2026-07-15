# LLD — Orquestador de Pagos

**Stack:** Node.js / ultimate-express · PostgreSQL (`pg`) · Conector a pasarela · Bus de eventos
**Diagrama:** [reservas-08-lld-pagos.puml](reservas-08-lld-pagos.puml)

Orquesta el cobro asociado a una reserva y el reembolso ante cancelaciones.
Garantiza **idempotencia** (no duplicar cobros) y **reintentos con backoff** ante fallos transitorios de la pasarela.

---

## Máquina de estados del pago

| Estado | Descripción |
|--------|-------------|
| `PENDIENTE` | Registro creado, cobro en curso. |
| `APROBADO` | Pasarela confirmó el cobro. |
| `RECHAZADO` | Pasarela rechazó el cobro. |
| `REEMBOLSADO` | Cobro aprobado y luego devuelto. |

---

## Endpoints

| Método | Ruta | Descripción | Auth |
|--------|------|-------------|------|
| `POST` | `/bookings/{id}/pay` | Cobra una reserva pendiente. | Bearer JWT |
| `GET` | `/payments/{paymentId}` | Consulta el estado de un pago. | Bearer JWT |

---

## `POST /bookings/{id}/pay`

Procesa el cobro de la reserva `{id}`. **Idempotente** vía `Idempotency-Key`.

### Headers

| Header | Requerido | Descripción |
|--------|-----------|-------------|
| `Authorization` | Sí | `Bearer <JWT>` |
| `Content-Type` | Sí | `application/json` |
| `Idempotency-Key` | Sí | Clave única del intento. Reintentos con la misma clave devuelven el mismo resultado. |

### Path parameters

| Parámetro | Tipo | Descripción |
|-----------|------|-------------|
| `id` | string | Id de la reserva (`reservaId`) a pagar. |

### Body

| Campo | Tipo | Requerido | Descripción |
|-------|------|-----------|-------------|
| `medioPago` | enum (`tarjeta` \| `qr` \| `wallet`) | Sí | Método de pago. |
| `token` | string | Condicional¹ | Token de tarjeta (tokenizada, PCI). |
| `monto` | Money | Sí | Debe coincidir con el monto de la reserva. |
| `cuotas` | integer (≥1) | No | Nº de cuotas (si aplica). Def. `1`. |

**Money**: `{ "total": number, "moneda": string (ISO 4217) }`

> ¹ `token` es requerido cuando `medioPago = tarjeta`.

### Ejemplo de request

```json
POST /bookings/bkg_9f8e7d/pay
Idempotency-Key: 6f1a2b3c-idem-key
{
  "medioPago": "tarjeta",
  "token": "tok_visa_4242",
  "monto": { "total": 6200.00, "moneda": "BOB" }
}
```

### Respuestas

| Código | Significado | Cuándo ocurre |
|--------|-------------|---------------|
| `200 OK` | Pago **aprobado** (o resultado idempotente previo). | Cobro exitoso, o misma `Idempotency-Key` ya procesada. |
| `400 Bad Request` | Body inválido. | Validación de campos. |
| `401 Unauthorized` | Token ausente/inválido. | Middleware de seguridad. |
| `402 Payment Required` | Pago **rechazado** por la pasarela. | Fondos insuficientes, tarjeta inválida, etc. |
| `404 Not Found` | Reserva inexistente. | `{id}` no existe. |
| `409 Conflict` | Estado de reserva no cobrable. | Reserva `EXPIRADA`/`CANCELADA`/ya pagada. |
| `422 Unprocessable Entity` | El `monto` no coincide con la reserva. | Discrepancia de importe/moneda. |
| `502 Bad Gateway` | Pasarela inaccesible tras reintentos. | Falla persistente del proveedor. |
| `504 Gateway Timeout` | Timeout de la pasarela. | Sin respuesta a tiempo. |

### `200 OK` — cuerpo (aprobado)

```json
{
  "paymentId": "pay_5a4b3c",
  "reservaId": "bkg_9f8e7d",
  "estado": "APROBADO",
  "transaccionId": "txn_gw_998877",
  "monto": { "total": 6200.00, "moneda": "BOB" },
  "procesadoEn": "2026-07-15T18:12:00Z",
  "idempotente": false
}
```

> Cuando la respuesta proviene de una `Idempotency-Key` ya procesada, `idempotente: true`
> y el cuerpo es idéntico al de la primera llamada.

### `402 Payment Required` — cuerpo (rechazado)

```json
{
  "paymentId": "pay_5a4b3c",
  "reservaId": "bkg_9f8e7d",
  "estado": "RECHAZADO",
  "motivo": "INSUFFICIENT_FUNDS",
  "mensaje": "La tarjeta no tiene fondos suficientes."
}
```

---

## `GET /payments/{paymentId}`

### Respuestas

| Código | Significado |
|--------|-------------|
| `200 OK` | Devuelve estado y detalle del pago. |
| `401 Unauthorized` | Token inválido. |
| `404 Not Found` | Pago inexistente. |

```json
{
  "paymentId": "pay_5a4b3c",
  "reservaId": "bkg_9f8e7d",
  "estado": "APROBADO",
  "monto": { "total": 6200.00, "moneda": "BOB" },
  "historial": [
    { "estado": "PENDIENTE", "en": "2026-07-15T18:11:50Z" },
    { "estado": "APROBADO",  "en": "2026-07-15T18:12:00Z" }
  ]
}
```

---

## Eventos

| Dirección | Evento | Payload | Efecto |
|-----------|--------|---------|--------|
| **Emite** | `PagoProcesado` | `{ reservaId, estado: APROBADO\|RECHAZADO }` | Reservas confirma o cancela. |
| **Emite** | `PagoReembolsado` | `{ reservaId, paymentId }` | Cierra el ciclo de cancelación. |
| **Consume** | `ReservaCancelada` | `{ reservaId, motivo }` | Si había pago aprobado, dispara reembolso. |

---

## Errores — cuerpo estándar

```json
{
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "La tarjeta no tiene fondos suficientes.",
    "motivo": "INSUFFICIENT_FUNDS",
    "traceId": "b7c1e2f0-..."
  }
}
```

| `code` | HTTP | Descripción |
|--------|------|-------------|
| `VALIDATION_ERROR` | 400 | Body inválido. |
| `UNAUTHORIZED` | 401 | Token ausente/inválido. |
| `PAYMENT_DECLINED` | 402 | Cobro rechazado por la pasarela. |
| `NOT_FOUND` | 404 | Reserva/pago inexistente. |
| `BOOKING_NOT_PAYABLE` | 409 | Reserva no está en estado cobrable. |
| `AMOUNT_MISMATCH` | 422 | El monto no coincide con la reserva. |
| `GATEWAY_UNAVAILABLE` | 502 | Pasarela inaccesible tras reintentos. |
| `GATEWAY_TIMEOUT` | 504 | Timeout de la pasarela. |

## Notas de diseño

- **Idempotencia:** cada intento se registra con `Idempotency-Key`; una segunda llamada
  con la misma clave **no vuelve a cobrar**, devuelve el resultado guardado.
- **Reintentos:** ante `timeout`/errores transitorios se reintenta hasta 3 veces con
  backoff exponencial (ver `loop` en el diagrama).
- **Reembolso:** al consumir `ReservaCancelada` sobre un pago `APROBADO`, se ejecuta el
  reembolso y se emite `PagoReembolsado` (sección B del diagrama).
- **Seguridad/PCI:** nunca se reciben ni almacenan PAN de tarjetas; solo tokens de la pasarela.
