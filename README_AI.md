# Instrucciones principales para futuras iteraciones — ObraTiempo v1.1

**Estas reglas v1.1 prevalecen sobre las notas históricas v0.3–v1.0 que aparecen más abajo.** No retroceder a guardado exclusivo en `localStorage`.

1. `proyecto` **solo lectura**: se reemplaza únicamente con importación de Excel; la aplicación nunca edita filas de esta pestaña. `tiempo_obra` se mantiene independiente por `projectId`.
2. Mantener **dos workspaces en Apps Script**: `capacity` (equipos, colores RGBA, colaboradores, ausencias, auxiliares, sábados, asignaciones y TP) y `projectGantt` (sectores, tareas, bloqueantes, incidencias, estados, avance). No duplicar horas del Gantt por proyecto en capacidad de Gerencia.
3. Los estados de ambos módulos **viven en `App.jsx`**, mediante `src/lib/useBackendWorkspace.js`, para no perder guardados en segundo plano al cambiar de pantalla. `src/components/WorkspaceStatus.jsx` debe reflejar pendiente/guardando/guardado/error/conflicto. No bloquear toda la app mientras sincroniza.
4. Apps Script implementa `workspace.load`, `workspace.save(expectedRevision)` con `LockService` y versiones independientes; un conflicto `STALE_REVISION` **no debe hacer last-write-wins**. Guardar datos en `workspace_meta`/`workspace_chunks` con Base64URL y checksum; no modificar `proyecto` ni cambiar nombre de esas columnas sin migración explícita.
5. La primera carga remota **nunca debe subir datos locales automáticamente**. Si revisión remota 0 y hay datos legados, ofrecer respaldo local e importación explícita; no mezclar datos ficticios con proyectos reales. En demo conservar las claves históricas de localStorage.
6. No convertir la **selección de mes, la pestaña activa, filtros, proyecto seleccionado ni la vista cliente** en propiedades compartidas del backend: son preferencias locales.
7. Gantt por proyecto ofrece `Obra completa`, **desde primera jornada/incidencia hasta última tarea**, sin usar fechas del catálogo ni extenderlo hasta hoy; solo en la pantalla de proyecto. Conservar otros filtros y vista de sectores desplegables, tareas generales e incidencias grises.
8. Mantener jornadas puras (6 h lun-jue, 5 h viernes), feriados, recesos, sábados por equipo y fecha; no modificar el calendario estándar al habilitar uno. El pasado no se reescribe ni se marca realizado automáticamente.
9. Antes de publicar: `npm test`, `npm run build`, inspección de error states, pruebas manuales en Vercel + Apps Script real y chequeo de no haber incluido proyectos/credenciales reales en el bundle. No afirmar que se hizo un despliegue real sin probarlo.
10. Mantener instrucciones de despliegue de `README_VERCEL.md`; backend v1.1 **sí exige actualización**. La vista cliente no crea accesos públicos hasta tener autorización por proyecto.

---

# README_AI · ObraTiempo v0.8 (tema ABALUM)

Leé este archivo antes de modificar el código. Objetivo **actual**: evaluar UX y modelo de capacidad mensual antes de persistir equipos y Gantt. Base React + Vite en JavaScript, backend Google Apps Script con Google Sheets, autenticación simple usuario/contraseña y token (no Google Login). No introducir complejidad innecesaria en el acceso.

## Modelo de datos y autoridad

1. `proyecto` es una **copia reemplazable del Excel de origen**, solo lectura en UI. No guardar dirección, tiempos ni anotaciones en este catálogo; se actualiza únicamente mediante upload/refresh. Nueva exportación 19/11/26 contiene 28 columnas (Numero, Estado, Nombre, Cliente, Inicio P., Inicio, Fin P., Producido, Entrega, Lider Proyecto, Localidad Proyecto). Anterior exportación tenía 48 columnas y filas por artículo, con `Project ID`, `Proyecto` y `PR - Estado`. Ambos se normalizan en `src/lib/excelImport.js` y `importSheet_` de Apps Script. Excluir solo estados globales cerrados, no inferir el cierre por `Producido` o `Entrega`. Ignorar pie de totales sin Numero+Nombre. **La actualización jamás borra o edita `tiempo_obra`.**
2. `tiempo_obra`: un registro por `projectId`, `value`, `unit`, `crewReference` 2, `outsourced` boolean, `notes`, `address`. Día de referencia = 6 horas persona. Dejar carga y edición fuera de la hoja de origen.
3. `equipos`, `colaboradores`, `ausencias`, `planificacion`: en v0.3 son estructuras de escenario `localStorage`, NO tablas/operaciones activas del servidor. No dar la impresión de que están persistidas online. Próxima etapa: modelar pestañas de Google Sheets, endpoints y migración aditiva, después de validar interfaz.
4. La demo incluye **6 obras ficticias y anónimas**. Los nombres e IDs privados del Excel del usuario no se incluyen en el repositorio ni en el bundle de Vercel. Los proyectos reales se consultan autenticados por Apps Script (modo producción). Un usuario puede cargar un Excel solo en su navegador al probar la UX. No volver a incorporar `src/data/projects-2026-11-19.json` u otros datos sensibles al frontend.

