# ABALUM · ObraTiempo v0.4 — Ocupación de equipos y Gantt mensual

Aplicación React + JavaScript + Vite para analizar la capacidad de colocación por equipo. En esta versión se prioriza **UX y simulación local**, sin grabar las nuevas estructuras de personal o planificación en Google Sheets. Se conserva el backend Apps Script (con usuario, contraseña y token de sesión) para la próxima etapa.

## Inicio rápido

Requiere Node 20.19+.

```bash
npm install
cp .env.example .env   # en PowerShell: Copy-Item .env.example .env
npm run dev
```

Abrir http://localhost:5173. `VITE_DEMO_MODE=true` permite probar todas las pantallas sin credenciales ni Google Cloud. No se solicita `VITE_GOOGLE_CLIENT_ID`.

### Qué información es real y qué no

- **Archivo Excel 19/11/2026 (análisis de importación):** 1.963 registros de proyectos más una fila final de resumen, 28 columnas. Excluidos `Terminado` (1.828) y `Cancelado` (33): **102 proyectos activos / no cerrados** al importarlo. **No se incluye el Excel privado ni sus 102 registros en el bundle publicado**. Estados de las 102 obras: `Ejecucion` 43, `Aprobado` 30, `Tecnica` 12, `Solicitado` 10, `Planificacion` 4, `Planificacion C` 2 y `Pausa Cliente M` 1.
- **Escenario UX:** las 6 obras iniciales, las estimaciones, nombres de 5 colaboradores, 2 equipos, fechas de asignación y porcentajes son **ficticios**. No son cargas confirmadas de la empresa ni deben presentarse como una proyección real para Gerencia. Sustituir antes de emitir un reporte definitivo.
- Las estimaciones de ejemplo se identifican con `example: true` y texto `VALORES DE EJEMPLO`.
- Los cambios de planificación (`equipos`, `colaboradores`, `ausencias`, `asignaciones`) se guardan solamente en `localStorage` bajo `obras-capacidad-ux-v3`. En demo, los tiempos y el catálogo de proyectos también son locales (`obras-tiempo-demo-v3`). Utilizar **Restablecer ejemplo** para recuperar escenario de planificación original.
- **Privacidad:** la v0.4 elimina el catálogo de obras reales del código fuente y lo sustituye por 6 obras ficticias. Para producción usá `VITE_DEMO_MODE=false` y consumí la hoja real desde Apps Script autenticado; no publiques futuras exportaciones de Excel dentro de `src/`.

## Importar archivo actualizado

En **Proyectos**, seleccioná `.xls` o `.xlsx` y pulsá `Actualizar vista previa`.

El navegador lee el Excel sin modificar Google Sheets. Detecta automáticamente los dos formatos conocidos:

| Campo de ObraTiempo | Excel 19/11 (28 columnas) | Excel anterior (48 columnas) |
|---|---|---|
| `id` | `Numero` | `Project ID` o `Numero` |
| `numero` | `Numero` | `Numero` |
| `proyecto` | `Nombre` | `Proyecto` |
| `estado` | `Estado` | `PR - Estado` |
| `inicioP` | `Inicio P.` | `Inicio P.` |
| `inicio` | `Inicio` | `Inicio` |
| `fechaEntrega` | `Fin P.` | `Fec Entrega` |
| `produccion` | `Producido` | `Produccion` |
| `entrega` | `Entrega` | `Entrega` |
| `lider` | `Lider Proyecto` | `Lider de Proyecto` |
| `localidad` | `Localidad Proyecto` | si existe |

Se excluyen estados `Terminado`, `Cancelado`, `Finalizado`, `Cerrado`, `Anulado`, `Completado`, etc. **No** se infiere cierre a partir de `Producido` ni `Entrega`, pues son estados distintos. Las filas sin número y nombre se descartan, incluida la de totales. El catálogo se **reemplaza** solo tras la importación; las estimaciones quedan en otra estructura, conservadas por `projectId`. No existe un botón de edición de proyectos.

