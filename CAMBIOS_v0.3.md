# Qué cambió de v0.2 a v0.3

- Nuevo módulo inicial: **Capacidad y Gantt** (Resumen, Gantt mensual, Asignaciones, Equipos y bajas, Logística futura).
- Importación desde el navegador para `.xls` y `.xlsx`, compatible con los dos formatos de Excel recibidos y sin editar el sistema de origen.
- Base de prueba del Excel 19/11/2026: 102 proyectos no cerrados. La carga de horas y de equipos de prueba no proviene del Excel.
- Mostrar ocupación superior a 100%, excedentes, carga por equipo, días faltantes para finalizar el mes y proyección de 6 meses.
- Colaboradores fijos y adicionales, altas/bajas temporales, simulación de tercerización, edición de asignaciones y fechas.
- Dirección de obra en tiempo de colocación, no en la importación de proyectos.
- Logística reservada para etapa posterior: base Avenida Siria 1633; ruta manual vía Google Maps. Sin kilómetros inventados, costos de Maps o descuentos de traslado todavía.
- Backend Apps Script adapta el mapeo a encabezados nuevos (`Estado`,`Nombre`,`Numero`); se agrega campo `localidad` a `proyecto` y `address` a `tiempo_obra` con migración aditiva en `setup()`. No se cambió autenticación previa (usuario/contraseña y token).
- **Persistencia de equipos, bajas y Gantt:** localStorage del navegador solamente. Todavía NO existen pestañas de backend nuevas para estas entidades.
- `README.md` y `README_AI.md` actualizados.
- 19 pruebas automáticas aprobadas (Node) y revisión de sintaxis JSX sin errores; no se pudo completar `npm install` ni el build en el entorno de entrega.

## Primeras cosas para probar

1. `Copy-Item .env.example .env`; verificar `VITE_DEMO_MODE=true`.
2. `npm install` y `npm run dev`.
3. Ir a **Capacidad y Gantt**; ver el ejemplo con sobreocupación.
4. Abrir **Equipos y bajas**; registrar una baja y comparar porcentaje.
5. Abrir **Asignaciones**; marcar una obra como tercerizada y comparar carga.
6. Cambiar de noviembre a diciembre en el **Gantt**.
7. Abrir **Proyectos**, subir el Excel nuevo y comprobar que solo actualiza los datos de origen.
8. Ir a **Tiempos de obra** para agregar una dirección, una estimación de 2 personas o modificarla.

No utilizar el informe ficticio como dato real de Gerencia hasta completar estimaciones y asignaciones.
