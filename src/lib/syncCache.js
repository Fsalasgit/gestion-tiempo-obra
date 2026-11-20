// Copia local de lectura: permite mostrar el último estado confirmado al abrir la app.
// Nunca es autoridad para permisos ni confirmación de escrituras; Apps Script lo sigue siendo.
const KEY='obrat-sync-snapshot-v1';
const MAX_AGE_MS=30*24*60*60*1000;

export function readSyncCache(storage=globalThis.localStorage,now=Date.now()) {
  try {
    const raw=storage?.getItem(KEY);
    if(!raw)return null;
    const snapshot=JSON.parse(raw);
    if(snapshot?.v!==1 || !snapshot.actor?.username || !snapshot.actor?.role ||
       !Array.isArray(snapshot.data?.projects) || !Array.isArray(snapshot.data?.estimates) ||
       !Number.isFinite(snapshot.savedAt) || snapshot.savedAt>now || now-snapshot.savedAt>MAX_AGE_MS) {
      storage.removeItem(KEY);return null;
    }
    return {actor:snapshot.actor,data:snapshot.data,savedAt:snapshot.savedAt};
  } catch {return null;}
}

export function writeSyncCache(actor,data,storage=globalThis.localStorage,now=Date.now()) {
  if(!actor?.username || !Array.isArray(data?.projects))return false;
  try {
    storage?.setItem(KEY,JSON.stringify({v:1,savedAt:now,actor,data}));
    return true;
  } catch {return false;} // Cuota / navegación privada: la app sigue disponible.
}

export function clearSyncCache(storage=globalThis.localStorage) {
  try {storage?.removeItem(KEY);} catch { /* Navegador sin almacenamiento */ }
}

export function formatSyncTime(timestamp) {
  if(!Number.isFinite(timestamp))return 'Nunca';
  return new Date(timestamp).toLocaleString('es-AR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
}

// Se guarda el perfil mínimo devuelto por auth.login para reutilizar un token
// sin esperar bootstrap. Esto no otorga permisos: Apps Script revalida cada acción.
const ACTOR_KEY='obrat-session-actor-v1';
export function readSessionActor(storage=globalThis.localStorage,now=Date.now()) {
 try {
  const value=JSON.parse(storage?.getItem(ACTOR_KEY)||'null');
  return value && value.actor?.username && ['SUPERADMIN','ADMIN','PLANIFICADOR','LECTOR'].includes(value.actor.role) && now>=value.at && now-value.at<=MAX_AGE_MS ? value.actor : null;
 }catch{return null;}
}
export function writeSessionActor(actor,storage=globalThis.localStorage,now=Date.now()) {
 if(!actor?.username || !actor?.role)return false;
 try {storage?.setItem(ACTOR_KEY,JSON.stringify({at:now,actor:{username:actor.username,name:actor.name,role:actor.role}}));return true;}catch{return false;}
}
export function clearSessionActor(storage=globalThis.localStorage) {
 try {storage?.removeItem(ACTOR_KEY);}catch{/* Almacenamiento no disponible */}
}