**Modo conectado (más adelante):** el backend admite subir archivo desde la pantalla (`project.uploadExcel`) o importar una fuente Google Sheet. Para subir Excel, se requiere el servicio avanzado **Drive API v3** en Apps Script. `setup()` mantiene la pestaña `proyecto` como espejo reemplazable. El importador del backend también fue adaptado para el formato `Estado`/`Nombre`/`Numero`. 

## Reglas de capacidad (actuales en la vista previa)

- Cada estimación se ingresa en **Tiempos de obra**, por **2 personas**. Horas-persona = horas previstas × 2; si se carga en días, 1 día convencional = 6 horas por persona. Este día de estimación no reemplaza la capacidad real por calendario.
- La capacidad diaria por persona es **6 horas lunes a jueves**, **5 horas viernes**, 0 sábado/domingo; admite cambios desde **Calendario laboral**, feriados y recesos.
- Cada colaborador tiene equipo, tipo fijo/adicional, fecha de inicio, fecha de fin opcional y estado activo. Las **bajas** descuentan su capacidad diaria entre dos fechas. Un refuerzo temporal suma su capacidad únicamente en ese intervalo.
- Cada asignación tiene proyecto, equipo, cantidad de personas planificadas y fecha de inicio. Se distribuye el esfuerzo en jornadas hábiles desde esa fecha; **las asignaciones no se bloquean entre sí**. Si coinciden en la jornada del mismo equipo, se suman, lo que permite mostrar **ocupaciones de más de 100%**. Las ausencias no eliminan el trabajo comprometido: únicamente bajan la capacidad.
- La tercerización se marca en la estimación; **mantiene el dato y la referencia en el plan, pero no consume horas internas**. En esta versión se considera tercerización **completa** y no se distribuye parte del esfuerzo a terceros.
- Ocupación mensual = horas-persona asignadas en el mes / horas-persona disponibles ese mes × 100. La barra no limita el porcentaje a 100; si supera el máximo se informa excedente y la columna mensual se tiñe de rojo. **No confundir** la carga total del backlog con trabajo programado en el mes.
- Los días hasta fin de mes excluyen el día actual en días calendario; se muestra por separado la cantidad de jornadas con capacidad disponibles incluyendo hoy, si corresponde. Una jornada con vacaciones o feriado no cuenta.
- Gantt mensual permite navegar libremente a otros meses, ver tareas simultáneas y el porcentaje de cada día. Permite modificar fecha o cuadrilla de cada obra desde **Asignaciones**.
- La proyección no incluye viajes, dependencias, horas extras, materiales, tiempos de carga/descarga ni una promesa firme de finalización. Aún no distribuye partes de una obra entre dos equipos ni distingue tareas de diferentes tamaños de cuadrilla.

## Ruta futura de logística (diseñada, todavía no automatizada)

Salida: **Avenida Siria 1633, San Miguel de Tucumán, Tucumán, Argentina**. La **dirección exacta se carga junto con el tiempo de colocación**, no en el Excel de proyectos. Puede abrirse una ruta de referencia en Google Maps desde la app.

Futuro flujo: base → obra A → obra B → retorno a base (o siguiente destino). Modelo previsto: guardar `transportes`, `tramos`, `equipo`, `origen`, `destino`, `distanciaKm`, `duracionDeRuta`, `velocidadReferencial`, `tiempoCargaDescarga`, `fecha`, `operarioAsignado`, `regreso`. La distancia **no debe calcularse en línea recta** ni inferirse desde velocidad. Google Maps Platform **Routes API** `computeRoutes` y `computeRouteMatrix` permite obtener metros y tiempos reales por carretera, sujetos a habilitar el servicio y su facturación. La velocidad configurada por el usuario (camión cargado, ruta) se utilizará en el cálculo operativo; no debe considerarse un límite legal de velocidad ni una recomendación de circulación. El traslado de personas/equipos descontará horas de la capacidad una vez implementado y validado.

