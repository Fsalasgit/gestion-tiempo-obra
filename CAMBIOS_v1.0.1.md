# ObraTiempo v1.0.1 — Corrección al abrir Gantt por proyecto

## Error corregido
La pantalla arrancaba con `projectId` vacío. Hasta que el usuario eligiera una obra, `project` era `undefined`, pero `effectiveStart` intentaba leer `project.inicio`; esto detenía el render de React.

## Solución
- `effectiveStart()` acepta `undefined`, `null` y proyectos sin fechas.
- `ProjectGantt` espera de forma segura a que haya una obra seleccionada; también se protege al cambiar a un proyecto inexistente.
- Prueba de regresión incluida.
- Sin cambios de API ni de datos: no se requiere actualización de Apps Script.
- Conserva la clave de almacenamiento local usada en las versiones anteriores.

## Actualización
Reemplazar los archivos de React por esta versión y ejecutar `npm test`, `npm run build` y `git push`. No hace falta borrar caché local ni datos guardados.
