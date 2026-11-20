# ObraTiempo v1.1 — Gantt completo y persistencia compartida

## Interfaz

- «Obra completa» agregado al filtro de **Gantt por proyecto**. La ventana comienza con la primera jornada o incidencia del proyecto y termina con la última jornada programada. No usa `Inicio` del catálogo ni prolonga la vista hasta hoy.
- Franjas resumen de obra y sectores continuas entre su inicio y final, con tareas individuales coloreadas por equipo.
- Los controles de fecha anteriores permanecen; navegar entre meses no genera una escritura al backend.
- Estado visible por documento: leyendo, cambio pendiente, guardando, guardado, error de red o conflicto de versión.

## Backend

- `workspace.load` y `workspace.save` autenticados; lectura para usuarios habilitados, escritura para SUPERADMIN / ADMIN / PLANIFICADOR.
- Dos documentos versionados: `capacity` y `projectGantt`. **No se escribe en `proyecto`** ni se afectan importaciones del Excel.
- `workspace_meta` + `workspace_chunks`: revisión, fecha, usuario, checksum y datos fragmentados en Base64URL de 18.000 caracteres por celda.
- Exclusión mutua con `LockService`; `expectedRevision` impide perder cambios simultáneos con escritura silenciosa.
- Se mantienen las versiones anteriores hasta ejecutar manualmente `compactWorkspaces()`.

## Migración

- Se exige **actualizar `Code.gs`, ejecutar `setup()` y publicar una nueva versión**. Vercel usa el mismo `APPS_SCRIPT_URL`.
- Si el backend está vacío y el navegador tiene datos históricos, se ofrece copia local e importación explícita. No se importan datos ficticios automáticamente.
- En producción los estados se conservan en Apps Script; en demo siguen siendo locales.

## Verificación

- 84 pruebas Node ejecutadas y aprobadas.
- Sintaxis de 26 archivos JavaScript/JSX y Apps Script revisada sin errores.
- Compilación Vite pendiente: npm no consiguió descargar dependencias desde este entorno.
- No se verificó el guardado en una hoja real ni se publicó una implementación de Apps Script o Vercel desde este entorno.

## Prueba manual requerida después de desplegar

1. Crear/modificar un equipo, esperar «Guardado», recargar y comprobar que se conserva.
2. Desde Gantt por proyecto, crear sector + tarea + incidencia, esperar «Guardado», recargar y verificar todas sus propiedades.
3. Abrir la app con otro usuario, comprobar lectura.
4. Simular dos ediciones de la misma planificación: se debe rechazar la que parte de versión antigua y permitir exportar borrador.
5. Comprobar que la pestaña `proyecto` no cambió al editar el Gantt.
6. Revisar primero en un proyecto de prueba, sin presentar datos ficticios a Gerencia.
