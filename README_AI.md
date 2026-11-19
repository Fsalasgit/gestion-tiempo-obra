# README_AI · ObraTiempo v0.4 (tema ABALUM)

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
3. Cada **cubito** es una entidad `blocks[]` separada de `assignments[]`. `personHours` refleja horas-persona, no horas de reloj. Una tarea puede ser extra, parcial, backlog, realizada o pasada no confirmada.
4. Una tarea planificada en el pasado **no equivale a ejecución realizada**. Ni cambiar fechas pasadas ni alterar bloques completados; mostrar quiénes trabajaron solo cuando hayan sido confirmados explícitamente, usando `workerNames` como snapshot.
5. Los cubitos del backlog no consumen capacidad de una fecha, pero deben quedar como trabajo pendiente visible.
6. Los auxiliares viven en `members` con `kind='auxiliar'` y se suman al equipo solo por `supportShifts` (fecha y equipo). No añadirlos a los equipos fijos de manera permanente por defecto.
7. Cambio o salida de colaborador afecta días futuros; respetar `teamHistory` y `end` histórico, jamás reescribir automáticamente quién trabajó en el pasado.
8. No limitar la carga al 100%; porcentaje >100% debe ser visible en informes y ocupación diaria.
9. La UX de planificación se guarda **solo en el navegador**. No prometer sincronización, historial irrefutable ni auditoría real. Backend persiste usuarios, estimaciones, calendario y catálogo importado.
10. `src/components/GanttTasks.jsx`, `PeopleManager.jsx`, `src/lib/workBlocks.js`, `src/lib/planner.js` son la base del módulo v0.5. Revisar `tests/tasks.test.js` y el resto de pruebas antes de cambiar algoritmos.
11. Autenticación por usuario, contraseña y token Apps Script: sin Google Login. Longitud mínima de contraseña en prototipo: 1 carácter en ambas capas, **con riesgo reconocido** para publicación real. No eliminar hashing, tokens ni permisos.
12. Mantener paleta ABALUM rojo/grafito/blanco, responsive y accesibilidad por teclado (edición de cubitos desde inspector, además de drag/drop).
