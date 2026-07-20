# Prueba de rendimiento K6

Este escenario mide la aceptacion asincrona de notificaciones mediante
`POST /api/v1/notifications` y falla si no se cumplen estos criterios:

- p95 menor a 500 ms.
- Tasa de solicitudes HTTP fallidas menor al 1%.
- Mas del 99% de los checks funcionales exitosos.
- Ninguna iteracion descartada por falta de VUs.

## Preparacion

La API y PostgreSQL deben estar disponibles. Para medir solamente la API no se
debe iniciar el worker, evitando entregas reales durante la prueba.

Crear previamente una plantilla EMAIL o SMS cuyo contenido use exactamente las
variables `nombre` y `pedido`, y conservar su identificador. `CHANNEL` debe
coincidir con el canal de la plantilla.

para crear la plantilla:

```powershell
$templateBody = @{
    nombre = "performance-email-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    canal = "EMAIL"
    contenido = "Hola {{nombre}}, pedido {{pedido}}."
    variables = @("nombre", "pedido")
} | ConvertTo-Json

$template = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3050/api/v1/templates" `
    -ContentType "application/json" `
    -Body $templateBody

$template
```

## Ejecucion en PowerShell

```powershell
$env:BASE_URL = "http://localhost:3050"
$env:TEMPLATE_ID = "13"
$env:CHANNEL = "EMAIL"
$env:RATE = "10"
$env:DURATION = "1m"
$env:PRE_ALLOCATED_VUS = "20"
$env:MAX_VUS = "100"
npm run test:performance:email
```



para levantar el servidor mock 
npm run dev:sms-mock

Para sms

```powershell
$templateBody = @{
    nombre = "performance-sms-$([DateTimeOffset]::UtcNow.ToUnixTimeSeconds())"
    canal = "SMS"
    contenido = "Hola {{nombre}}, pedido {{pedido}}."
    variables = @("nombre", "pedido")
} | ConvertTo-Json

$template = Invoke-RestMethod `
    -Method Post `
    -Uri "http://127.0.0.1:3050/api/v1/templates" `
    -ContentType "application/json" `
    -Body $templateBody

$template
```

## Ejecucion en PowerShell

```powershell
$env:BASE_URL = "http://localhost:3050"
$env:TEMPLATE_ID = "1"
$env:CHANNEL = "SMS"
$env:DESTINATION = "+59170000000"
$env:RATE = "10"
$env:DURATION = "1m"
$env:PRE_ALLOCATED_VUS = "20"
$env:MAX_VUS = "100"
npm run test:performance:sms
```



para bash 
export BASE_URL="http://localhost:3050"
export TEMPLATE_ID="1"
export CHANNEL="SMS"
export DESTINATION="+59170000000"
export RATE="10"
export DURATION="1m"
export PRE_ALLOCATED_VUS="20"
export MAX_VUS="100"

npm run test:performance:sms

`RATE` representa solicitudes por segundo. Los reportes se guardan como
`docs/evidencias/k6/summary-email.json` y `summary-sms.json`. K6 termina con un
codigo distinto de cero si falla cualquier threshold, por lo que el comando se
puede usar como gate de CI.

Ejecutar la prueba contra una base de datos exclusiva de performance porque
cada iteracion crea una notificacion persistente.

