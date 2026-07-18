# Arquitectura P07 - Notificaciones con BullMQ

Fuentes PlantUML y PNG para RF-7.1 a RF-7.5.

## Decisiones

- Los emisores llegan autenticados por infraestructura previa.
- PostgreSQL es fuente de verdad y contiene notificaciones, snapshots, intentos y outbox.
- La API no escribe en Redis: confirma notificación + outbox en una transacción.
- Un relay publica lotes idempotentes en BullMQ; workers por canal aplican concurrencia, rate limit y backoff.
- Gmail SMTP es un proveedor genérico externo. SMS queda como puerto futuro deshabilitado.
- SMTP tiene una ventana residual de duplicado entre ACK y commit, documentada en el LLD.

## Vistas

- C4: contexto, contenedores, componentes, clases y despliegue.
- BP: envío, plantillas, consulta por cursor y reintento.
- HLD: secuencia extremo a extremo.
- LLD: contratos de notificaciones y plantillas.
