import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

// Apps Script ContentService redirige su JSON a googleusercontent.com.
// El proxy resuelve la redirección y evita problemas CORS del navegador.
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  return {
    plugins: [react(), {
      name: 'apps-script-dev-proxy',
      configureServer(server) {
        server.middlewares.use('/api', async (req, res) => {
          if (req.method !== 'POST') {
            res.writeHead(405, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ok:false,error:'Solo POST'})); return;
          }
          const url = env.APPS_SCRIPT_URL;
          if (!url || url.includes('REEMPLAZAR')) {
            res.writeHead(503, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ok:false,error:'Configurar APPS_SCRIPT_URL en .env'})); return;
          }
          try {
            let body = '';
            for await (const chunk of req) {
              body += chunk;
              if (body.length > 12 * 1024 * 1024) throw Error('Archivo demasiado grande');
            }
            const result = await fetch(url, {method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body,redirect:'follow'});
            const text = await result.text();
            res.writeHead(result.ok ? 200 : 502, {'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});
            res.end(text);
          } catch (e) {
            res.writeHead(502, {'Content-Type':'application/json'});
            res.end(JSON.stringify({ok:false,error:`Proxy Apps Script: ${e.message}`}));
          }
        });
      }
    }],
    server: { port: 5173 },
    build: { target:'es2022' }
  };
});
