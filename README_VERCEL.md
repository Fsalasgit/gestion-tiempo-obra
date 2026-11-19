# Publicar ABALUM · ObraTiempo v0.4 en Vercel

## 1. Verificar en tu computadora

```powershell
Copy-Item .env.example .env
npm install
npm test
npm run build
```

No subir `.env`, `node_modules`, `dist` ni exportaciones privadas de proyectos. `.gitignore` ya los excluye parcialmente; revisá `git status` antes del commit.

## 2. Subir repositorio a GitHub

Ejecutar dentro de la carpeta que contiene `package.json` (no en su carpeta padre):

```powershell
git init
git add .
git commit -m "ObraTiempo v0.4 - temática ABALUM"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPOSITORIO.git
git push -u origin main
```

Si el repositorio ya existe, NO repetir `git init` ni `remote add`: basta `git add .`, `git commit` y `git push`. Recomendamos **repositorio privado**, por tratarse de una app empresarial.

## 3. Crear proyecto Vercel

1. Vercel → Add New → Project → Importar desde GitHub.
2. Framework: **Vite** (React). Root Directory: carpeta del proyecto con `package.json` (si es la raíz del repositorio, dejar vacío o `./`).
3. Build Command: `npm run build`. Output Directory: `dist`. Install Command: `npm install`. Node.js: 22 o compatible con `>=20.19.0`.
4. Variables de entorno (Production):

   | Nombre | Valor | Observación |
   |---|---|---|
   | `VITE_DEMO_MODE` | `false` | Obliga al inicio de sesión real |
   | `APPS_SCRIPT_URL` | `https://script.google.com/macros/s/ID/exec` | **Solo servidor**, nunca `VITE_APPS_SCRIPT_URL` |

5. Deploy. Si agregaste variables después de un despliegue anterior, hacé **Redeploy** de la versión actual.

`vercel.json` ya configura `/api` → `api/index.js`, que retransmite llamadas al Apps Script sin exponer su URL al navegador. No se necesita `VITE_GOOGLE_CLIENT_ID`.

## 4. Apps Script

- Conservar el `Code.gs` v0.3 actualizado y su despliegue activo.
- En las Propiedades del script configurar `SPREADSHEET_ID` y usuarios como se indica en `README.md`. El ID de la hoja no va en Vercel.
- El backend Apps Script debe verificar tokens y roles **en cada operación**; el frontend no es un control de seguridad.
- Habilitar accesibilidad de la implementación web para el proxy según el modelo de autenticación elegido; si configurás la ejecución como propietario, Apps Script puede acceder a su hoja, pero la autenticación propia por token es indispensable.

## 5. Verificaciones posteriores

- Abrir la URL de Vercel en ventana privada: debe aparecer **Usuario / Contraseña**, no entrar en demo.
- Comprobar login, navegación, lectura de proyectos y subida de Excel con una cuenta de prueba.
- Comprobar que se actualiza la hoja `proyecto` y que las estimaciones de `tiempo_obra` se conservan.
- Cerrar sesión y verificar que el token ya no permite consultar datos.
- La planificación de equipos, colaboradores y Gantt **sigue guardándose en localStorage por navegador**. Todavía no hay persistencia común entre usuarios, por lo que no debe presentarse como planificación sincronizada.

## Guía de color

`src/styles.css`: variables `--abalum-*`. `src/capacity.css`: `--cap-*`. El rojo y grafito son aproximaciones visuales coherentes con la marca, no códigos validados contra su manual oficial.

## Versión 0.5 · luego del despliegue anterior

Además de subir el frontend actualizado a GitHub/Vercel, reemplazar `backend/apps-script/Code.gs`, ejecutar `setup()` y crear una **nueva versión** de la implementación web de Apps Script: el backend ahora incluye `grupo` al final de `proyecto` y admite contraseñas desde un carácter (inseguro para producción). Volver a importar el Excel para precargar `Grupo`. Los nuevos cubitos y operarios auxiliares siguen siendo **una vista previa local**, no se comparten entre navegadores.
