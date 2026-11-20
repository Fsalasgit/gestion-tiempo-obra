# ABALUM · ObraTiempo v1.2 — Buscador de Gantt y logística de ida

React 19 + JavaScript + Vite, Vercel como frontend/proxy `/api`, Apps Script como backend de usuario/contraseña/token, Google Sheets como almacenamiento. Identidad visual ABALUM (rojo, grafito y blanco de referencia). `proyecto` solo se actualiza al **importar un Excel** y nunca se edita desde la planificación.

## Instalar y probar

```powershell
Copy-Item .env.example .env
npm install
npm test
npm run build
npm run dev
```

Abrí `http://localhost:5173`. Con `VITE_DEMO_MODE=true` se usan únicamente ejemplos ficticios guardados en el navegador. **No pruebes persistencia remota en demo.**

Para conectar realmente el frontend, en Vercel configurá:

```env
VITE_DEMO_MODE=false
APPS_SCRIPT_URL=https://script.google.com/macros/s/ID_DE_IMPLEMENTACION/exec
```

`APPS_SCRIPT_URL` es una variable **del servidor Vercel**; jamás se utiliza `VITE_APPS_SCRIPT_URL`. El proxy `api/index.js` reenvía las solicitudes a Apps Script. No existe Google Login ni `VITE_GOOGLE_CLIENT_ID`.

## Novedad: filtro «Obra completa»

En **Gantt por proyecto**, el botón **Obra completa** muestra todos los días calendario desde la primera actividad registrada (primera jornada o incidencia) hasta el fin de la última tarea. No usa `Inicio` ni `Inicio P.` del Excel y **no extiende el fin hasta la fecha actual**. Los días no laborables aparecen en la línea de tiempo sin generar tareas; las franjas resumen de obra/sector son continuas entre su inicio y su fin.

El filtro es exclusivo del Gantt por proyecto. Los controles anteriores (desde hoy, desde inicio, próximos 15/30 días y mes) siguen disponibles. Proyecto → Sectores → Tareas, más tareas generales sin sector. Una tarea tiene jornadas, equipo, bloqueante opcional, progreso declarado, fecha mínima, incidencias y observaciones. Lluvia registrada mantiene la jornada gris y desplaza las tareas futuras. La vista cliente **es solo lectura dentro de la aplicación, NO un enlace público**.

## Persistencia en Apps Script v1.1

**Es obligatorio actualizar Apps Script para que la persistencia funcione.**

1. Abrí Apps Script y hacé una copia de seguridad del proyecto y del Google Sheets antes de cambiar el código.
2. Reemplazá `Code.gs` por `backend/apps-script/Code.gs` de esta versión; mantené el `SPREADSHEET_ID` y las demás propiedades existentes.
3. Guardá y ejecutá `setup()`. Crea **dos pestañas nuevas** (si no existen), conservando las anteriores:
   - `workspace_meta`: identifica `capacity` y `projectGantt`, versión actual, integridad, fecha y usuario que guardó.
   - `workspace_chunks`: estado JSON codificado por fragmentos para evitar fórmulas y el límite de texto por celda.
4. **Implementar → Gestionar implementaciones → Editar → Nueva versión → Implementar.** Utilizá la implementación existente para conservar su URL `/exec`.
5. Reiniciá el frontend y entrá con usuario/contraseña. Los módulos cargarán su última versión de Apps Script y mostrarán el indicador «Guardado en Google Sheets».

### Qué se guarda y qué no

| Documento | Contenido compartido | Fuente |
|---|---|---|
| `capacity` | Equipos y colores, colaboradores, bajas, auxiliares, sábados especiales, asignaciones lineales, TP, backlog y reprogramaciones | Apps Script / Sheets |
| `projectGantt` | Sectores, tareas generales y por sector, dependencias, incidencias, avance y observaciones | Apps Script / Sheets |
| `proyecto` | Datos del catálogo y estado de obras | **Solo** importación Excel, como antes |
| `tiempo_obra` | Estimaciones y direcciones | Se guarda por `estimate.save`, como antes |
| Calendario/usuarios/feriados | Jornadas, recesos, acceso por token | APIs existentes |

Los dos documentos se guardan **por separado**. La selección del mes, la pestaña activa y los filtros son preferencias de visualización, no cambios compartidos. Un documento puede llegar a 1.000.000 de caracteres JSON; se serializa y guarda en bloques pequeños con verificación de integridad. `compactWorkspaces()` es un mantenimiento opcional desde Apps Script que conserva las últimas cuatro versiones y puede reducir las filas históricas.

### Seguridad ante trabajos simultáneos