## Fórmulas que NO deben cambiar inadvertidamente

- `getPersonHours(value,unit,2)`: horas-persona, días×6×2, horas×2.
- Semana estándar: lunes a jueves 6 h por persona, viernes 5 h, fin de semana 0, reducida por feriados y recesos.
- `src/lib/planner.js` es la fuente de verdad de cálculos. `scheduleAssignment` distribuye esfuerzo de cada asignación de forma **independiente**. No recorta el esfuerzo cuando hay otro proyecto simultáneo, porque el dashboard debe mostrar ocupación >100%. No usar `Math.min(100,ratio)` para mostrar porcentaje; sí puede truncarse la altura de la barra visual, mostrando ratio real en texto.
- Personal activo por equipo y fecha: alta <= día <= fin opcional, estado activo y no incluido en ausencias. Una baja resta capacidad, NO horas comprometidas. Colaboradores adicionales con alta y fin tienen capacidad solo dentro del período.
- Obra completamente tercerizada: conserva estimación y aparece marcada en plan, su carga interna = 0. Tercerización parcial aún no existe.
- Ocupación mensual: horas-persona de asignaciones que caen dentro del mes / horas-persona disponibles ese mes. Backlog de obras sin asignar NO se incorpora a la demanda de ese mes, y debe informarse explícitamente. Las obras no estimadas no tienen horas en la simulación.
- Días hasta el cierre del mes (calendario sin contar el día presente) y jornadas de capacidad restantes (incluyendo hoy si es hábil) se exhiben por separado.
- Horas de traslado **no** se descuentan todavía. Nunca inventar km: la función de Google Maps actual abre la ruta manual; para automatizar usar Routes API, orígenes/destinos geocodificados, datos de camion y avisos de costo/facturación.

## Distribución de responsabilidades

- `src/App.jsx`: navegación previa, Proyectos/Tiempos/Calendario/Usuarios/README, proxy API, login.
- `src/components/CapacityStudio.jsx`: tablero, Gantt, asignaciones, personal/ausencias, logística futura. Evitar hacer cálculos de fechas complejos aquí; usar `planner.js`.
- `src/lib/planner.js`: funciones puras testeables, usan fechas locales YYYY-MM-DD a mediodía para evitar desfases TZ.
- `src/lib/excelImport.js`: normalización de dos formatos; la lectura `.xls/.xlsx` es bajo demanda mediante paquete `xlsx`.
- `src/lib/domain.js`: lógica histórica (calendario laboral, estimación de esfuerzo, exclusión de estados finales).
- `backend/apps-script/Code.gs`: roles verificados en servidor, sesiones token. Una modificación de campos en `proyecto` o `tiempo_obra` exige migración aditiva y ejecución de `setup()` (nunca sobreescribir encabezados sin validar).

## Pruebas y trabajo siguiente

- `npm test` (19 pruebas en v0.3), `npm run build`, probar con Excel `.xls` del usuario, cambios de equipos, ausencias, Gantt entre meses y tercerización. Ejecutar `setup()` y probar endpoints solo después de acordar persistencia de las nuevas tablas.
- Separar el equipo nominal y la cuadrilla planificada; la duración por cantidad de personas se supone proporcional SOLO como escenario inicial, no considerar productividad garantizada.
- Mejorar posteriormente disponibilidad real por tramos horarios, ausencias parciales, supervisión, horas extra, tareas paralelas por fases, reasignaciones de una obra a varios equipos, traslados A→B→base y compromisos de entrega. No prometer fechas de entrega antes de modelar esas restricciones.
- Mantener diseño profesional, adaptable y comprensible para Gerencia. Nombres simples, indicadores con unidades y alertas si falta información.

