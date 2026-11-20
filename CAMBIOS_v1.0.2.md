# ObraTiempo v1.0.2 — «Ver desde inicio» de tareas del proyecto

- El Gantt por proyecto comienza en la **primera jornada realmente planificada** de sus tareas, con o sin sector.
- Se conserva una incidencia histórica gris si fue anterior a la primera jornada restante.
- No utiliza `Inicio`, `Inicio P.` ni la fecha de alta de la fila del Excel para el botón «Ver desde inicio».
- Al seleccionar un proyecto, «Mes elegido» se sitúa en el mes de su primera actividad; sin tareas, muestra el mes actual.
- Un proyecto sin actividades no inventa fechas cuando se pulsa «Ver desde inicio».
- No modifica la hoja `proyecto`, las TP de colocación ni Apps Script.
- Pruebas de regresión: `tests/projectSchedule.test.js`.
