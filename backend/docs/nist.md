# Controles NIST - P07 Notificaciones

## Identificar y proteger

- PostgreSQL es la fuente de verdad; Redis no contiene el único registro de una solicitud.
- Los consumidores llegan autenticados por la infraestructura previa. P07 valida contratos y reglas, no identidad.
- Secretos PostgreSQL, Redis, SMTP, Sonar, AppScan y despliegue provienen del entorno o Jenkins Credentials.
- Helmet, CSP, límite JSON de 64 KiB, Zod estricto y SQL parametrizado reducen superficie de ataque.
- Logs excluyen cuerpo, variables, destinatario completo y credenciales.

## Detectar

- Métricas HTTP se exponen en `/metrics`; BullMQ conserva métricas de completados y fallidos.
- Logs correlacionan `notificationId`, `jobId`, generación e intento sin PII.
- Alertar por crecimiento del outbox pendiente, jobs fallidos, jobs stalled y antigüedad de `ENCOLADA`.

## Responder y recuperar

- Caída de Redis: la API continúa aceptando; el outbox reintenta al recuperarse.
- Caída del relay: leases expiran y otra réplica reclama el lote.
- Caída del worker: BullMQ recupera jobs stalled; la guarda PostgreSQL bloquea entregados o generaciones antiguas.
- PostgreSQL no disponible: readiness y solicitudes dependientes devuelven error; no se acepta trabajo sin persistencia.
- Redis usa AOF `everysec` y política `noeviction`.

## Riesgo residual

SMTP no participa en la transacción PostgreSQL. Si Gmail confirma y el worker cae antes de guardar `ENVIADA`, existe
una ventana mínima de repetición. El `Message-ID` determinista y las guardas reducen, pero no eliminan, ese riesgo.
