# LLD - Notificaciones

**Stack:** Node.js 22, ultimate-express, Zod, PostgreSQL 15, Redis 8 y BullMQ 5.

La API confirma una notificación `ENCOLADA` y su outbox en una transacción. No
abre una conexión Redis, de modo que una caída de Redis no pierde ni rechaza el
trabajo ya durable. El relay publica por canal con `addBulk` y job ID
`notification-{id}-g{generacion}`.

El worker reclama un lease condicional en PostgreSQL. Estados enviados,
generaciones antiguas y jobs duplicados terminan sin llamar al proveedor. Cada
invocación real produce un `intento`; éxito e intento se confirman juntos.

Los errores temporales consumen hasta tres intentos automáticos por generación
con backoff exponencial y jitter. El máximo total es cinco. Un reintento manual
solo acepta `FALLIDA`, incrementa generación y usa los intentos restantes.

El listado usa `(created_at,id)` como cursor keyset, evitando offsets crecientes.

## Semántica SMTP

El `Message-ID` es determinista. Aun así, SMTP no puede participar en el commit:
un crash posterior al ACK y anterior a PostgreSQL conserva una ventana residual
de repetición. No se sacrifica entrega marcando `ENVIADA` antes del proveedor.
