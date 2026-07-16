# LLD — Worker de Envíos

**Stack:** Node.js · Redis · PostgreSQL (`pg`) · Tigo Library (email/SMS)  
**Diagrama:** [notificaciones-08-lld-worker.puml](notificaciones-08-lld-worker.puml)

Consume trabajos de notificación, renderiza la plantilla, aplica el límite de
throughput y entrega el contenido mediante el conector de email/SMS de Tigo Library.
Registra cada intento y programa reintentos con backoff sin bloquear el proceso.

Este componente no expone endpoints REST; su entrada es la cola Redis y su salida
observable son los estados e intentos persistidos en PostgreSQL.

---

## Máquina de estados

| Estado actual | Condición | Estado resultante |
|---------------|-----------|-------------------|
| `ENCOLADA` | Entrega confirmada por el proveedor. | `ENVIADA` |
| `ENCOLADA` | Fallo reintentable y quedan intentos. | `ENCOLADA` con trabajo diferido |
| `ENCOLADA` | Error terminal o máximo alcanzado. | `FALLIDA` |
| `ENVIADA` | Llega un trabajo duplicado. | `ENVIADA`; el trabajo se descarta |

La reprogramación causada únicamente por el límite de throughput no incrementa el
número de intentos.

---

## Contrato del trabajo

La cola transporta el identificador de la notificación persistida:

```text
ntf_7f18d2
```

El worker obtiene de PostgreSQL los datos completos antes de enviar:

| Dato | Origen | Uso |
|------|--------|-----|
| `canal` | Notificación | Selecciona EMAIL o SMS. |
| `destinatario` | Notificación | Dirección o número de destino. |
| `plantillaId` | Notificación | Recupera el contenido y variables declaradas. |
| `variables` | Notificación | Renderiza el contenido final. |
| `estado` | Notificación | Evita procesar registros ya enviados. |
| `intentos` | Notificación | Evalúa la política de reintentos. |

Un trabajo cuyo `notificacionId` no existe se registra como huérfano y se descarta.

---

## Secuencia de procesamiento

1. Consume el siguiente `notificacionId` disponible en Redis.
2. Consulta la notificación; descarta trabajos huérfanos.
3. Comprueba el estado y la marca de entrega para evitar duplicados.
4. Solicita permiso al limitador de throughput.
5. Si no hay capacidad, reprograma el trabajo sin consumir un intento.
6. Obtiene y renderiza la plantilla con las variables persistidas.
7. Invoca Tigo Library y espera únicamente la respuesta del intento actual.
8. Registra un `Intento` con resultado `EXITOSO` o `FALLIDO`.
9. Actualiza el estado o publica un trabajo diferido según la política de reintentos.

---

## Conector de entrega

### Entrada lógica

```json
{
  "canal": "EMAIL",
  "destinatario": "ana@example.com",
  "contenido": "Hola Ana, tu pedido ABC123 fue confirmado."
}
```

### Resultado lógico

```json
{
  "exitoso": false,
  "codigo": "PROVIDER_TIMEOUT",
  "detalle": "El proveedor no respondió dentro del tiempo configurado.",
  "reintentable": true
}
```

La adaptación concreta hacia email o SMS pertenece al conector Tigo Library. El
worker consume un resultado normalizado y no depende del formato nativo del proveedor.

---

## Registro de intentos

| Campo | Descripción |
|-------|-------------|
| `id` | Identificador del intento. |
| `notificacionId` | Notificación procesada. |
| `numero` | Posición del intento dentro del ciclo de entrega. |
| `resultado` | `EXITOSO` o `FALLIDO`. |
| `detalle` | Respuesta normalizada o causa del fallo. |
| `timestamp` | Fecha y hora del intento. |

### Ejemplo de intento fallido

```json
{
  "id": "att_001",
  "notificacionId": "ntf_7f18d2",
  "numero": 1,
  "resultado": "FALLIDO",
  "detalle": "PROVIDER_TIMEOUT: El proveedor no respondió.",
  "timestamp": "2026-07-15T22:10:05Z"
}
```

---

## Reintentos y backoff

| Decisión | Comportamiento |
|----------|----------------|
| Fallo reintentable y quedan intentos | Calcula la demora y crea un trabajo diferido en Redis. |
| Fallo no reintentable | Marca la notificación `FALLIDA`. |
| Máximo de intentos alcanzado | Marca la notificación `FALLIDA`. |
| Reintento diferido listo | Redis lo devuelve a la cola para un nuevo ciclo. |

El máximo de intentos, la demora base y la fórmula de backoff provienen de la
configuración. El worker no hace `sleep`: libera el ciclo después de programar el
trabajo diferido.

---

## Throughput

Redis mantiene el contador compartido de envíos dentro de la ventana actual. El
límite de envíos por minuto es configurable y se aplica antes de llamar al proveedor.

| Resultado del limitador | Acción |
|-------------------------|--------|
| Permiso concedido | Continúa con renderizado y entrega. |
| Capacidad agotada | Programa el trabajo para la siguiente ventana. |

La reprogramación por capacidad no crea un registro `Intento`, porque el proveedor
todavía no fue invocado.

---

## Dependencias externas

| Dependencia | Uso | Falla → efecto |
|-------------|-----|----------------|
| Redis | Cola, trabajos diferidos, throughput y marcas de entrega. | El worker no procesa ni confirma el trabajo hasta recuperar la coordinación. |
| PostgreSQL | Notificaciones, plantillas e intentos. | No se envía sin poder consultar y registrar el resultado. |
| Tigo Library | Adaptación del envío EMAIL/SMS. | El resultado se clasifica como fallo de entrega. |
| Proveedor email/SMS | Entrega final. | Se aplica la política según el tipo de error normalizado. |

## Notas de diseño

- **Sin duplicados:** se consulta el estado persistido y la marca de entrega antes
  de invocar al proveedor; una notificación `ENVIADA` se descarta.
- **Persistencia del resultado:** cada invocación al proveedor produce un intento
  auditable antes de cerrar o reprogramar el ciclo.
- **Backoff no bloqueante:** los trabajos diferidos permiten que el worker continúe
  procesando otras notificaciones.
- **Configuración externa:** throughput, máximo de intentos y demoras no tienen
  valores fijos en el diseño.
