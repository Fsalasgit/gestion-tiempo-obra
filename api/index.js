// Vercel serverless: no datos ni credenciales sensibles se incrustan en el bundle React.
export default async function handler(req, res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({ok:false,error:'Solo POST'});
  const url = process.env.APPS_SCRIPT_URL;
  if (!url || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(url)) {
    return res.status(503).json({ok:false,error:'Falta APPS_SCRIPT_URL en Vercel'});
  }
  const payload = JSON.stringify(req.body || {});
  if (Buffer.byteLength(payload,'utf8') > 10*1024*1024) {
    return res.status(413).json({ok:false,error:'Archivo demasiado grande'});
  }
  try {
    const upstream = await fetch(url,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:payload,redirect:'follow'});
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { throw Error('Apps Script no devolvió JSON. Revisar despliegue y permisos.'); }
    return res.status(upstream.ok ? 200 : 502).json(data);
  } catch (error) {
    return res.status(502).json({ok:false,error:`No fue posible conectar con Apps Script: ${error.message}`});
  }
}