## Identidad visual ABALUM (v0.4)

- Base cromática: rojo `#C9233B`, grafito `#1C1E22`, blanco `#FFFFFF`, gris de superficie `#F7F7F8`. Son valores de interfaz aproximados, no códigos oficiales de un manual de marca.
- Variables CSS en `src/styles.css` (`--abalum-*`). Vista del Gantt en `src/capacity.css` (`--cap-*`). Ambos archivos contienen overrides finales del tema: mantener la cascada consistente y no reintroducir azules en botones, navegación o formularios.
- Verde = capacidad normal, ámbar = advertencia, rojo tramado = sobrecarga, violeta = trabajo tercerizado. El rojo ABALUM también se utiliza para botones primarios y obras del Gantt; el estado se distingue por tramas y texto.
- Nombre visible: **ABALUM · ObraTiempo**, sin suplantar el logotipo corporativo real. El favicon y la marca pueden sustituirse si se facilita un archivo de logo oficial.
- Implementación en Vercel: ver `README_VERCEL.md`. `APPS_SCRIPT_URL` solo servidor; `VITE_DEMO_MODE=false` al desplegar.

## REGLAS DE NEGOCIO v0.5 · NO ROMPER

1. La pestaña `proyecto` solo es copia importada y se usa para vincular ID y verificar `Estado` y `Grupo`. Nunca editarla desde la planificación ni borrar tiempos de `tiempo_obra` en una actualización de Excel.
2. `Grupo = Retiro en Abalum` (insensible a mayúsculas y acentos) significa **sin colocación**. No incluir estas obras en asignaciones ni ocupación.
3. Cada **TP** es una entidad `blocks[]` separada de `assignments[]`. `personHours` refleja horas-persona, no horas de reloj. Una tarea puede ser extra, parcial, backlog, realizada o pasada no confirmada.
4. Una tarea planificada en el pasado **no equivale a ejecución realizada**. Ni cambiar fechas pasadas ni alterar bloques completados; mostrar quiénes trabajaron solo cuando hayan sido confirmados explícitamente, usando `workerNames` como snapshot.
5. Los TP del backlog no consumen capacidad de una fecha, pero deben quedar como trabajo pendiente visible.
6. Los auxiliares viven en `members` con `kind='auxiliar'` y se suman al equipo solo por `supportShifts` (fecha y equipo). No añadirlos a los equipos fijos de manera permanente por defecto.
7. Cambio o salida de colaborador afecta días futuros; respetar `teamHistory` y `end` histórico, jamás reescribir automáticamente quién trabajó en el pasado.
8. No limitar la carga al 100%; porcentaje >100% debe ser visible en informes y ocupación diaria.
9. La UX de planificación se guarda **solo en el navegador**. No prometer sincronización, historial irrefutable ni auditoría real. Backend persiste usuarios, estimaciones, calendario y catálogo importado.
10. `src/components/GanttTasks.jsx`, `PeopleManager.jsx`, `src/lib/workBlocks.js`, `src/lib/planner.js` son la base del módulo v0.5. Revisar `tests/tasks.test.js` y el resto de pruebas antes de cambiar algoritmos.
11. Autenticación por usuario, contraseña y token Apps Script: sin Google Login. Longitud mínima de contraseña en prototipo: 1 carácter en ambas capas, **con riesgo reconocido** para publicación real. No eliminar hashing, tokens ni permisos.
12. Mantener paleta ABALUM rojo/grafito/blanco, responsive y accesibilidad por teclado (edición de TP desde inspector, además de drag/drop).


## Reglas nuevas v0.6: no regresionar

