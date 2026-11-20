# ObraTiempo v0.7 · ABALUM

## Cambios de UX

- Estimación de obra: al guardar, modo consulta con **Editar obra**; al activarlo, **Guardar cambios** / **Cancelar edición**. El modo no cambia ante error del servidor.
- Renombramos los bloques de interfaz como **TP (Tarea Planificada)** en Gantt, métricas y documentación.
- Nueva sección **Horas teóricas pendientes** en el modal de una TP programada.
- Botón **Desprender TP pendiente**, con horas editables y motivo obligatorio: falta de personal, condiciones de obra, lluvia/clima, materiales, cliente u otros.
- TP original: conserva fecha, equipo, operarios y su estado planificado, y reduce las horas-persona. TP derivada: entra al backlog con `origin:'pendiente'`, sin fecha ni operarios, ligada con `parentId`.
- Historial `splitHistory` (en la original), sin aumentar el contador de reprogramaciones.
- Indicadores separados de TP totales, derivadas, adicionales, reprogramaciones, backlog y cobertura.

## Ejemplo

TP de 12 h-persona, cobertura 4 h: se desprenden 8 h → original de 4 h para el mismo día/equipo, nueva TP pendiente de 8 h en backlog. Total teórico = 12 h. No se marca ninguna hora como realmente realizada.

## Cómo probar

1. Abrí `npm run dev`, entrá a Tiempos de obra y guardá una obra. El botón debe pasar a «Editar obra»; al tocarlo aparecen campos editables y «Guardar cambios».
2. Entrá al Gantt y abrí una TP del día actual o futuro con cobertura incompleta. Elegí «Desprender TP pendiente».
3. Probá el caso 12→4+8, motivo falta de personal. La TP original debe permanecer en su fecha y la nueva aparecer en backlog, sin aumentar la carga de otra fecha.
4. Programá la TP pendiente desde backlog. Debe exigirse motivo al asignarle una fecha y quedar registrado como reprogramación.
5. Verificá que las TP pasadas o realizadas sean de solo lectura y que «Otros» exija una descripción.
6. Ejecutá `npm test` y `npm run build`.

**Sin cambios de Apps Script.** La planificación continúa en localStorage, no es multiusuario ni auditable hasta implementar persistencia del Gantt. `proyecto` y `tiempo_obra` no cambian de esquema.
