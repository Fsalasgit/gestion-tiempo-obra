import {useCallback,useEffect,useRef,useState} from 'react';

/**
 * Editor optimista compartido por la aplicación completa.
 * - Carga remota antes de permitir modificar; la lectura jamás escribe.
 * - Guarda en serie, agrupando pulsaciones en una sola escritura.
 * - expectedRevision evita sobrescribir cambios realizados desde otro navegador.
 * - Al fallar, el borrador queda en memoria y se puede exportar/reintentar.
 */
export function useBackendWorkspace({workspace,enabled,demoMode=false,autoRefresh=true,writable=true,api,initial,localKey,legacyReader}){
 const [value,setValueState]=useState(()=>{
  if(demoMode&&legacyReader){const v=legacyReader();if(v)return v;}
  return initial();
 });
 const valueRef=useRef(value);
 const [status,setStatus]=useState(enabled?'loading':'local');
 const [error,setError]=useState('');
 const [revision,setRevision]=useState(0);
 const [lastSaved,setLastSaved]=useState('');
 const [legacyFound,setLegacyFound]=useState(false);
 const revisionRef=useRef(0);
 const changedRef=useRef(0);
 const savedRef=useRef(0);
 const inflightRef=useRef(false);
 const readyRef=useRef(!enabled);
 const conflictRef=useRef(false);
 const sessionRef=useRef(0);
 const mountedRef=useRef(true);
 const timeoutRef=useRef(null);
 const checkingRef=useRef(false);
 const lastCheckRef=useRef(0);
 const safeStatus=useCallback(next=>{if(mountedRef.current)setStatus(next);},[]);
 const replace=useCallback(next=>{
  valueRef.current=next;
  if(mountedRef.current)setValueState(next);
 },[]);
 const initialize=useCallback(async()=>{
  if(!enabled)return;
  const session=++sessionRef.current;
  readyRef.current=false;conflictRef.current=false;
  safeStatus('loading');setError('');
  try{
   const result=await api.load(workspace);
   if(session!==sessionRef.current||!mountedRef.current)return;
   const remote=result.value===null?initial():result.value;
   revisionRef.current=result.revision;
   setRevision(result.revision);
   replace(remote);
   changedRef.current=0;savedRef.current=0;
   readyRef.current=true;
   setLastSaved(result.updatedAt||'');lastCheckRef.current=Date.now();
   setLegacyFound(result.revision===0&&!!legacyReader?.());
   safeStatus('saved');
  }catch(err){
   if(session!==sessionRef.current||!mountedRef.current)return;
   setError(err.message||'No se pudo leer el estado desde Apps Script.');
   safeStatus('loadError');
  }
 },[api,enabled,workspace,initial,legacyReader,replace,safeStatus]);
 useEffect(()=>{
  mountedRef.current=true;
  if(enabled)void initialize();
  else {readyRef.current=true;safeStatus('local');}
  return ()=>{mountedRef.current=false;sessionRef.current++;clearTimeout(timeoutRef.current);};
 },[enabled,initialize,safeStatus]);
 const flushRef=useRef(null);
 const flush=useCallback(async()=>{
  if(!enabled||!readyRef.current||conflictRef.current||inflightRef.current||changedRef.current===savedRef.current)return;
  const snapshot=JSON.parse(JSON.stringify(valueRef.current));
  const savingSequence=changedRef.current;
  inflightRef.current=true;
  safeStatus('saving');setError('');
  let success=false;
  try{
   const result=await api.save(workspace,snapshot,revisionRef.current);
   success=true;
   revisionRef.current=result.revision;
   if(mountedRef.current){setRevision(result.revision);setLastSaved(result.updatedAt||'');}
   savedRef.current=savingSequence;
   if(mountedRef.current)safeStatus(changedRef.current===savedRef.current?'saved':'pending');
  }catch(err){
   if(!mountedRef.current)return;
   const conflict=err.code==='STALE_REVISION';
   if(conflict)conflictRef.current=true;
   setError(err.message||'No se pudo guardar el cambio.');
   safeStatus(conflict?'conflict':'saveError');
  }finally{
   inflightRef.current=false;
   if(success&&mountedRef.current&&!conflictRef.current&&changedRef.current>savedRef.current){
    // Reenviamos cualquier edición hecha mientras se guardaba la anterior.
    clearTimeout(timeoutRef.current);
    timeoutRef.current=setTimeout(()=>flushRef.current?.(),650);
   }
  }
 },[api,enabled,workspace,safeStatus]);
 flushRef.current=flush;
 const update=useCallback(updater=>{
  if(enabled&&(!readyRef.current||!writable))return;
  setValueState(previous=>{
   const next=typeof updater==='function'?updater(previous):updater;
   valueRef.current=next;
   return next;
  });
  if(enabled){
   changedRef.current++;
   safeStatus('pending');
   clearTimeout(timeoutRef.current);
   timeoutRef.current=setTimeout(()=>flushRef.current?.(),950);
  }
 },[enabled,writable,safeStatus]);
 useEffect(()=>{
  if(!demoMode||!localKey)return;
  try{localStorage.setItem(localKey,JSON.stringify(value));}catch{setError('No se pudo conservar la demo en este navegador.');}
 },[demoMode,value,localKey]);
 const reload=useCallback(async()=>{
  if(!enabled||!readyRef.current||conflictRef.current||checkingRef.current||inflightRef.current||changedRef.current!==savedRef.current)return false;
  const localVersion=changedRef.current;
  const session=sessionRef.current;
  checkingRef.current=true;lastCheckRef.current=Date.now();
  try{
   const result=await api.load(workspace);
   // Si hubo una edición mientras se descargaba, no se aplica la respuesta antigua.
   if(!mountedRef.current||session!==sessionRef.current||changedRef.current!==localVersion||inflightRef.current||conflictRef.current)return false;
   if(result.revision!==revisionRef.current){
    revisionRef.current=result.revision;setRevision(result.revision);
    replace(result.value===null?initial():result.value);
    setLastSaved(result.updatedAt||'');
   }
   setError('');safeStatus('saved');return true;
  }catch(err){
   if(mountedRef.current){setError(err.message||'No se pudo consultar la última versión.');safeStatus('refreshError');}
   return false;
  }finally{checkingRef.current=false;}
 },[api,enabled,workspace,initial,replace,safeStatus]);
 const retry=useCallback(()=>{
  if(status==='loadError')return void initialize();
  if(status==='refreshError')return void reload();
  if(status==='saveError'&&!inflightRef.current){clearTimeout(timeoutRef.current);void flushRef.current?.();}
 },[status,initialize,reload]);
 const importLegacy=useCallback(()=>{
  if(!enabled||!writable||!readyRef.current||revisionRef.current!==0||!legacyReader)return false;
  const draft=legacyReader();if(!draft)return false;
  setLegacyFound(false);
  update(draft);
  return true;
 },[enabled,writable,legacyReader,update]);
 // Actualización silenciosa: nunca bloquea el editor ni pisará un borrador pendiente.
 useEffect(()=>{
  if(!enabled||!autoRefresh)return;
  const check=()=>{
   if(document.visibilityState==='visible'&&Date.now()-lastCheckRef.current>3*60*1000)void reload();
  };
  const timer=setInterval(check,60*1000);
  document.addEventListener('visibilitychange',check);
  window.addEventListener('online',check);
  return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',check);window.removeEventListener('online',check);};
 },[enabled,autoRefresh,reload]);
 const discardAndReload=useCallback(()=>{
  if(!window.confirm('Vas a descartar los cambios locales sin guardar y leer la última versión del servidor. ¿Continuar?'))return;
  changedRef.current=0;savedRef.current=0;conflictRef.current=false;clearTimeout(timeoutRef.current);void initialize();
 },[initialize]);
 const downloadJson=(payload,filename)=>{
  const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=filename;a.click();URL.revokeObjectURL(url);
 };
 const exportDraft=useCallback(()=>{
  const content=JSON.stringify({workspace,revision:revisionRef.current,exportedAt:new Date().toISOString(),value:valueRef.current},null,2);
  const blob=new Blob([content],{type:'application/json'});const url=URL.createObjectURL(blob);
  const a=document.createElement('a');a.href=url;a.download=`obratempo-${workspace}-respaldo.json`;a.click();URL.revokeObjectURL(url);
 },[workspace]);
 const exportLegacy=useCallback(()=>{
  const draft=legacyReader?.();if(!draft)return;
  downloadJson({workspace,source:'localStorage',exportedAt:new Date().toISOString(),value:draft},`obratempo-${workspace}-datos-locales.json`);
 },[legacyReader,workspace]);
 return {value,setValue:update,status,error,revision,lastSaved,legacyFound,writable,
  ready:!enabled||readyRef.current,retry,reload,importLegacy,exportLegacy,discardAndReload,exportDraft,dirty:changedRef.current!==savedRef.current};
}
