# Arquitectura P07 - Notificaciones

Diagramas PlantUML alineados con RF-7.1 a RF-7.5 y con la implementación actual.

## Decisiones vigentes

- Los servicios internos llegan autenticados por infraestructura previa; P07 no
  implementa autenticación ni autorización.
- PostgreSQL es la fuente de verdad para idempotencia, estado e intentos.
- Redis Streams desacopla la API del worker. El worker usa consumer groups,
  `XAUTOCLAIM` para pendientes y `XACK` después de persistir el resultado.
- Los reintentos automáticos usan un sorted set y backoff exponencial. El valor
  predeterminado es 3 intentos, demora base de 30 segundos y tope de 5 minutos.
- EMAIL usa Nodemailer con Gmail SMTP y secretos por variables de entorno.
- SMS queda preparado mediante una interfaz común, pero sin proveedor. Se marca
  como fallo terminal `SMS_PROVIDER_NOT_CONFIGURED`.
- PostgreSQL, Redis y SMTP no forman una transacción distribuida. Locks, estado,
  marca `delivered` y `Message-ID` determinista reducen duplicados, pero no dan
  una garantía matemática exactly-once.

## Diagramas

- C4: contexto, contenedores, componentes y clases.
- BP: envío, gestión de plantillas, consulta/historial y reintento.
- HLD: secuencia de alto nivel de API y worker.
- LLD: notificaciones y plantillas.