- El frontend trabaja sin bloquear las pantallas: modifica la vista inmediatamente y guarda unos instantes después. El aviso distingue pendiente, guardando, guardado, error o conflicto.
- Apps Script toma un `LockService` y exige `expectedRevision` para cada guardado. Una versión vieja se **rechaza** (`STALE_REVISION`); no se permite sobrescribir silenciosamente el trabajo de otro usuario.
- Si aparece un conflicto: **Descargar borrador** antes de usar «Leer servidor». No hay fusión automática de cambios entre usuarios en esta etapa.
- Si falla la red, el borrador se conserva en memoria mientras la pestaña siga abierta. Descargá una copia antes de cerrar; un fallo de red no significa que se haya guardado.
- Solo `SUPERADMIN`, `ADMIN` y `PLANIFICADOR` pueden escribir. `LECTOR` puede consultar. El servidor valida el token y los permisos en cada solicitud. Las contraseñas y tokens no se almacenan dentro de los documentos de planificación.
- La lectura periódica se hace en segundo plano y **no reemplaza datos locales pendientes**.

### Pasar datos que estaban en localStorage

Al instalar v1.1 **no se copian automáticamente** las planificaciones anteriores: podrían ser datos de ejemplo. Cuando un documento remoto está vacío y se encuentra información local de v1.0, aparece una advertencia con **Descargar copia local** y **Importar datos locales**. Primero descargá la copia y revisá que no incluya escenarios ficticios; después importala **una sola vez** desde el navegador que tenga la planificación correcta. Si el documento remoto ya tiene datos, la importación automática permanece bloqueada para no borrarlos. Las claves históricas (`obras-capacidad-ux-v6`, `obras-gantt-proyectos-ux-v1`) no se eliminan.

## Reglas operativas a conservar

- Por defecto: lunes–jueves 6 horas puras por persona, viernes 5, sábado y domingo 0. Sábados habilitados **por equipo y fecha**; feriados/recesos prevalecen.
- Una obra del grupo «Retiro en ABALUM» no necesita colocación; una obra tercerizada no consume horas internas.
- En estimación el tiempo se carga para dos personas; horas-persona se ajustan según el equipo efectivo.
- Asignación lineal coloca una sola obra por equipo/día y salta días ocupados; permite prolongar el plan al mes siguiente. La modalidad manual todavía muestra sobrecargas superiores al 100%.
- Una TP pendiente derivada de una jornada incompleta se conserva en backlog hasta programarse, sin duplicar horas ni confirmar automáticamente ejecución.
- **El Gantt de proyecto NO vuelve a sumar sus tareas al indicador de ocupación mensual**, para evitar duplicación del esfuerzo.
- Las fechas pasadas no se mueven y el avance ejecutado debe declararse expresamente.
- La distancia de ida se obtiene desde el servicio Maps de Apps Script al pulsar «Calcular». El tiempo de llegada del camión usa velocidad media estimada, no rutas específicas para camiones; todavía no se descuentan horas de traslado de la ocupación.

## Estructura clave

- `src/App.jsx`: sesión, catálogo, navegación y dos workspaces que permanecen montados al cambiar de pantalla.
- `src/lib/useBackendWorkspace.js`: carga remota, guardado asincrónico en serie, revisión de versión, exportación, recuperación e importación manual de datos locales.
- `src/lib/workspaceDefaults.js`: valores iniciales y lectura de versiones guardadas en localStorage.
- `src/components/WorkspaceStatus.jsx`: estado visible de sincronización y conflictos.
- `src/components/CapacityStudio.jsx`: ocupación y equipos; mes visible es local.
- `src/components/ProjectGantt.jsx`: filtro Obra completa, sectores, tareas, dependencias e incidencias.
- `src/lib/ganttRange.js`: generador de rangos; `full` exclusivo del proyecto.
- `backend/apps-script/Code.gs`: `workspace.load`, `workspace.save`, `setup()`, permisos, revisión y fragmentación.
- `tests/workspaceBackend.test.js`, `tests/ganttFullRange.test.js`: casos nuevos.
- `README_AI.md`: convenciones y reglas para próximas iteraciones.
- `README_VERCEL.md`: guía resumida de despliegue.

## Validación de esta entrega

`npm test`: **92 pruebas aprobadas** (negocio + backend simulado + Gantt completo). Revisión sintáctica de 26 archivos JS/JSX: sin errores. **No se pudo comprobar `npm run build` en este entorno** porque npm no logró descargar dependencias. Tampoco se desplegó ni se ejecutó Apps Script contra tu Google Sheets real; probá una cuenta y un proyecto de prueba antes de usarlo para informes definitivos de Gerencia.

## Novedad v1.2: buscador y kilómetros reales de ida

