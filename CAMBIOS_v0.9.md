# ObraTiempo v0.9 · ABALUM

## Correcciones de UX

1. El Gantt por proyecto ya no inserta filas separadoras de componentes al crear/renombrar tareas. El componente es **opcional** y se muestra como subtítulo de cada tarea; el gráfico es continuo, como el cronograma de obra de referencia.
2. Rangos compartidos en Gantt operativo, Gantt por proyecto, ocupación de Gerencia y asignación lineal: «Ver desde hoy», «Ver desde inicio», «Próximos 15 días», «Próximos 30 días», «Mes elegido».
3. La ocupación se recalcula sobre el rango elegido, incluyendo datos de otros meses. Mantiene porcentajes superiores al 100 %.
4. Tocá un sábado en el Gantt de colocación **o** en el Gantt por proyecto y elegí el equipo y las horas de trabajo puro (0,5–12). Solo se habilita ese sábado y equipo. Los feriados o recesos prevalecen. Para cerrar un sábado con TP, primero reprogramá las tareas.
5. La asignación lineal y la duración sugerida por proyecto reconocen los sábados habilitados y las personas disponibles.

## Datos y compatibilidad

- No modifica `proyecto` ni `tiempo_obra` ni `Code.gs` de Apps Script.
- No rompe el escenario de `localStorage` anterior `obras-capacidad-ux-v6`; añade `specialDays` sin borrar TP anteriores.
- Los cambios de planificación y sábados siguen siendo locales hasta desarrollar persistencia compartida.
- La vista cliente no permite configurar días laborables.

## Verificación

- `npm test`: 62 pruebas aprobadas en el escenario de referencia.
- Revisión sintáctica JS/JSX mediante TypeScript.
- Para Vercel: `npm install`, `npm test`, `npm run build`, `git add .`, `git commit`, `git push`.
- Compilación completa de Vite pendiente cuando haya dependencias npm en el entorno.
