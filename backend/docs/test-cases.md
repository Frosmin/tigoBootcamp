# TestCases P07

| ID | Escenario | Resultado |
|---|---|---|
| TC-01 | Plantilla y variables válidas | `202`, luego `ENVIADA`, un intento exitoso. |
| TC-02 | Falta o sobra una variable | `400`, sin notificación ni outbox. |
| TC-03 | Misma idempotency key y payload concurrente | Una fila, un outbox y una entrega; duplicados `200`. |
| TC-04 | Misma key con payload distinto | `409`. |
| TC-05 | Redis caído al crear | `202`; outbox pendiente y publicación posterior. |
| TC-06 | Error temporal del proveedor | Intentos fallidos, backoff exponencial y éxito o `FALLIDA`. |
| TC-07 | Error permanente | `FALLIDA` sin reintento automático adicional. |
| TC-08 | Reintento manual | Solo `FALLIDA`, nueva generación y máximo total respetado. |
| TC-09 | Reintento de `ENVIADA`/`ENCOLADA` | `409`, sin nuevo outbox. |
| TC-10 | Cursor con filtros | Sin duplicados ni saltos; cursor inválido `400`. |
| TC-11 | Plantilla modificada después de encolar | Se entrega el snapshot original. |
| TC-12 | SMS deshabilitado | `503`, sin persistencia. |
| TC-13 | Dos workers y rate limit | Máximo global configurado por minuto. |
| TC-14 | Relay/worker termina por SIGTERM | No toma trabajo nuevo y cierra conexiones ordenadamente. |
| TC-15 | K6 | `http_req_duration p(95)<500` y `http_req_failed<1%`. |
