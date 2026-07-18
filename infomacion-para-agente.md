el proyecto toma como que todos los usuarios que interactuan con el microservicio esta autenticados por esa razon no es necesario hacer las capas de autenticacion y verificar los usuarios que interactuan con el sistema 
la libreria de sms y gmail no son de tigo es una generica o de terceros esto para los diagramas

solo implementa lo que te digo 

por ahora no toques los de sonarQube dejalo tal cual 
tampoco implementes jenkins 


para email se usar el smpt de google gmail 
para sms (aun por definir el proveedor)


cosas que faltan para implementar
1
PUT /templates/:id y DELETE /templates/:id
Completa primero la gestión de plantillas. Incluye validación de id, evitar actualizar a un nombre/canal ya existente y bloquear el borrado si la plantilla ya tiene notificaciones asociadas.

2
GET /notifications
Implementa el listado con filtros opcionales canal y estado, más paginación (page, limit). Es relativamente aislado y te deja verificar el historial creado por los demás flujos.

3
Worker de envío y persistencia de intentos
Aunque no es un endpoint, es indispensable: debe consumir Redis, enviar por email/SMS, actualizar estado (ENCOLADA, ENVIADA, FALLIDA) y registrar cada intento en intento.

4
POST /notifications/:id/retry
Construye este endpoint sobre el worker ya funcional: valida que exista, que esté en FALLIDA, que no exceda el máximo de intentos y vuelve a encolarla aplicando el backoff exponencial. Nunca debe reenviar una notificación ENVIADA.

