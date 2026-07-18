# LLD - Plantillas

POST crea, PUT reemplaza y DELETE aplica borrado lógico. `nombre` es único por
canal entre filas activas. `variables[]` debe coincidir exactamente con los
placeholders `{{variable}}` encontrados en `contenido`.

Una notificación guarda asunto y contenido renderizado antes de encolarse; por
ello una modificación o eliminación posterior no altera mensajes pendientes.
