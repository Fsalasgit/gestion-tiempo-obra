# ObraTiempo v1.0 — jerarquía del Gantt por proyecto

## Objetivo

Esta entrega profundiza **solo el Gantt por proyecto**, sin cambiar la asignación lineal ni el cálculo de ocupación mensual para Gerencia.

## Jerarquía

- **Proyecto/obra completa**: fila superior, con inicio de referencia (archivo `proyecto`) y fin previsto de la última tarea programada.
- **Sectores**: alta y renombre, con desplegable para mostrar/ocultar tareas. Su inicio y fin se calculan desde las jornadas de las tareas del sector.
- **Tareas**: se pueden colocar dentro de un sector o en **Tareas generales**, para trabajos como ruteo de Aluco.
- Las etapas personalizadas de la versión 0.9 se migran a sectores cuando sea posible, sin perder las tareas almacenadas. La clave local se mantiene.

## Jornadas

Cada tarea tiene una fecha mínima, **jornadas teóricas (días enteros)**, horas-persona de referencia, equipo, estado y avance. Genera exactamente un cuadrado por jornada habilitada.

- De lunes a jueves: jornada definida en el calendario (habitualmente 6 h).
- Viernes: jornada definida en el calendario (habitualmente 5 h).
- Sábados: no generan cuadrado salvo habilitación excepcional por **equipo y fecha** mediante «＋» y el modal de horas.
- Domingos: no generan cuadrados, aun si hay una excepción mal configurada.
- Feriados/recesos: no generan cuadrados y prevalecen sobre sábados extra.
- La habilitación de sábado adelanta los días finales de la tarea y las fechas de cualquier tarea dependiente si correspondiere.

## Tareas bloqueantes

Elegí en cada tarea **Tarea bloqueante**. La fecha mínima efectiva pasa a ser el máximo entre el inicio solicitado y el día siguiente a la finalización prevista de la tarea bloqueante. Evitamos referencias inexistentes y ciclos. Si la anterior aún no figura finalizada, el Gantt indica dependencia pendiente de confirmar, aunque muestra su proyección.

## Incidencias y desplazamientos

Pulsar el botón «⋯» dentro de una jornada de tarea abre el modal de incidente. Motivos: clima, personal, condiciones de obra, materiales, equipos u otros. La fecha queda **gris**, se registra el motivo y se recalculan las jornadas pendientes **sin reducir su cantidad**; las tareas con bloqueantes se desplazan en cascada. Esto no marca la tarea como ejecutada ni añade una tarea a la ocupación mensual.

No se permiten cambios de fechas pasadas desde este modal. La vista cliente es solo lectura.

## Persistencia y despliegue

Los proyectos del Excel siguen siendo **referencia de lectura**. Los sectores, tareas e incidencias siguen guardándose únicamente en `localStorage` bajo la misma clave `obras-gantt-proyectos-ux-v1`. No se requieren cambios en Apps Script para esta fase UX. **No existe todavía URL pública del cliente ni persistencia compartida**.

Actualizar repositorio y Vercel: `npm install`, `npm test`, `npm run build`, `git add .`, `git commit`, `git push`.
