import React from 'react';
import {AlertTriangle,CheckCircle2,CloudDownload,CloudUpload,RefreshCcw,RotateCcw} from 'lucide-react';
import {isDemo} from '../lib/demo.js';
import './workspaceStatus.css';

const LABEL={loading:'Cargando desde Apps Script…',loadError:'No se pudo leer la planificación',
 local:'Modo demo: guardado en este navegador',pending:'Cambios pendientes de guardar',saving:'Guardando en segundo plano…',
 saved:'Guardado en Google Sheets',refreshError:'No se pudo verificar la versión más reciente',saveError:'No se pudieron guardar los cambios',conflict:'Hay otra versión más reciente en el servidor'};

export function WorkspaceStatus({state,title}){
 if(isDemo)return <div className="ws-status local"><CheckCircle2 size={16}/> {LABEL.local}</div>;
 const warning=['conflict','loadError','saveError','refreshError'].includes(state.status);
 return <section className={`ws-status ${warning?'problem':state.status==='saved'?'saved':'working'}`} role="status" aria-live="polite">
  {warning?<AlertTriangle size={17}/>:state.status==='saved'?<CheckCircle2 size={17}/>:<CloudUpload size={17}/>}
  <div className="ws-status-main"><b>{title}: {LABEL[state.status]||'Sincronizando…'}</b>
   {state.error&&<small>{state.error}</small>}
   {state.status==='saved'&&<small>Versión {state.revision} · {state.lastSaved?`Actualizado: ${state.lastSaved.replace('T',' ')}`:'Todavía sin modificaciones guardadas'}</small>}
   {state.status==='conflict'&&<small>Tu borrador permanece en memoria. Descargalo antes de leer la versión remota para no perder cambios.</small>}
  </div>
  <div className="ws-actions">
   {['loadError','saveError','refreshError'].includes(state.status)&&<button type="button" onClick={state.retry}><RefreshCcw size={14}/> Reintentar</button>}
   {state.status==='conflict'&&<><button type="button" onClick={state.exportDraft}><CloudDownload size={14}/> Descargar borrador</button><button type="button" onClick={state.discardAndReload}><RotateCcw size={14}/> Leer servidor</button></>}
   {state.ready&&state.status==='saved'&&<button type="button" onClick={state.reload}><RefreshCcw size={14}/> Actualizar</button>}
  </div>
  {state.legacyFound&&<div className="ws-migration">
    <b>Encontramos datos anteriores guardados solo en este navegador.</b>
    <span>El servidor todavía está vacío. No se importaron automáticamente para evitar reemplazar información compartida.</span>
    <button type="button" onClick={state.exportLegacy}><CloudDownload size={14}/> Descargar copia local</button>
    {state.writable&&<button type="button" onClick={()=>{if(window.confirm('Importar al servidor la planificación guardada en ESTE navegador? Revisá que no sean datos ficticios de la demo.'))state.importLegacy();}}>Importar datos locales</button>}
   </div>}
 </section>;
}
export function WorkspaceGate({state,title,children}){
 return <>
  <WorkspaceStatus state={state} title={title}/>
  {!state.ready?<div className="ws-gate"><h2>{state.status==='loadError'?'No se puede abrir la planificación sin verificar los datos del servidor':'Leyendo la planificación…'}</h2><p>Podés seguir navegando por los otros módulos. No se realizarán cambios sobre datos sin confirmar.</p></div>:children}
 </>;
}
