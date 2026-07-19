el proyecto toma como que todos los usuarios que interactuan con el microservicio esta autenticados por esa razon no es necesario hacer las capas de autenticacion y verificar los usuarios que interactuan con el sistema 
la libreria de sms y gmail no son de tigo es una generica o de terceros esto para los diagramas


importan el pdf de requerimientos es importante tenemos que cumplir todo lo que piden menos autenticaion y uso se tigolibreria para sms y gmail para eso se usa otras  si los diagramas de arquitectura estan mal o contradicen lo que pide el pdf de requerimientos se debe hacer caso al pdf de requerimientos no a los diagramas de arquitectura solo obviar que la libreria de sms y gmail son de tigo (importante) 

solo implementa lo que te digo 

por ahora no toques los de sonarQube dejalo tal cual la key esta expuesta a proposito no es un error 
tampoco implementes jenkins 


para email se usar el smpt de google gmail 
para sms (aun por definir el proveedor)
aun no hagas documentacion con openapi 



implementacion que quiero BullMQ + Redis + PostgreSQL como fuente de verdad + patrón transactional outbox.


cosas que faltan para implementar
1 (completado)
PUT /templates/:id y DELETE /templates/:id
Completa primero la gestión de plantillas. Incluye validación de id, evitar actualizar a un nombre/canal ya existente y bloquear el borrado si la plantilla ya tiene notificaciones asociadas.

2 (completado)
GET /notifications
Implementa el listado con filtros opcionales canal y estado, más paginación (page, limit). Es relativamente aislado y te deja verificar el historial creado por los demás flujos.

3(completado )
 worker BullMQ + Redis + PostgreSQL como fuente de verdad + patrón transactional outbox.

4(completado)
POST /notifications/:id/retry
Construye este endpoint sobre el worker ya funcional: valida que exista, que esté en FALLIDA, que no exceda el máximo de intentos y vuelve a encolarla aplicando el backoff exponencial. Nunca debe reenviar una notificación ENVIADA.


Pruebas que faltan 
SonarCube(Completado)
Jenkins
Openapi(completado)
k6
trivy(completado)