1. `src/lib/taskPlanning.js` es la **única fuente de verdad** para cobertura de personas, colores RGBA, reprogramación con motivo e indicadores de TP. Mantener funciones puras; agregar tests unitarios al cambiar cálculos.
2. El token y el perfil mínimo permiten mostrar el último estado confirmado sin esperar `bootstrap`; las lecturas de Apps Script corren en segundo plano, se serializan con escrituras, y **ninguna respuesta vieja puede pisar cambios posteriores**. Revisar `src/lib/syncCache.js` + `src/App.jsx`. No afirmar que el catálogo está actualizado si la lectura falló.
3. Cada TP mantiene `personHours`, `workers` (IDs), `workerHours` (máximo de horas reservables por operario), `reprogramHistory`, `date` y `teamId`. La TP no puede estar en dos fechas; las horas de una persona no se duplican entre TP del mismo día. No mezclar porcentaje de **cobertura de la TP** (0–100%) con **ocupación del equipo** (>100% permitido).
4. Cambios de fecha o equipo deben pasar por `rescheduleBlock` con motivo obligatorio; el drag/drop **solo abre el modal con propuesta**, no persiste automáticamente. Cambios de personal y de horas sin cambio de fecha/equipo no cuentan como reprogramación.
5. Tareas pasadas/completadas son solo lectura en UX. Si la tarea pasó sin confirmación, sigue siendo planificación y no ejecución. Para auditarlo de forma real posteriormente requerimos acciones autenticadas y tiempo del servidor.
6. `Equipo.color` se almacena como `rgba(r,g,b,a)` editable por modal; no sobrescribir los colores personalizados al actualizar el frontend. Las tareas deben usar color del **equipo del propio TP**, que puede diferir del equipo inicial de la obra.
7. Al crear plan nuevo, asignar personas disponibles **por fecha** a la TP, sin incluir bajas, e incorporar auxiliares solamente con `supportShifts`. Los cambios de fecha deben recalcular operarios predeterminados; no suponer que un auxiliar trabaja toda la semana.
8. La planificación sigue en `localStorage` clave `obras-capacidad-ux-v6` con migración automática de `v5`. `proyecto` no se edita. No agregar endpoints de Gantt ni prometer sincronización de motivos hasta acordar persistencia.
9. El cálculo de cobertura para cada persona considera el límite diario definido en `calendario_laboral`, feriados/recesos y reservas previas. Es una simulación a nivel de **día**, no de franjas horarias; agregar horarios superpuestos en una etapa posterior.
10. Validar `npm test`, `npm run build`, interacción de modal en escritorio y teléfono, y el escenario de migración v0.5→v0.6. Si npm no está disponible, indicarlo expresamente en la entrega.


## Reglas nuevas v0.7: TPs derivadas y edición de tiempos

1. En la **interfaz** usar **TP (Tarea Planificada)** en lugar de «cubito». Mantener `blocks[]` y las claves históricas internas (`cubitos` en `reprogramStats`) para no perder escenarios guardados.
2. En **Tiempos de obra**, una estimación existente se abre en modo solo lectura con botón **Editar obra**; al activarlo se edita y aparece **Guardar cambios**; se puede cancelar. Para una obra sin estimación se mantiene **Guardar tiempo de obra**. Tras éxito confirmado por `estimate.save` pasa a modo consulta. No dar por guardado un envío que falló.
3. `derivePendingTask` en `src/lib/workBlocks.js` divide una **TP planificada** en dos esfuerzos teóricos: **original reducido** y **TP pendiente derivada**. Debe conservarse la suma de `personHours`. La original conserva `id`, `date`, `teamId`, `workers`, `workerHours` y `status='planificado'`. La hija conserva `projectId` y `assignmentId` pero nace en `backlog`, sin personal, con `origin='pendiente'`, `parentId`, motivo y nota. Queda un evento en `splitHistory` de la original.
4. La división por cobertura insuficiente **no demuestra horas ejecutadas** ni marca ninguna TP como realizada. No se debe utilizar `completedAt`, `workerNames` ni `status='realizado'`. La ejecución parcial confirmada sigue siendo una operación diferente (`splitPartial`), solo el día vigente.
5. El motivo de una derivación es obligatorio: `Falta de personal`, `Condiciones de obra`, `Lluvia / clima`, `Falta de materiales`, `Cambio solicitado por el cliente`, `Otros` (con descripción obligatoria). No contabilizarlo como reprogramación: solo cambios posteriores de fecha/equipo generan un evento en `reprogramHistory`.
6. Una **TP adicional** usa `origin='extra'`: actividad nueva, no horas que estaban en una TP y quedaron pendientes. No mezclar ambas en la tabla de indicadores.
7. Al desprender horas de una TP, la carga del día disminuye en el esfuerzo derivado; el backlog no consume capacidad hasta reprogramarse. El Gantt y las métricas mensuales usan el mismo `store.blocks` que ya persistía en `localStorage` (`obras-capacidad-ux-v6`); no es necesario actualizar Apps Script para esta UX.
8. Ver `tests/pendingTasks.test.js` para invariante de suma, caso 12→4+8, backlog, motivos, pasado inmutable y métricas. Ejecutar `npm test` y `npm run build` cuando haya acceso a dependencias.

