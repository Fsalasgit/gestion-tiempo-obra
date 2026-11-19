export async function request(action, token, payload={}) {
  const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),90000);
  try {
    const response=await fetch('/api',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,token,...payload}),signal:controller.signal});
    const data=await response.json();
    if (!response.ok || !data.ok) { const error=new Error(data.error || `Error HTTP ${response.status}`);error.code=data.code || 'ERROR';throw error; }
    return data.data;
  } catch (error) {
    if (error.name==='AbortError') throw new Error('La consulta demoró demasiado. Verificá Apps Script.');
    throw error;
  } finally {clearTimeout(timeout);}
}
export function readFileAsBase64(file) {
  if (file.size > 8*1024*1024) return Promise.reject(Error('El Excel no debe superar 8 MB por carga.'));
  if (!/\.(xls|xlsx)$/i.test(file.name)) return Promise.reject(Error('Solo archivos .xls o .xlsx'));
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(',')[1]);reader.onerror=()=>reject(Error('No se pudo leer el archivo'));reader.readAsDataURL(file);
  });
}
