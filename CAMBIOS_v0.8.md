# ObraTiempo v0.8 · Enfoque en Gerencia y avance por proyecto

## Módulo 1 — Planificación mensual lineal

- Nuevo panel «Asignación lineal» para elegir proyecto, equipo, mes y operarios máximos.
- Vista previa de horas-persona, fecha de inicio disponible, fin y jornadas.
- Reserva una sola obra por equipo en cada día laborable. Respeta dotación activa, ausencias, auxiliares por jornada, feriados, recesos y semanas de 6/5 h por persona.
- Si una obra no cabe en el mes, prosigue en el siguiente sin perder horas. Ocupación visible por equipo y mes; convive con la sobrecarga de tareas manuales previas.
- «Recalcular futuro» reordena asignaciones automáticas y conserva lo histórico, lo ya realizado y las TP intervenidas manualmente.

## Módulo 2 — Gantt por proyecto (diferente del mensual)

- Nueva navegación «Gantt por proyecto», seleccionando obras desde el Excel de solo lectura.
- Componentes/etapas, tareas, nombre, horas-persona, responsable, fecha de inicio, fin propuesto o manual, estado, porcentaje y observaciones.
- Cronología global desde inicio del proyecto, Gantt diario mensual, ficha de avance y progreso ponderado por horas.
- Vista cliente de solo lectura dentro de la aplicación e impresión.
- No vuelve a sumar estas horas a capacidad mensual para evitar doble contabilización.

## Persistencia y seguridad

- Sin cambios en Apps Script/Code.gs. Se conservan la sesión con token y la sincronización de catálogo en segundo plano.
- Los nuevos escenarios son todavía **localStorage por navegador**, no datos compartidos en Apps Script ni historiales auditados.
- La «Vista cliente» NO es un portal externo ni produce un enlace público todavía.
- Los proyectos verdaderos no se incluyen en el ZIP; la demo sigue usando obras ficticias.
