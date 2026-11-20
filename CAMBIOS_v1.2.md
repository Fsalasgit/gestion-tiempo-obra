# ObraTiempo v1.2 · Gantt con buscador y logística de ida

- Selector grande en Gantt por proyecto → **buscador** por número, nombre y cliente, tolerante a acentos, con teclado y hasta 12 resultados.
- Logística: consulta real de kilómetros por carretera desde Avenida Siria 1633 hasta la dirección guardada en `tiempo_obra`, por **Apps Script Maps DirectionFinder**.
- Camión: velocidades de referencia 30 km/h (cargado), 50 km/h (ruta) y editable; fecha/hora de salida, minutos de demora y hora de llegada calculada.
- Se muestra aparte la duración de conducción de automóvil devuelta por Maps, para no confundirla con la estimación de camión.
- Respuesta cacheada 6 h y máximo 20 consultas nuevas por usuario/hora.
- Frontend no bloquea navegación durante consulta; cambios de obra descartan una respuesta de ruta antigua.
- La acción nueva requiere publicar `Code.gs` v1.2. No modifica la base `proyecto`, `tiempo_obra` ni los dos workspaces. Ninguna API key se expone en React.
- Límite: la ruta no es específica para camiones, no incluye restricciones físicas ni tránsito en vivo; solo ida y sin descontar capacidad.
- 92 tests aprobados. Compilación Vite no verificada en entorno por error DNS EAI_AGAIN al acceder a npm.