**Gantt por proyecto:** el selector de proyectos del Excel se reemplazó por un campo de búsqueda por número, nombre o cliente. Muestra hasta 12 coincidencias y admite navegación por teclado (flechas, Enter y Escape). Los sectores/tareas y la persistencia quedan iguales.

**Logística → Camiones:** origen fijo `Avenida Siria 1633, San Miguel de Tucumán, Tucumán, Argentina`. La obra debe tener dirección guardada en `tiempo_obra` (pantalla **Tiempos de obra**). Al tocar **Calcular kilómetros de ida**, el frontend realiza `POST /api` con `action: "logistics.route"` y el `projectId` autenticado. Apps Script recupera la dirección desde la hoja y ejecuta `Maps.newDirectionFinder().setMode(DRIVING).getDirections()`; devuelve kilómetros de recorrido por carretera, duración de referencia para automóvil y dirección resuelta.

Se muestran velocidades del camión: 30 km/h (cargado), 50 km/h (viaje largo) o personalizado entre 5 y 110 km/h; más demoras opcionales hasta 300 minutos. El frontend calcula la hora de llegada según la fecha/hora de salida elegida. Cambiar velocidad, demora o salida **no vuelve a consultar Google**. Hay caché de rutas de 6 horas y un límite por usuario de 20 rutas no cacheadas/hora, para cuidar cuotas. Si la dirección no se puede resolver se muestra error en la pantalla.

**Precaución:** Apps Script Maps devuelve rutas de conducción genéricas, **no rutas con restricciones de altura, peso o acceso para camiones**. La duración del camión es *teórica* y no considera congestión dinámica, esperas, carga/descarga ni imprevistos. Confirmá siempre el destino resuelto y el trayecto en Google Maps antes de usarlo operativamente. De momento se calcula únicamente la **ida ABALUM → obra** y no se modifica la ocupación del equipo.

**Backend:** para esta nueva acción sí hay que actualizar `Code.gs` y volver a publicar la implementación existente (ver `README_VERCEL.md`). No requiere crear ni exponer `VITE_GOOGLE_CLIENT_ID`, Google Login, claves de Routes API ni servicios avanzados adicionales; Maps es un servicio nativo de Apps Script, sujeto a las cuotas de Google. La hoja `proyecto` permanece sin modificaciones.

## v1.3 — Gantt por jornadas y portal cliente

**Ocupación mensual** continúa trabajando con horas-persona, ausencias, auxiliares y sobrecarga. **Gantt por proyecto** trabaja exclusivamente con jornadas enteras, sin campo de horas-persona, y permite varias tareas del mismo equipo en una misma fecha. Estas tareas no vuelven a consumir horas del módulo de Gerencia.

- Sobre un cuadrado futuro, pulsá `⋯`, elegí la fecha destino y `Mover jornada sin registrar motivo`. Se desplaza esa jornada y las restantes sin crear una incidencia formal. Podés revertir los días saltados desde el detalle de tarea.
- Ante lluvia, falta de material, etc., elegí `Registrar incidencia`: quedará en el Gantt como una jornada gris y en la tabla de novedades. La publicación del detalle al cliente es una opción explícita, apagada por defecto.
- Al editar una tarea y mover fecha, cambiar equipo o duración, es opcional registrar una reprogramación con motivo. Sin activar esa opción se modifica solo la planificación.
- Los bloqueantes son explícitos; no se crean automáticamente por compartir equipo. Una dependencia desplaza su tarea sucesora si cambia la fecha de finalización de su predecesora.

### Acceso del cliente

En `Usuarios` (SUPERADMIN), creá una cuenta con rol **CLIENTE** y asignale uno o más proyectos. El cliente ingresa con usuario y contraseña en `https://TU-DOMINIO-VERCEL/cliente`. Puede buscar entre sus obras y ver únicamente Gantt, estados, avances y la tabla de novedades publicadas. Apps Script valida la lista `projectIds` del usuario en servidor; jamás entrega al cliente los workspaces completos, datos de operarios, ausencias, costos ni notas internas. El portal no permite editar.

**Se requiere actualizar backend y frontend**: reemplazá `backend/apps-script/Code.gs`, ejecutá `setup()` para agregar el encabezado `projectIds` a `usuarios` sin borrar cuentas, publicá una nueva versión del despliegue existente, y subí el nuevo frontend a Vercel. La ruta `/cliente` ya está configurada en `vercel.json`. Se mantienen `VITE_DEMO_MODE=false` y `APPS_SCRIPT_URL` (solo del lado del servidor). No hay Google OAuth.

Verificaciones locales: 100 tests automatizados aprobados y 48 archivos JS/JSX/GS analizados sin errores sintácticos. No se logró descargar npm (`EAI_AGAIN`), por lo tanto `npm run build` y el despliegue real no están confirmados.
