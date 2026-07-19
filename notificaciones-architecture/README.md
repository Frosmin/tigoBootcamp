# Arquitectura P07 - Notificaciones

Diagramas PlantUML alineados con los requisitos RF-7.1 a RF-7.5 y con el
backend implementado mediante BullMQ, Redis, PostgreSQL y transactional outbox.

## Decisiones de arquitectura

- Los servicios internos llegan autenticados por la infraestructura previa.
- P07 no implementa autenticación, autorización ni verificación de usuarios.
- Email usa Gmail SMTP mediante Nodemailer; SMS usa un adaptador HTTP genérico
  cuyo proveedor definitivo aún no está definido.
- PostgreSQL es la fuente de verdad para plantillas, notificaciones,
  idempotencia, estados, intentos y eventos outbox.
- La API confirma `notificacion` y `notification_outbox` en una misma
  transacción y no depende de Redis para responder `202 Accepted`.
- El Outbox Publisher crea jobs BullMQ. Redis conserva únicamente información
  operativa de la cola, backoff y rate limiting.
- El worker entrega, registra intentos y deja a BullMQ programar los reintentos
  automáticos con backoff exponencial.
- La entrega es al menos una vez. Job IDs estables, advisory locks, comprobación
  de `ENVIADA` e identificadores deterministas reducen duplicados sin afirmar
  una garantía exactly-once.

## Diagramas

- C4: contexto, contenedores, componentes y vista de código/modelo.
- BP: envío, gestión de plantillas, consulta/historial y reintento manual.
- HLD: aceptación durable, publicación outbox y entrega end-to-end.
- LLD: API de notificaciones, entrega asíncrona y gestión de plantillas.

Cada fuente `.puml` tiene un PNG renderizado en el mismo directorio. Los HLD y
LLD se mantienen separados por responsabilidad para que puedan leerse a escala
normal durante una revisión o defensa.
