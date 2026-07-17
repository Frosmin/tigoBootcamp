# Arquitectura P07 - Notificaciones

Diagramas PlantUML alineados con los requisitos RF-7.1 a RF-7.5.

## Decisiones de alcance

- Los servicios internos llegan autenticados por la infraestructura previa.
- P07 no implementa autenticación, autorización ni verificación de usuarios.
- P07 sí valida body, params, query y reglas de negocio.
- Email y SMS se integran mediante una librería genérica de terceros y un
  proveedor externo; no se modelan como componentes propios de Tigo.
- HLD y LLD se mantienen deliberadamente simples.

## Diagramas

- C4: contexto, contenedores, componentes y clases.
- BP: envío, gestión de plantillas, consulta/historial y reintento.
- HLD: secuencia de alto nivel.
- LLD: notificaciones y plantillas.
