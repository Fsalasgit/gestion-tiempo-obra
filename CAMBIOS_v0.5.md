# ObraTiempo v0.5 · Detalle de la UX de colocación

## Incluido

- Gantt con bloques individuales, arrastre de tareas futuras en PC e inspector de edición en PC/teléfono.
- Selección de día y ocupación detallada por equipo debajo del Gantt.
- Backlog, reprogramación por lluvia, trabajos adicionales y división de tareas ejecutadas parcialmente.
- Historia planificada anterior al día actual bloqueada; nunca se infiere ejecución a partir de programación.
- Registro voluntario del personal que completó cada bloque (snapshot de nombres).
- Equipos renombrables, edición y baja histórica de miembros, bolsa de auxiliares de Producción con convocatorias por día.
- Exclusión de colocación de obras con `Grupo = Retiro en Abalum`.
- Contraseña editable desde Usuarios con mínimo 1 carácter en React y backend Apps Script.
- Conserva conexión Vercel /api y tokens de sesión.

## Aún pendiente

- Persistencia compartida y auditoría de bloques en Apps Script.
- Programación de tiempos de traslados y mapas automáticos.
- Confirmación por hora de ejecución / tareas históricas que no fueron registradas a tiempo.
- Reglas reales de concurrencia y permisos sobre ediciones de la planificación.
- Validación de compilación de Vite y pruebas de navegador (npm registry no accesible en el entorno de armado).

## Importante antes de publicar

1. Actualizar `backend/apps-script/Code.gs`, ejecutar `setup()` y reimplementar **nueva versión**.
2. Volver a importar el Excel: ahora conserva columna `Grupo`.
3. Comprobar `npm install`, `npm test` y `npm run build` en equipo local.
4. Las claves de 1 carácter fueron habilitadas expresamente por pedido, pero **son débiles para Internet**.
5. El Gantt sigue siendo UX local: usuarios de diferentes computadoras no verán el mismo plan.
