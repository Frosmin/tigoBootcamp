# Template Architecture — Reservas de Vuelos y Hoteles (Backend)

Repositorio de **arquitectura y documentación** del backend del sistema de
**Reservas de Vuelos y Hoteles**, modelado con [C4](https://c4model.com/) y
diagramas de secuencia HLD/LLD usando [PlantUML](https://plantuml.com/) +
[C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML).

El objetivo es servir de **plano de referencia** para implementar los servicios backend
antes (y durante) el desarrollo.

## Stack objetivo

| Capa | Tecnología |
|------|------------|
| Runtime / Framework | **Node.js / ultimate-express** |
| Base de datos | **PostgreSQL** (driver `pg`) |
| Cache / holds | **Redis** |
| Mensajería | **Bus de eventos** (Kafka / RabbitMQ) |
| Autenticación | **OAuth2 / OIDC** (proveedor externo) |

## Backends modelados

- **Servicio de Búsqueda** — agrega y normaliza disponibilidad/tarifas de vuelos y hoteles.
- **Servicio de Reservas** — ciclo de vida de la reserva (hold, confirmación, cancelación, expiración).
- **Orquestador de Pagos** — cobro, idempotencia, reintentos y reembolsos.

## Estructura del repositorio

```
template-architecture/
├── binaries/          # plantuml.jar + librerías C4-PlantUML (uso local, sin red)
├── diagrams/          # todos los diagramas (fuentes .puml + .png/.svg + docs .md)
│   ├── C4/            # C4: contexto, contenedores, componentes, dinámico
│   ├── HLD/           # secuencia de alto nivel (los 3 backends juntos)
│   └── LLD/           # secuencia de bajo nivel + documentación por backend
│       ├── busqueda/
│       ├── reservas/
│       └── pagos/
└── README.md
```

## Diagramas

Toda la documentación de diagramas, con la lista completa y las descripciones, está en
**[diagrams/README.md](diagrams/README.md)**.

| Tipo | Contenido |
|------|-----------|
| **C4** | Contexto (C1), Contenedores (C2), Componentes (C3) y Código/Clases (C4). |
| **HLD** | Diagrama de secuencia de alto nivel que abarca los 3 backends. |
| **LLD** | Un diagrama de secuencia por backend + un `.md` con endpoints, parámetros y respuestas. |

## Cómo regenerar los diagramas

Requiere **Java** (probado con OpenJDK 8). El `plantuml.jar` y las librerías C4 están en
[`binaries/`](binaries/), por lo que **no se necesita conexión a internet**.

Desde la carpeta [`diagrams/`](diagrams/):

```bash
# C4
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tpng "C4/contexto/*.puml" "C4/contenedores/*.puml" "C4/componentes/*.puml" "C4/dinamico/*.puml"

# Secuencia (HLD + LLD)
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tpng "HLD/*.puml" "LLD/busqueda/*.puml" "LLD/reservas/*.puml" "LLD/pagos/*.puml"
```

> Usa `-tsvg` en lugar de `-tpng` para generar SVG vectorial.
> El flag `-charset UTF-8` es obligatorio para que los acentos se rendericen bien.
> Ver [diagrams/README.md](diagrams/README.md) para detalles y notas de compilación.

## Estado del proyecto

Fase de **diseño / arquitectura**. Los diagramas y contratos de API sirven como base
para la implementación de los servicios backend.