## Reglas v0.8: capacidad mensual automática + Gantt de seguimiento

1. **Prioridad de producto**: explicar a Gerencia la carga mensual por equipo. Distinguir capacidad disponible, carga programada y horas/persona reales. El calendario base sigue siendo `src/lib/domain.js` y `src/lib/planner.js`.
2. `src/lib/linearCapacity.js` añade `scheduleLinear()` y `replanFutureLinear()`: **una obra por equipo y día**, sin solapamientos para asignaciones nuevas. Respetar disponibilidad real diaria (incluidos auxiliares por fecha) y saltar fines de semana, feriados y recesos. No cortar la obra al cambiar de mes. En ningún caso convertir horas programadas en horas realizadas.
3. El algoritmo anterior `scheduleAssignment()` sigue disponible para escenarios manuales con ocupación >100% y sus tests previos. **No sustituirlo** por la asignación lineal a nivel global: ambas modalidades tienen reglas distintas. La vista `buildMonthPlan()` debe conservar indicadores de sobrecarga histórica/manual.
4. Los registros automáticos llevan `assignment.mode='automatic'` y `block.origin='lineal'`. Si el usuario edita una TP automática a mano, convertirla a `origin='manual'` para que `replanFutureLinear()` no pise esa decisión. El recálculo protege TP pasadas y confirmadas y resta el esfuerzo de las TP manuales vinculadas.
5. `src/components/MonthlyAutoPlanner.jsx` es la pantalla UX para asignaciones lineales y ocupación mensual. `src/components/CapacityStudio.jsx` conserva la vista de Gerencia, gestión de equipos y las TP manuales. Ambas usan el mismo `store` con la clave histórica `obras-capacidad-ux-v6` para no perder datos locales anteriores.
6. `src/components/ProjectGantt.jsx` y `src/lib/projectTimeline.js` implementan el **Gantt de seguimiento por proyecto**, con componentes, tareas, equipo, fechas y progreso ponderado por horas. Sus registros viven **independientes** en `obras-gantt-proyectos-ux-v1`. No incorporar sus horas al cálculo de ocupación mensual: duplicaría el esfuerzo de las TP de colocación.
7. `Vista cliente` del Gantt de seguimiento es solo **previsualización autenticada y de lectura**. No construir enlace público sin permisos de acceso por proyecto, persistencia del backend e identificación del cliente. La evolución desde el inicio se muestra en la cronología completa; mes a mes en la grilla.
8. Las fechas de tareas históricas de seguimiento no se mueven; sí se puede **actualizar el avance declarado**. Los estados y el porcentaje no deben implicar ejecución automática solo por transcurrir los días.
9. Mantener `proyecto` como relación **solo lectura** con el Excel, `tiempo_obra` separado; excluir Retiro en ABALUM y tercerizadas de la capacidad de colocación.
10. Tests críticos: `tests/linearCapacity.test.js`, `tests/projectTimeline.test.js` y suite previa. Documentar errores reales de `npm run build`, no inventar verificación visual.


## v0.9 · Reglas nuevas que debés conservar

- `src/lib/ganttRange.js`: `ganttDates()` es el único constructor de ventanas de fecha. `periodCapacity()` agrega los meses involucrados con `buildMonthPlan()` y devuelve capacidad/carga solamente de esas fechas. No mostrar métricas mensuales sobre una selección de 15/30 días. El botón «Ver desde hoy» va de hoy a fin de mes; «Ver desde inicio» abarca el historial completo del contexto.
- `src/components/RangeButtons.jsx`: opciones compartidas y accesibles para Gantt TP, ocupación/gerencia y Gantt proyecto. Nunca duplicar la lógica de filtros en cada componente.
- `src/components/ProjectGantt.jsx`: **prohibido reintroducir filas de encabezado por componente en la grilla**. La tarea debe ocupar una sola fila y contener nombre, componente opcional, equipo y avance. `projectTimeline.validateTaskDates` ya no exige componente.
- `src/components/SaturdayEditor.jsx`: horario excepcional por `teamId` + `date`, vigente solo ese sábado y conservado en `localStorage`. No modificar la semana estándar al habilitarlo. Entre 0,5 y 12 h de trabajo puro. Feriados y recesos tienen prioridad; fecha pasada no editable; cierre de sábado prohibido si quedan TP asignadas a ese equipo y fecha.
- `domain.countDailyHours(date,week,holidays,recesses,projectId,specialDays,teamId)` y las funciones de `planner`, `taskPlanning`, `linearCapacity`, `projectTimeline` comparten la excepción. Es fundamental pasar `teamId`; nunca dar la capacidad de sábado habilitado de un equipo a otro.
- `proyecto` sigue solo lectura, Gantt cliente sigue privado/solo lectura; `specialDays`, TP, colaboradores y eventos de proyecto siguen UX local, no sincronizados. Para Apps Script se requerirá una migración futura explícita.
- Los tests `tests/ganttRangeSaturday.test.js` verifican cruce de meses, excepciones de sábados, feriados, cobertura y planificación lineal.

