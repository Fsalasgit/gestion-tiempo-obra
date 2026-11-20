# ObraTiempo v1.3 · Gantt por jornadas y acceso cliente

- Gantt por proyecto: jornadas enteras; se quitó «horas-persona estimadas». Avance ponderado por jornadas. Se permite asignar varias tareas al mismo equipo en una misma fecha, sin bloquearlo.
- Movimiento sin motivo: al abrir `⋯`, se elige la fecha destino para desplazar la jornada y las siguientes sin registrar incidencia; opción de deshacer días saltados.
- Motivos opcionales: las incidencias y reprogramaciones expresamente registradas aparecen en tabla de novedades. Se pueden mantener privadas o publicarlas al cliente.
- Portal independiente en `/cliente`: login con usuario y contraseña, listado filtrado de sus proyectos, Gantt y tabla de novedades en modo lectura.
- Backend: rol `CLIENTE`, columna `projectIds`, APIs `client.list` y `client.project` filtradas por el actor. No expone workspaces completos ni datos de otros clientes.
- Sin edición de la pestaña `proyecto` desde estas pantallas; persiste en el mismo Apps Script versionado.
- El frontend Vercel incluye rewrite `/cliente`.

Validación: 100 pruebas automatizadas, 48 archivos con sintaxis JS/JSX/GS correcta. Build completo Vite pendiente (npm EAI_AGAIN).
