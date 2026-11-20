import React,{useState} from 'react';
import {X} from 'lucide-react';
import {dateISO} from '../lib/planner.js';
import {isDateBlocked} from '../lib/domain.js';
const today=()=>dateISO(new Date());
const weekday=iso=>new Date(`${iso}T12:00:00`).getDay();
const fmtDate=s=>s?s.split('-').reverse().join('/'):'Sin fecha';

export default function SaturdayEditor({details,store,setStore,data,close,confirmMove}){
 const {date,pendingTaskId}=details;
 const [teamId,setTeamId]=useState(details.teamId||store.teams[0]?.id||'');
 const record=(store.specialDays||[]).find(x=>x.date===date&&x.teamId===teamId);
 const [hoursSat,setHoursSat]=useState(record?.hours||6);
 const [message,setMessage]=useState('');
 const existing=store.blocks.filter(b=>b.date===date&&b.teamId===teamId&&b.status!=='backlog');
 const blocked=isDateBlocked(date,data.holidays||[],data.recesses||[],details.projectId||'');
 const save=e=>{e.preventDefault();
  if(weekday(date)!==6||date<today()){setMessage('Solo se pueden habilitar sábados de hoy en adelante.');return;}
  if(blocked){setMessage('La fecha está bloqueada por feriado o receso general.');return;}
  const hours=Number(hoursSat);
  if(!(hours>=0.5 && hours<=12)){setMessage('Indicá entre 0,5 y 12 horas de jornada.');return;}
  setStore(old=>({...old,specialDays:[...(old.specialDays||[]).filter(x=>!(x.date===date&&x.teamId===teamId)),{date,teamId,hours,enabled:true}]}));
  const task=store.blocks.find(b=>b.id===pendingTaskId);
  close();if(task&&task.teamId===teamId)confirmMove(task.id,date);
 };
 const disable=()=>{
  if(existing.length){setMessage('Este sábado tiene TP asignadas: primero reprogramalas.');return;}
  setStore(old=>({...old,specialDays:(old.specialDays||[]).filter(x=>!(x.date===date&&x.teamId===teamId))}));close();
 };
 return <div className="cap-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)close();}}>
  <section className="cap-task-modal cap-sat-modal" role="dialog" aria-modal="true" aria-label="Habilitar sábado">
   <div className="cap-intro"><div><h2>Trabajar el sábado · {fmtDate(date)}</h2><p>Excepción por equipo y fecha; no habilita todos los sábados.</p></div><button className="cap-icon-button" aria-label="Cerrar" type="button" onClick={close}><X size={19}/></button></div>
   <form onSubmit={save} className="cap-form">
    <label>Equipo<select value={teamId} onChange={e=>{setTeamId(e.target.value);setHoursSat((store.specialDays||[]).find(x=>x.date===date&&x.teamId===e.target.value)?.hours||6);setMessage('');}}>{store.teams.map(t=><option value={t.id} key={t.id}>{t.name}</option>)}</select></label>
    <label>Horas de trabajo puro<input type="number" min="0.5" max="12" step="0.5" value={hoursSat} onChange={e=>setHoursSat(e.target.value)}/></label>
    <p className="cap-muted">{existing.length} TP ya asignadas este sábado. El descanso y el transporte siguen fuera del tiempo puro.</p>
    {blocked&&<p className="cap-form-error">Feriado o receso: primero revisá el calendario laboral.</p>}
    {message&&<p role="alert" className="cap-form-error">{message}</p>}
    <div className="cap-modal-actions"><button type="button" className="cap-btn" onClick={close}>Cancelar</button>{record&&<button type="button" className="cap-btn" onClick={disable}>Deshabilitar sábado</button>}<button type="submit" className="cap-btn primary" disabled={blocked}>Guardar sábado</button></div>
   </form>
  </section>
 </div>;
}

