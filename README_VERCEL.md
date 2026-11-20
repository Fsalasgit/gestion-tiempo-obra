# Publicar ObraTiempo v1.2 · Vercel + Apps Script

## 1. Actualizar el backend ANTES del frontend

1. Conservá una copia del Google Sheets y del `Code.gs` actual.
2. Abrí el mismo proyecto de Apps Script que usa tu aplicación.
3. Reemplazá `Code.gs` con `backend/apps-script/Code.gs` de este ZIP.
4. Ejecutá `setup()` desde el editor. Creará `workspace_meta` y `workspace_chunks` sin borrar `proyecto`, `tiempo_obra`, usuarios ni sesiones.
5. Implementar → Gestionar implementaciones → lápiz → **Nueva versión** → Implementar.
6. Conservá la URL `/exec` actual. Los servicios avanzados de Drive (para subir Excel) permanecen habilitados.

Si solo subís React, verás «Acción desconocida: workspace.load» hasta actualizar el backend.

## 2. Comprobar el frontend

```powershell
npm install
npm test
npm run build
```

Si los comandos terminan sin errores:

```powershell
git add .
git commit -m "ObraTiempo v1.2 - buscador y logistica de ida"
git push
```

Si Vercel está vinculado al repositorio hará el nuevo despliegue.

## 3. Variables Vercel

| Nombre | Valor | Dónde |
|---|---|---|
| `VITE_DEMO_MODE` | `false` | Build del frontend |
| `APPS_SCRIPT_URL` | `https://script.google.com/macros/s/TU_ID/exec` | Entorno del servidor; NO lleva `VITE_` |

Framework: **Vite**. Build: `npm run build`. Output: `dist`. Root Directory: carpeta con `package.json`. El proxy ya está en `api/index.js` y `vercel.json`. No se necesita Google OAuth ni `VITE_GOOGLE_CLIENT_ID`.

## 4. Primera apertura / migración

Iniciá sesión, abrí Ocupación mensual y Gantt por proyecto. Si las hojas de planificación están vacías y tenías trabajo en el navegador anterior, se ofrece una importación manual. Descargá antes la copia local; **no importes una demo ficticia** a tu base real. Si ya hay planificación en Apps Script se descargará automáticamente para lectura.

Probá crear un equipo y una tarea de un proyecto de prueba. Esperá hasta ver **Guardado en Google Sheets**; recargá o abrí otro navegador y verificá que aparecen. Intentá una reprogramación y un sábado extraordinario. Si dos operadores modifican la misma versión, se mostrará un aviso para descargar el borrador y recuperar la última versión del servidor, sin perderla silenciosamente.

## 5. Precauciones

- No subir `.env`, `.xls`, `.xlsx`, datos privados ni credenciales a GitHub. Usá un repositorio privado.
- La pestaña `proyecto` es exclusivamente la fuente importada de Excel. Los Gantt no la editan.
- `LECTOR` consulta, pero no guarda; Apps Script verifica roles y sesión.
- La vista cliente es una vista previa autenticada, no un link público compartible.
- `compactWorkspaces()` puede ejecutarse ocasionalmente desde Apps Script para reducir versiones viejas cuando crezca la hoja de fragmentos.

## 6. Activar cálculo de kilómetros

Esta versión incorpora la acción `logistics.route`; por lo tanto **actualizá `Code.gs` y publicá una nueva versión** de la implementación existente de Apps Script. Ejecutá `setup()` si no estaba actualizado (no borra datos). El servicio `Maps` ya viene incorporado en Apps Script: **no necesitás una nueva API key** para esta primera etapa. El primer uso puede requerir aceptar permisos de Google en el editor; las cuotas de Apps Script siguen aplicando.

1. Cargá la dirección de destino en **Tiempos de obra** y guardala. Debe ser suficientemente precisa (calle, número, localidad y provincia cuando corresponda).
2. Abrí **Ocupación mensual → Logística · camiones**.
3. Elegí una obra, presioná «Calcular kilómetros de ida», definí velocidad del camión y hora de salida.
4. Compará la dirección que encontró Google con la dirección real; abrí «Ver en Google Maps» para verificar el camino.

**Limitación:** el kilometraje utiliza rutas generales de circulación automotor, no contempla prohibiciones de camiones. El tiempo de camión es una estimación por velocidad elegida, no un ETA de tránsito en vivo. Todavía no modifica la disponibilidad de los equipos.

## v1.3: portal cliente

Actualizá Apps Script con `Code.gs`, ejecutá `setup()` para agregar `usuarios.projectIds` y desplegá una **nueva versión de la misma implementación**. Después subí a Vercel el frontend actualizado. El enlace a compartir con cada cuenta CLIENTE es `https://TU-DOMINIO/cliente`. Las obras autorizadas se eligen en **Usuarios**; no expongas la URL `/exec` ni credenciales del servidor al cliente.