## Acceso simple con usuario + contraseña (backend existente)

Para abandonar demo (`VITE_DEMO_MODE=false`): configurar `APPS_SCRIPT_URL`, `SPREADSHEET_ID` en Propiedades de secuencia de Apps Script y, solo durante el alta inicial, `SUPERADMIN_USERNAME` y `SUPERADMIN_PASSWORD` de 10+ caracteres. Ejecutar `setup()`, publicar Web App como propietario y conectar proxy. Apps Script crea cuenta, genera token de sesión para 30 días al autenticarse, comprueba permisos por rol y revoca el token al cerrar sesión. No hay OAuth Google Login. Conservamos `SUPERADMIN`, `ADMIN`, `PLANIFICADOR`, `LECTOR`.

### Qué se guarda hoy en Apps Script vs qué es únicamente UX

| Sección | Estado |
|---|---|
| `proyecto` al importar fuente | Backend preparado; requiere despliegue/validación real |
| `tiempo_obra` (horas, días, tercerizado, dirección) | Backend preparado; requiere ejecución de `setup()` para agregar `address` a un esquema anterior |
| `calendario_laboral`, `feriados`, `recesos`, `usuarios`, `sesiones` | Backend v0.2 conservado |
| Equipos, colaboradores, ausencias, asignaciones y Gantt | **Solo navegador** hasta validar UX; sin endpoints de escritura todavía |
| Cálculo de kilómetros, rutas y transporte | **Futuro**; solo abre Maps para consulta manual |

## Pruebas

```bash
npm test
npm run build
```

Se verificaron en este entorno 19 pruebas de Node y la sintaxis del JSX, pero **no se pudo instalar los paquetes ni ejecutar la compilación Vite** por falta de conexión con el registro npm. Probar la compilación en tu computadora; antes de producción también validar importación `.xls` real y la API de Apps Script de punta a punta.

## Organización

- `src/components/CapacityStudio.jsx`: UX de capacidad, Gantt, personal, asignaciones y logística futura.
- `src/capacity.css`: interfaz nueva y responsive.
- `src/lib/planner.js`: cálculos sin efectos secundarios (fechas, esfuerzo, personas y capacidad).
- `src/lib/excelImport.js`: detección de ambos formatos de importación.
- `src/lib/domain.js`: reglas básicas de cálculo de tiempos y calendario.
- `src/lib/demo.js`: datos iniciales para recorrer la UX.
- `src/data/demo-projects.json`: seis obras genéricas sin datos internos de clientes.
- `src/data/scenario.js`: valores ficticios del ejemplo de dos equipos.
- `CAMBIOS_v0.3.md`: checklist de lo nuevo y pruebas manuales recomendadas.
- `backend/apps-script/Code.gs`: backend previo y mapeo del Excel actualizado.
- `README_AI.md`: instrucciones para nuevas iteraciones.

## Novedades v0.4: apariencia ABALUM y Vercel

- Temática ABALUM: rojo de referencia `#C9233B`, grafito `#1C1E22`, superficies blancas y gris claro `#F7F7F8`. No se afirma que los códigos sean los oficiales de marca.
- Sidebar, acceso, botones, formularios, métricas y Gantt actualizados. Colores funcionales diferenciados: verde (capacidad), ámbar (atención), rojo tramado (sobrecarga), violeta (tercerizada).
- Se eliminaron nombres de clientes/obras reales del bundle. En la demo hay seis ejemplos, y podés cargar tu Excel para visualizarlo localmente. Los proyectos reales en producción siguen viniendo de Apps Script.
- Ver **`README_VERCEL.md`** antes de publicar. La aplicación debe desplegarse con `VITE_DEMO_MODE=false` y `APPS_SCRIPT_URL` configurado como secreto del servidor (sin prefijo `VITE_`).
- La planificación sigue en localStorage: todavía NO se comparte entre usuarios ni se guarda en Apps Script.