## Gantt por proyecto v1.0 (jerarquía, jornadas e incidencias)

- **Módulo puro** `src/lib/projectSchedule.js`: `buildProjectSchedule`, `taskDuration` (compatibilidad con v0.9), `validateDependency`, `addTaskIncident`, `summarizeProjectSchedule`, `groupBySector`, `sectorSpan`.
- **UI** `src/components/ProjectGantt.jsx` y `projectGantt.css` muestra Proyecto → Sector → Tareas, más Tareas generales. No borrar el historial local de la v0.9 (`obras-gantt-proyectos-ux-v1`).
- Una tarea usa `durationDays` como cantidad entera de jornadas, `start` como fecha mínima, `teamId`, `sectorId` opcional, `dependsOn` opcional, `personHours`, `progress`, `status`, `incidents` (objetos con `{date,reason,note,createdAt}`). **Las incidencias no reducen `durationDays`**; se conserva la fecha gris y las jornadas se corren.
- Los sábados se habilitan por equipo y fecha en `specialDays` del escenario de capacidad. Domingos y feriados siguen cerrados; no dupliques horas del Gantt por proyecto en la ocupación de Gerencia.
- El bloqueante se resuelve sobre el **fin proyectado** de la tarea predecesora; prevenir ciclos y reflejar que avance previsto ≠ ejecución confirmada.
- `proyecto` solo fuente de referencia. Sin persistencia compartida hasta una evolución posterior.
- Pruebas específicas: `tests/projectSchedule.test.js`.

## Regla v1.0.2: fecha de inicio en el Gantt por proyecto

`Ver desde inicio` debe partir de `firstProjectActivityDate(buildProjectSchedule(...))`: la primera jornada de una tarea o incidencia histórica; nunca de los campos de fecha de la hoja de proyectos. Sin tareas, no inventar fecha de inicio. Aplica también a la fecha mostrada como «Inicio de obra completa».


## v1.2 — búsqueda y logística (reglas estables)
- Gantt por proyecto: búsqueda con `src/lib/projectSearch.js`, `normalizeProjectText` y `searchProjects` (número, nombre, cliente; tolerar acentos). No volver a cambiarlo por `<select>` con cientos de proyectos.
- `src/components/Logistics.jsx`: cálculo de ida desde Avenida Siria 1633 hasta dirección previamente almacenada en `tiempo_obra`; no inventar distancias geodésicas.
- `backend/apps-script/Code.gs` acción autenticada `logistics.route`, recibe **solo** `projectId`: buscar dirección de la estimación; usar Maps DirectionFinder conducción y caché de 6 horas, máximo 20 nuevas consultas por usuario/hora. Ningún usuario puede pasar direcciones arbitrarias a Maps mediante esa acción.
- `src/lib/routeEstimate.js`: velocidad del camión 30 km/h cargado / 50 km/h viaje largo / personalizada; estimación teórica de llegada con tiempo adicional. No llamar rutas de nuevo al editar salida o velocidad. La ruta de Maps no es específica de camiones ni contempla restricciones de tamaño/peso ni congestión actual.
- No agregar duración logística a ocupación ni al Gantt de proyecto hasta definir una etapa posterior. No editar la hoja `proyecto` desde logística.
- Mantener sesión con username/contraseña y token actual; no introducir OAuth para los usuarios.
- Límite funcional: ida; no calcular regreso ni múltiples paradas por ahora. No generar una API key pública en el bundle.
