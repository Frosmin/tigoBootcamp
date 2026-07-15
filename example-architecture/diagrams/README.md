# Diagramas C4 — Sistema de Reservas de Vuelos y Hoteles (Backend / API)

Diagramas de arquitectura del backend usando el modelo [C4](https://c4model.com/)
con [C4-PlantUML](https://github.com/plantuml-stdlib/C4-PlantUML). Las librerías C4 y
el `plantuml.jar` están en la carpeta [`../binaries/`](../binaries/).

## Diagramas

| Nivel | Archivo | Descripción |
|-------|---------|-------------|
| C1 · Contexto | [C4/contexto/reservas-01-contexto.puml](C4/contexto/reservas-01-contexto.puml) | El sistema, sus usuarios y los sistemas externos (identidad, GDS, hoteles, pagos, notificaciones). |
| C2 · Contenedores | [C4/contenedores/reservas-02-contenedores.puml](C4/contenedores/reservas-02-contenedores.puml) | API REST, servicios de búsqueda/reservas/pagos, base de datos, cache y bus de eventos. |
| C3 · Componentes | [C4/componentes/reservas-03-componentes.puml](C4/componentes/reservas-03-componentes.puml) | Estructura interna de la API REST: controladores, servicios de aplicación, repositorios y **librerías conectoras**. |
| C4 · Código (Clases) | [C4/clases/reservas-04-clases.puml](C4/clases/reservas-04-clases.puml) | Diagrama de clases del backend: dominio (Reserva, Pago, Oferta, Pasajero, enums), servicios, repositorios y conectores. |

### Diagramas de secuencia

Organizados en subcarpetas por nivel de detalle:

| Nivel | Archivo | Descripción |
|-------|---------|-------------|
| HLD | [HLD/reservas-05-hld-secuencia.puml](HLD/reservas-05-hld-secuencia.puml) | Secuencia de alto nivel: interacción entre los 3 backends (Búsqueda → Reservas → Pagos) y sistemas externos. |
| LLD | [LLD/busqueda/reservas-06-lld-busqueda.puml](LLD/busqueda/reservas-06-lld-busqueda.puml) · [📄 doc](LLD/busqueda/reservas-06-lld-busqueda.md) | Detalle interno del **Servicio de Búsqueda** (cache hit/miss, consultas paralelas a GDS/Hoteles). |
| LLD | [LLD/reservas/reservas-07-lld-reservas.puml](LLD/reservas/reservas-07-lld-reservas.puml) · [📄 doc](LLD/reservas/reservas-07-lld-reservas.md) | Detalle interno del **Servicio de Reservas** (hold, confirmación tras pago, expiración). |
| LLD | [LLD/pagos/reservas-08-lld-pagos.puml](LLD/pagos/reservas-08-lld-pagos.puml) · [📄 doc](LLD/pagos/reservas-08-lld-pagos.md) | Detalle interno del **Orquestador de Pagos** (idempotencia, reintentos, reembolso). |

Cada LLD tiene un `.md` que documenta sus **endpoints, parámetros de entrada,
respuestas posibles (con códigos HTTP y ejemplos JSON) y eventos** consumidos/emitidos.

### Proceso de negocio (BPMN)

| Formato | Archivo | Descripción |
|---------|---------|-------------|
| **BPMN 2.0** (editable) | [BP/reservas-10-bp-reserva.bpmn](BP/reservas-10-bp-reserva.bpmn) | Proceso de reserva en **notación BPMN estándar**, con **5 carriles** (Viajero, Servicio de Búsqueda, Servicio de Reservas, Orquestador de Pagos, Notificaciones), gateways de decisión y eventos de inicio/fin. Se abre/edita en [bpmn.io](https://demo.bpmn.io/), Camunda Modeler o Bizagi. |
| PlantUML (vista rápida) | [BP/reservas-09-bp-reserva.puml](BP/reservas-09-bp-reserva.puml) | Misma idea como diagrama de actividades con swimlanes; se renderiza a PNG/SVG con el `plantuml.jar` (offline). |

> El `.bpmn` es el equivalente al estilo BPMN clásico (carriles horizontales, tareas
> redondeadas, eventos circulares, flujos de mensaje punteados y anotaciones `BR`).
> Para editarlo visualmente, arrástralo a <https://demo.bpmn.io/> o ábrelo en Camunda Modeler.

## Cómo regenerar las imágenes

Desde esta carpeta (`diagrams/`):

```bash
# Diagramas C4 (cada uno en su propia subcarpeta bajo C4/)
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tpng "C4/contexto/*.puml" "C4/contenedores/*.puml" "C4/componentes/*.puml" "C4/clases/*.puml"
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tsvg "C4/contexto/*.puml" "C4/contenedores/*.puml" "C4/componentes/*.puml" "C4/clases/*.puml"

# Diagramas de secuencia (cada LLD en su propia subcarpeta)
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tpng "HLD/*.puml" "LLD/busqueda/*.puml" "LLD/reservas/*.puml" "LLD/pagos/*.puml"
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tsvg "HLD/*.puml" "LLD/busqueda/*.puml" "LLD/reservas/*.puml" "LLD/pagos/*.puml"

# Proceso de negocio (BPMN)
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tpng "BP/*.puml"
java -jar ../binaries/plantuml-1.2025.4.jar -charset UTF-8 -tsvg "BP/*.puml"
```

### Notas importantes

- **`-charset UTF-8`** es obligatorio para que los acentos (á, é, í, ó, ú, ñ) se
  rendericen correctamente.
- Cada diagrama **C4** define `!define RELATIVE_INCLUDE "."` antes del `!include`. Esto
  fuerza a C4-PlantUML a usar las librerías **locales** de `binaries/` en lugar de
  descargarlas de `raw.githubusercontent.com` (necesario porque el entorno no tiene
  acceso/certificados para esa descarga). La ruta del `!include` es
  `../../../binaries/` porque cada C4 vive en `diagrams/C4/<tema>/`.
- En los diagramas de **secuencia**, los bloques paralelos usan `par ... else ... end`
  (este build del `plantuml.jar` no acepta `and` como divisor de `par`).
