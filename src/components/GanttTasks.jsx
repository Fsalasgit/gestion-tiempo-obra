import React,{useEffect,useMemo,useState} from 'react';
import {CalendarClock,Check,CloudRain,Grip,Plus,Undo2,X,Users,AlertTriangle,History} from 'lucide-react';
import {activePeople,dateISO,hours,isOutsourced,percent,effort} from '../lib/planner.js';
import {countDailyHours} from '../lib/domain.js';
import SaturdayEditor from './SaturdayEditor.jsx';
import RangeButtons from './RangeButtons.jsx';
import {canEditBlock,canScheduleOn,isPast,isPickupProject,newBlockId,splitPartial,derivePendingTask,PENDING_REASONS,taskStatus} from '../lib/workBlocks.js';
import {dailyBlockCoverage,defaultWorkerIds,monthlyBlockCoverage,reprogramStats,rescheduleBlock,teamColor} from '../lib/taskPlanning.js';

const MON_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const weekday=iso=>new Date(`${iso}T12:00:00`).getDay();
const today=()=>dateISO(new Date());
const fmtDate=s=>s?s.split('-').reverse().join('/'):'Backlog';
const visible=(a,estimates)=>!isOutsourced(estimates.find(e=>String(e.projectId)===String(a.projectId)));
const blockLoad=blocks=>blocks.reduce((sum,b)=>sum+Number(b.personHours||0),0);
function ProjectEffort({task,blocks,estimates}){
 const e=estimates.find(x=>String(x.projectId)===String(task.projectId));
 const total=effort(e),planned=blockLoad(blocks.filter(b=>String(b.projectId)===String(task.projectId)));
 const done=blockLoad(blocks.filter(b=>String(b.projectId)===String(task.projectId)&&b.status==='realizado'));
 return <div className="cap-project-effort"><b>Consumo de horas de la obra</b><div className="cap-project-effort-grid"><span>Esta TP<strong>{hours(task.personHours)} h-persona</strong></span><span>Estimación original<strong>{hours(total)} h-persona</strong></span><span>TP creadas<strong>{hours(planned)} h-persona</strong></span><span>Horas confirmadas<strong>{hours(done)} h-persona</strong></span></div><div className="cap-day-bar"><i style={{width:`${Math.min(100,total?planned/total*100:0)}%`}} className={planned>total?'over':''}/></div><small>{planned>total?`Hay ${hours(planned-total)} h-persona adicionales a la estimación.`:`Restan ${hours(Math.max(0,total-planned))} h-persona por distribuir en TP.`} Las horas completadas solo cuentan si se registró su ejecución.</small></div>;
}

function TaskEditor({task,store,setStore,data,close,proposedDate}){
 const [draft,setDraft]=useState(()=>({...task,date:proposedDate??task.date,workers:proposedDate!==undefined&&proposedDate!==task.date?defaultWorkerIds(task.teamId,proposedDate,store.members,store.absences,store.supportShifts||[]):[...(task.workers||[])],workerHours:proposedDate!==undefined&&proposedDate!==task.date?{}:{...(task.workerHours||{})}}));
 const [reprogramReason,setReprogramReason]=useState('');
 const [doneHours,setDoneHours]=useState('');
 const [auxToAdd,setAuxToAdd]=useState('');
 const [stagedAux,setStagedAux]=useState([]);
 const [error,setError]=useState('');
 const [splitOpen,setSplitOpen]=useState(false);
 const [pendingHours,setPendingHours]=useState('');
 const [pendingReason,setPendingReason]=useState('');
 const [pendingNote,setPendingNote]=useState('');
 const locked=isPast(task.date)||task.status==='realizado';
 const team=store.teams.find(x=>x.id===draft.teamId);
 const project=data.projects.find(x=>String(x.id)===String(task.projectId));
 const changed=draft.date!==task.date||draft.teamId!==task.teamId;
 const date=draft.date||today();
 const support=[...(store.supportShifts||[]),...stagedAux.map(memberId=>({memberId,teamId:draft.teamId,date:draft.date}))];
 const available=draft.date?activePeople(draft.teamId,draft.date,store.members,store.absences,support):[];
 const eligible=new Set(available.map(p=>p.id));
 const auxiliaries=store.members.filter(m=>m.kind==='auxiliar'&&!m.archivedAt&&(!m.start||date>=m.start)&&(!m.end||date<=m.end)&&!stagedAux.includes(m.id)&&!(store.supportShifts||[]).some(sh=>sh.date===date&&sh.memberId===m.id&&sh.teamId!==draft.teamId));
 const dayHours=draft.date?countDailyHours(draft.date,data.week,data.holidays,data.recesses,draft.projectId,store.specialDays||[],draft.teamId):0;
 const preview=useMemo(()=>{
  if(!draft.date)return {need:Number(draft.personHours)||0,covered:0,missing:Number(draft.personHours)||0,coverage:0,workers:[]};
  const blocks=store.blocks.map(b=>b.id===task.id?{...draft,personHours:Number(draft.personHours)||0}:b);
  return dailyBlockCoverage({date:draft.date,blocks,members:store.members,absences:store.absences,supportShifts:support,specialDays:store.specialDays||[],week:data.week,holidays:data.holidays,recesses:data.recesses,projects:data.projects,estimates:data.estimates})[task.id]||{need:0,covered:0,missing:0,coverage:0,workers:[]};
 },[draft,store.blocks,store.members,store.absences,store.supportShifts,stagedAux,data,task.id]);
 const updatePerson=(id,enabled)=>setDraft(old=>({...old,workers:enabled?[...new Set([...(old.workers||[]),id])]:(old.workers||[]).filter(x=>x!==id),workerHours:enabled?old.workerHours:Object.fromEntries(Object.entries(old.workerHours||{}).filter(([key])=>key!==id))}));
 const changeTeamDate=(next)=>setDraft(old=>{
  const newer={...old,...next};
  const people=defaultWorkerIds(newer.teamId,newer.date,store.members,store.absences,store.supportShifts||[]);
  return {...newer,workers:people,workerHours:{}};
 });
 const save=(toBacklog=false)=>{
  if(locked)return;
  setError('');
  const nextDate=toBacklog?'':draft.date;
  if(nextDate&&nextDate<today()){setError('No se pueden asignar TP a fechas pasadas.');return;}
  if(!canScheduleOn(nextDate,draft.projectId,data.week,data.holidays,data.recesses,store.specialDays||[],draft.teamId)){setError('El día elegido no es laborable o corresponde a un receso.');return;}
  if(!(Number(draft.personHours)>0)){setError('Ingresá horas-persona mayores que cero.');return;}
  if(stagedAux.length&&!nextDate){setError('Para solicitar auxiliares primero elegí una fecha.');return;}
  try {
   const next=rescheduleBlock(task,{...draft,date:nextDate,personHours:Number(draft.personHours),crew:Math.max(1,Number(draft.crew)||1)},reprogramReason,today());
   // Una TP automática intervenida a mano deja de regenerarse en Recalcular futuro.
   if(task.origin==='lineal')next.origin='manual';
   setStore(s=>({...s,blocks:s.blocks.map(b=>b.id===task.id?next:b),supportShifts:[...(s.supportShifts||[]),...stagedAux.map(memberId=>({id:`S-${newBlockId()}`,memberId,teamId:next.teamId,date:next.date}))]}));
   close();
  }catch(e){setError(e.message);}
 };
 const confirmComplete=()=>{
  if(locked||draft.date!==today()){setError('La ejecución solo se registra el día actual.');return;}
  if(!(draft.workers||[]).length){setError('Seleccioná quiénes participaron.');return;}
  if(changed){setError('Guardá primero la reprogramación antes de confirmar la ejecución.');return;}
  if(stagedAux.length){setError('Guardá primero los auxiliares solicitados antes de confirmar.');return;}
  if(preview.coverage<100&&!window.confirm(`La TP está cubierto solo al ${preview.coverage}% según las horas asignadas. ¿Confirmás que realmente se completó?`))return;
  const names=store.members.filter(m=>draft.workers.includes(m.id)).map(m=>m.name);
  setStore(s=>({...s,blocks:s.blocks.map(x=>x.id===task.id?{...draft,workerNames:names,status:'realizado',completedAt:new Date().toISOString()}:x)}));close();
 };
 const pendingSplit=()=>{
  if(locked)return;
  setError('');
  const relevant=({date,teamId,personHours,crew,title,notes,workers,workerHours})=>({date,teamId,personHours:Number(personHours),crew:Number(crew),title,notes,workers:[...(workers||[])].sort(),workerHours:workerHours||{}});
  if(JSON.stringify(relevant(draft))!==JSON.stringify(relevant(task))){
    setError('Guardá primero los cambios de la TP; después podrás desprender el trabajo pendiente.');return;
  }
  if(stagedAux.length){setError('Guardá primero la solicitud de auxiliares.');return;}
  try{
    const {original,pendingTask}=derivePendingTask(task,Number(pendingHours),pendingReason,pendingNote,today());
    // Al desprender una TP lineal, preservar la relación padre/hija frente al recálculo.
    if(task.origin==='lineal')original.origin='manual';
    setStore(s=>({...s,blocks:[...s.blocks.map(b=>b.id===task.id?original:b),pendingTask]}));
    close();
  }catch(e){setError(e.message);}
 };
 const partial=()=>{
  if(locked||draft.date!==today())return;
  if(!draft.workers?.length||changed||stagedAux.length){setError('Seleccioná operarios y guardá primero cualquier cambio de fecha o auxiliar.');return;}
  if(!pendingReason){setError('Indicá el motivo del trabajo incumplido antes de registrar una ejecución parcial.');return;}
  try{
   const {completed,remaining}=splitPartial({...draft,workers:[...draft.workers]},Number(doneHours),today(),pendingReason,pendingNote);
   const names=store.members.filter(m=>draft.workers.includes(m.id)).map(m=>m.name);
   setStore(s=>({...s,blocks:[...s.blocks.map(x=>x.id===task.id?{...completed,workerNames:names}:x),remaining]}));close();
  }catch(e){setError(e.message);}
 };
 useEffect(()=>{
  const onEscape=e=>{if(e.key==='Escape')close();};
  window.addEventListener('keydown',onEscape);
  return()=>window.removeEventListener('keydown',onEscape);
 },[close]);
 return <div className="cap-modal-backdrop" onMouseDown={e=>{if(e.currentTarget===e.target)close();}}>
  <section className="cap-modal cap-task-modal" role="dialog" aria-modal="true" aria-label="Editar TP de colocación">
   <div className="cap-modal-head"><div><div className="cap-eyebrow">{project?.numero||''} · {taskStatus(task)}</div><h2>{locked?'Registro histórico de colocación':'Planificar / reprogramar TP'}</h2><p>{project?.proyecto||'Obra'} · {fmtDate(task.date)}</p></div><button type="button" className="cap-icon-button" onClick={close} aria-label="Cerrar modal"><X size={18}/></button></div>
   {task.origin==='pendiente'&&<p className="cap-task-lineage">TP pendiente derivada de <b>{task.parentId}</b> · {task.pendingReason||task.reason||'Trabajo pendiente'}{task.pendingNote?` · ${task.pendingNote}`:''}</p>}
   {locked?<div className="cap-task-history"><strong>Fecha pasada o tarea confirmada · solo lectura</strong><p>{task.status==='sin_confirmar'?'La tarea se planificó, pero nadie confirmó que se realizó.':'El trabajo confirmado conserva su equipo y los operarios registrados.'}</p><p><b>Personas registradas:</b> {task.workerNames?.join(', ')||'Sin confirmación'}</p><p><b>Horas previstas / registradas:</b> {hours(task.personHours)} h-persona</p>{(task.reprogramHistory||[]).map((r,i)=><p key={i}>{fmtDate(r.fromDate)} → {fmtDate(r.toDate)} · {r.reason}</p>)}</div>:<>
    <div className="cap-task-edit-grid">
     <label>Nombre de la tarea<input value={draft.title||''} onChange={e=>setDraft(s=>({...s,title:e.target.value}))}/></label>
     <label>Fecha<input type="date" min={today()} value={draft.date||''} onChange={e=>{changeTeamDate({date:e.target.value});setStagedAux([]);setAuxToAdd('');}}/></label>
     <label>Equipo<select value={draft.teamId} onChange={e=>{changeTeamDate({teamId:e.target.value});setStagedAux([]);setAuxToAdd('');}}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
     <label>Horas-persona requeridas<input type="number" min="0.1" step="0.5" value={draft.personHours} onChange={e=>setDraft(s=>({...s,personHours:e.target.value}))}/></label>
     <label>Cuadrilla prevista<input type="number" min="1" max="40" value={draft.crew||1} onChange={e=>setDraft(s=>({...s,crew:Number(e.target.value)}))}/></label>
     <label>Nota de trabajo<input value={draft.notes||''} onChange={e=>setDraft(s=>({...s,notes:e.target.value}))} placeholder="Materiales, ajuste pendiente, observación…"/></label>
     {changed&&<label className="cap-reason-field">Motivo obligatorio de reprogramación<select value={reprogramReason} onChange={e=>setReprogramReason(e.target.value)} required><option value="">Seleccionar motivo…</option>{['Lluvia / mal tiempo','Demora de materiales','Solicitud del cliente','Falta de personal','Cambio de prioridad','Traslado de equipo','Reasignación de equipo','Otro'].map(v=><option key={v} value={v}>{v}</option>)}</select><small>Cambiar de día, equipo o enviar al backlog suma una reprogramación.</small></label>}
    </div>
    <div className="cap-block-cover-panel"><div className="cap-intro"><div><h3>Cobertura de esta TP</h3><p>Horas-persona que pueden cubrir los operarios asignados, sin contar dos veces a una misma persona en el día.</p></div><strong className={preview.coverage<100?'cap-red':''}>{preview.coverage}%</strong></div><div className="cap-day-bar"><i className={preview.coverage<100?'over':''} style={{width:`${Math.min(100,preview.coverage)}%`}}/></div><div className="cap-cover-split"><span><b>{hours(preview.covered)} h</b> cubiertas</span><span><b>{hours(preview.missing)} h</b> sin cubrir</span><span><b>{hours(dayHours)} h</b> por persona en ese día</span></div>
     {!draft.date&&<p className="cap-hint">Elegí una fecha para calcular la cobertura de operarios.</p>}
     {draft.date&&preview.missing>0&&<p className="cap-hint"><AlertTriangle size={15}/> Faltan {hours(preview.missing)} horas-persona de esta TP. Podés incorporar auxiliares, asignar más operarios disponibles o mover trabajo a otro día.</p>}
    </div>
    {task.date&&<section className="cap-pending-panel" aria-label="Desprender horas teóricas pendientes">
      <div className="cap-pending-intro"><div><b>Horas teóricas pendientes</b><p>Las horas sin cobertura son trabajo sin suficiente personal asignado. Podés desprenderlas como otra TP sin marcar el trabajo original como realizado.</p></div><strong className={preview.missing>0?'cap-red':''}>{hours(preview.missing)} h</strong></div>
      {!splitOpen?<button type="button" className="cap-btn" onClick={()=>{setPendingHours(preview.missing>0?String(preview.missing):'');setSplitOpen(true);setError('');}}><Plus size={15}/> Desprender TP pendiente</button>:<div className="cap-pending-form">
        <div className="cap-pending-fields"><label>Horas-persona para nueva TP<input type="number" min="0.1" step="0.1" max={Number(draft.personHours)} value={pendingHours} onChange={e=>setPendingHours(e.target.value)}/></label>
        <label>Motivo del trabajo pendiente<select value={pendingReason} onChange={e=>setPendingReason(e.target.value)}><option value="">Seleccionar motivo…</option>{PENDING_REASONS.map(reason=><option key={reason} value={reason}>{reason}</option>)}</select></label>
        <label className="cap-pending-notes">Detalle (obligatorio para «Otros»)<input type="text" maxLength="350" placeholder="Ej.: obra no habilitada para continuar" value={pendingNote} onChange={e=>setPendingNote(e.target.value)}/></label></div>
        <p className="cap-pending-impact">La TP original conservará <b>{hours(Math.max(0,Number(task.personHours)-Number(pendingHours||0)))} h-persona</b>, su fecha y su equipo. La nueva TP tendrá <b>{hours(Number(pendingHours||0))} h-persona</b> y quedará en el backlog sin fecha.</p>
        <div className="cap-pending-actions"><button type="button" className="cap-btn" onClick={()=>{setSplitOpen(false);setError('');}}>Cancelar</button><button type="button" className="cap-btn primary" onClick={pendingSplit} disabled={!pendingReason||!(Number(pendingHours)>0&&Number(pendingHours)<Number(task.personHours))}><Plus size={15}/> Confirmar nueva TP pendiente</button></div>
      </div>}
    </section>}
    <fieldset className="cap-task-workers"><legend>Operarios de esta TP ({draft.workers?.length||0})</legend><small>Por defecto usa los integrantes disponibles del equipo. Podés liberar personas y reservar horas parciales para este trabajo.</small><div className="cap-worker-grid">{available.map(person=>{const selected=draft.workers?.includes(person.id)||false;const used=preview.workers?.find(x=>x.id===person.id)?.hours||0;const defaultHours=draft.workerHours?.[person.id]??dayHours;return <label key={person.id} className="cap-worker-item"><span className="cap-worker-name"><input type="checkbox" checked={selected} onChange={e=>updatePerson(person.id,e.target.checked)}/><b>{person.name}</b>{person.kind==='auxiliar'&&<em>Auxiliar</em>}</span>{selected&&<span className="cap-worker-hours">Reserva <input aria-label={`Horas reservadas para ${person.name}`} type="number" min="0" max={dayHours} step="0.5" value={defaultHours} onChange={e=>setDraft(s=>({...s,workerHours:{...(s.workerHours||{}),[person.id]:Number(e.target.value)}}))}/>h <small>· aplicadas {hours(used)} h</small></span>}</label>})}</div>
     {!available.length&&<p className="cap-hint">No hay operarios disponibles ese día para el equipo.</p>}
     <button className="cap-btn small" type="button" onClick={()=>setDraft(s=>({...s,workers:available.map(p=>p.id),workerHours:{}}))}><Users size={14}/> Asignar todos los disponibles</button>
    </fieldset>
    {draft.date&&<div className="cap-extra-worker"><label>Incorporar auxiliar de Producción<select value={auxToAdd} onChange={e=>setAuxToAdd(e.target.value)}><option value="">Seleccionar auxiliar…</option>{auxiliaries.map(m=><option value={m.id} key={m.id}>{m.name}</option>)}</select></label><button type="button" className="cap-btn" disabled={!auxToAdd} onClick={()=>{setStagedAux(s=>[...s,auxToAdd]);updatePerson(auxToAdd,true);setAuxToAdd('');}}><Plus size={14}/> Sumar a la TP</button><small>El auxiliar suma capacidad al equipo solamente en esa fecha. La solicitud se guarda al confirmar.</small></div>}
    <ProjectEffort task={{...draft,personHours:Number(draft.personHours)}} blocks={store.blocks.map(b=>b.id===task.id?{...draft,personHours:Number(draft.personHours)}:b)} estimates={data.estimates}/>
    {(task.splitHistory||[]).length>0&&<div className="cap-split-history"><b>TP pendientes desprendidas ({task.splitHistory.length})</b>{task.splitHistory.map((entry,i)=><p key={entry.childId||i}>{hours(entry.pendingHours)} h-persona → TP {entry.childId} · {entry.reason}{entry.note?` · ${entry.note}`:''}</p>)}</div>}
    {(task.reprogramHistory||[]).length>0&&<div className="cap-reprogram-history"><b><History size={14}/> Historial de reprogramaciones ({task.reprogramHistory.length})</b>{task.reprogramHistory.map((r,i)=><p key={i}>{fmtDate(r.fromDate)} → {fmtDate(r.toDate)} · {r.reason}</p>)}</div>}
    {error&&<p className="cap-form-error" role="alert">{error}</p>}
    <div className="cap-modal-actions cap-wrap"><button type="button" className="cap-btn" onClick={close}>Cancelar</button><button type="button" className="cap-btn" onClick={()=>{setDraft(s=>({...s,date:''}));setStagedAux([]);setAuxToAdd('');}}><Undo2 size={14}/> Al backlog</button><button type="button" className="cap-btn" onClick={()=>{setDraft(s=>({...s,date:''}));setStagedAux([]);setReprogramReason('Lluvia / mal tiempo');}}><CloudRain size={14}/> Suspender por lluvia</button><button type="button" className="cap-btn primary" onClick={()=>save(false)}><Check size={15}/> Guardar TP</button></div>
    {draft.date===today()&&<div className="cap-task-execution"><button type="button" className="cap-btn" onClick={confirmComplete}>Confirmar realizada</button><label>Si fue parcial, horas-persona ejecutadas<input type="number" min="0.1" step="0.5" max={Number(draft.personHours)} value={doneHours} onChange={e=>setDoneHours(e.target.value)}/></label>{doneHours&&<><label>Motivo de las horas que quedan pendientes<select value={pendingReason} onChange={e=>setPendingReason(e.target.value)}><option value="">Seleccionar motivo…</option>{PENDING_REASONS.map(reason=><option key={reason} value={reason}>{reason}</option>)}</select></label>{pendingReason==='Otros'&&<label>Detalle del motivo<input value={pendingNote} onChange={e=>setPendingNote(e.target.value)} placeholder="Describir motivo"/></label>}</>}<button type="button" className="cap-btn" disabled={!doneHours} onClick={partial}>Registrar parcial y crear TP pendiente</button></div>}
   </>}
  </section>
 </div>;
}

function ExtraForm({store,setStore,data}){
 const [form,setForm]=useState({projectId:'',teamId:store.teams[0]?.id||'',date:'',personHours:6,crew:2,title:'Ajuste final'});
 const choices=data.projects.filter(p=>!isPickupProject(p)&&data.estimates.some(e=>String(e.projectId)===String(p.id)&&!isOutsourced(e)));
 const submit=e=>{e.preventDefault();if(!form.projectId||!form.teamId||Number(form.personHours)<=0)return;
  if(form.date&&(form.date<today()||!canScheduleOn(form.date,form.projectId,data.week,data.holidays,data.recesses,store.specialDays||[],form.teamId))){window.alert('Elegí una fecha laboral futura o dejala vacía para backlog.');return;}
  const assigned=store.assignments.find(a=>String(a.projectId)===String(form.projectId));
  const assignmentId=assigned?.id||`A-extra-${Date.now()}`;
  const workers=form.date?defaultWorkerIds(form.teamId,form.date,store.members,store.absences,store.supportShifts||[]):[];
  const block={id:newBlockId(),assignmentId,projectId:form.projectId,teamId:form.teamId,date:form.date,personHours:Number(form.personHours),crew:Number(form.crew),title:form.title||'Tarea extra',status:form.date?'planificado':'backlog',workers,workerHours:{},reason:'Tarea adicional',reprogramHistory:[],origin:'extra'};
  setStore(s=>({...s,assignments:assigned?s.assignments:[...s.assignments,{id:assignmentId,projectId:form.projectId,teamId:form.teamId,start:form.date||today(),crew:Number(form.crew),manual:true}],blocks:[...s.blocks,block]}));
  setForm(s=>({...s,date:'',title:'Ajuste final'}));
 };
 return <form className="cap-extra-form cap-panel" onSubmit={submit}><div className="cap-intro"><div><h2>Crear TP adicional</h2><p>Actividades nuevas fuera de la estimación. Las horas incumplidas se desprenden desde una TP original.</p></div></div><div className="cap-task-edit-grid"><label>Obra<select required value={form.projectId} onChange={e=>setForm(s=>({...s,projectId:e.target.value}))}><option value="">Seleccionar obra…</option>{choices.map(p=><option key={p.id} value={p.id}>{p.numero} · {p.proyecto}</option>)}</select></label><label>Tarea<input required value={form.title} onChange={e=>setForm(s=>({...s,title:e.target.value}))}/></label><label>Equipo<select value={form.teamId} onChange={e=>setForm(s=>({...s,teamId:e.target.value}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Día (opcional, para backlog)<input type="date" min={today()} value={form.date} onChange={e=>setForm(s=>({...s,date:e.target.value}))}/></label><label>Horas-persona<input type="number" min="0.1" step="0.5" required value={form.personHours} onChange={e=>setForm(s=>({...s,personHours:e.target.value}))}/></label><label>Personas previstas<input type="number" min="1" max="40" required value={form.crew} onChange={e=>setForm(s=>({...s,crew:e.target.value}))}/></label></div><button className="cap-btn primary" type="submit"><Plus size={15}/> Crear TP</button></form>;
}

export default function GanttTasks({model,sourceData,store,setStore,selectedTeam,changeTeam,setTab,setMonth,rangeMode,setRangeMode,period}){
 const [selectedDate,setSelectedDate]=useState(today());
 const [selectedTask,setSelectedTask]=useState(null);
 const [dragged,setDragged]=useState(null);
 const [saturday,setSaturday]=useState(null);
 const viewing=period||model;
 const visibleDates=viewing.dates;
 const assignments=useMemo(()=>store.assignments.filter(a=>{
  const project=sourceData.projects.find(p=>String(p.id)===String(a.projectId));
  return project&&!isPickupProject(project)&&visible(a,sourceData.estimates)&&(selectedTeam==='ALL'||store.blocks.some(b=>b.assignmentId===a.id&&b.teamId===selectedTeam));
 }),[store.assignments,store.blocks,selectedTeam,sourceData.projects,sourceData.estimates]);
 const activeTasks=store.blocks.filter(b=>b.status!=='backlog'&&b.date);
 const backlog=store.blocks.filter(b=>b.status==='backlog'&&visible(b,sourceData.estimates));
 const shownTeams=selectedTeam==='ALL'?viewing.teamDays:viewing.teamDays.filter(t=>t.id===selectedTeam);
 const stats=useMemo(()=>reprogramStats(store.blocks.filter(b=>sourceData.projects.some(p=>String(p.id)===String(b.projectId)&&!isPickupProject(p)))),[store.blocks,sourceData.projects]);
 const coverageConfig={blocks:store.blocks,members:store.members,absences:store.absences,supportShifts:store.supportShifts||[],specialDays:store.specialDays||[],week:sourceData.week,holidays:sourceData.holidays,recesses:sourceData.recesses,projects:sourceData.projects,estimates:sourceData.estimates};
 const dayCoverage=useMemo(()=>dailyBlockCoverage({...coverageConfig,date:selectedDate}),[selectedDate,store,sourceData]);
 const allDatesCoverage=useMemo(()=>Object.fromEntries(visibleDates.filter(date=>store.blocks.some(b=>b.date===date)).map(date=>[date,dailyBlockCoverage({...coverageConfig,date})])),[visibleDates,store,sourceData]);
 const monthCoverage=useMemo(()=>{const coverage=Object.values(allDatesCoverage).flatMap(d=>Object.values(d));return {planned:coverage.reduce((s,d)=>s+d.need,0),covered:coverage.reduce((s,d)=>s+d.covered,0),missing:coverage.reduce((s,d)=>s+d.missing,0)};},[allDatesCoverage]);
 const close=()=>setSelectedTask(null);
 const open=(id,proposalDate)=>setSelectedTask({id,proposalDate});
 const taskForEdit=selectedTask&&store.blocks.find(b=>b.id===selectedTask.id);
 const move=(taskId,date)=>{
  const task=store.blocks.find(b=>b.id===taskId);
  if(!task||!canEditBlock(task)||task.status==='realizado'||date<today())return;
  if(!canScheduleOn(date,task.projectId,sourceData.week,sourceData.holidays,sourceData.recesses,store.specialDays||[],task.teamId)){
    if(weekday(date)===6){setSaturday({date,teamId:task.teamId,pendingTaskId:taskId});return;}
    window.alert('Fecha bloqueada o no laboral.');return;
  }
  open(taskId,date); // Es una PROPUESTA: no se guarda hasta que indique motivo en el modal.
 };
 const dayRows=shownTeams.map(t=>({team:t,day:t.dates.find(d=>d.date===selectedDate),people:activePeople(t.id,selectedDate,store.members,store.absences,store.supportShifts||[]),coverage:Object.entries(dayCoverage).filter(([id])=>store.blocks.some(b=>b.id===id&&b.teamId===t.id)).reduce((sum,[,v])=>({covered:sum.covered+v.covered,missing:sum.missing+v.missing}),{covered:0,missing:0})}));
 const monthRows=shownTeams.map(t=>{const allocated=Object.values(allDatesCoverage).flatMap(day=>Object.entries(day).filter(([id])=>store.blocks.some(b=>b.id===id&&b.teamId===t.id)).map(([,v])=>v));return {team:t,covered:allocated.reduce((sum,v)=>sum+v.covered,0),missing:allocated.reduce((sum,v)=>sum+v.missing,0)};});
 useEffect(()=>{if(visibleDates.length&&!visibleDates.includes(selectedDate))setSelectedDate(visibleDates[0]);},[visibleDates,selectedDate]);
 const startSaturday=(date,teamId,pendingTaskId='')=>{if(date<today())return;setSelectedDate(date);setSaturday({date,teamId:teamId||shownTeams[0]?.id||'',pendingTaskId});};
 return <>
  <div className="cap-intro"><div><h2>Gantt de colocación · TP por equipo</h2><p>Doble clic para editar fecha, equipo, personas y motivo. También podés arrastrar una TP; el cambio se confirma en el modal. Pasado bloqueado.</p></div><div className="cap-filter"><label htmlFor="gantt-filter">Equipo</label><select id="gantt-filter" value={selectedTeam} onChange={e=>changeTeam(e.target.value)}><option value="ALL">Todos los equipos</option>{model.teamDays.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
  <div className="cap-period-head"><RangeButtons value={rangeMode} onChange={setRangeMode}/><small>{visibleDates.length?`${fmtDate(visibleDates[0])} al ${fmtDate(visibleDates.at(-1))}`:''}</small></div>
  <div className="cap-task-kpis"><div><small>TP totales</small><b>{stats.total}</b></div><div><small>TP derivadas</small><b>{stats.pending}</b><small>{hours(stats.pendingHours)} h-persona</small></div><div><small>TP adicionales</small><b>{stats.additional}</b></div><div><small>Reprogramaciones</small><b>{stats.reprograms}</b></div><div><small>TP reprogramadas</small><b>{stats.reprogrammed}</b></div><div><small>Backlog</small><b>{stats.backlog}</b></div><div><small>Cobertura del período</small><b>{monthCoverage.planned?`${Math.round(monthCoverage.covered/monthCoverage.planned*100)}%`:'—'}</b><small>{hours(monthCoverage.missing)} h-persona por cubrir en el período</small></div></div>
  <div className="cap-gantt-wrap"><table className="cap-gantt-table"><thead><tr><th className="cap-gantt-sticky cap-project-col">Obra / equipo</th>{visibleDates.map(iso=><th key={iso} className={`${[0,6].includes(weekday(iso))?'weekend':''} ${iso===today()?'today':''} ${selectedDate===iso?'chosen':''} ${weekday(iso)===6&&(store.specialDays||[]).some(x=>x.date===iso&&x.enabled!==false)?'sat-open':''}`}><button className="cap-day-button" aria-label={`Ver ocupación ${fmtDate(iso)}`} onClick={()=>{setSelectedDate(iso);if(weekday(iso)===6&&iso>=today())startSaturday(iso,selectedTeam==='ALL'?shownTeams[0]?.id:selectedTeam);}}><span>{MON_SHORT[weekday(iso)]}</span><b>{Number(iso.slice(-2))}</b></button></th>)}</tr></thead><tbody>
    {assignments.map(a=>{const project=sourceData.projects.find(p=>String(p.id)===String(a.projectId));return <tr key={a.id}><th className="cap-gantt-sticky"><div className="cap-gantt-title" title={project?.proyecto}><strong>{project?.numero}</strong><span>{project?.proyecto}</span><small>{store.teams.find(t=>t.id===a.teamId)?.name} · {store.blocks.filter(b=>b.assignmentId===a.id).length} TP</small></div></th>{visibleDates.map(date=>{
       const tasks=activeTasks.filter(b=>b.assignmentId===a.id&&b.date===date&&(selectedTeam==='ALL'||b.teamId===selectedTeam));
       const weekend=[0,6].includes(weekday(date));
       return <td key={date} className={`${weekend?'weekend':''} ${date===today()?'today':''} ${date===selectedDate?'chosen':''}`} onDragOver={e=>{if(date>=today())e.preventDefault();}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain')||dragged;if(id)move(id,date);}}>
          <div className="cap-day-slot">{tasks.map(b=>{const t=store.teams.find(t=>t.id===b.teamId);const c=allDatesCoverage[date]?.[b.id];return <button key={b.id} type="button" draggable={canEditBlock(b)&&b.status!=='realizado'} onDragStart={e=>{e.dataTransfer.setData('text/plain',b.id);e.dataTransfer.effectAllowed='move';setDragged(b.id);}} onDragEnd={()=>setDragged(null)} className={`cap-block-task ${b.status==='realizado'?'done':''} ${b.status==='sin_confirmar'?'unverified':''}`} style={{'--task-color':teamColor(t,store.teams.indexOf(t))}} title={`${b.origin==='pendiente'?'TP pendiente':b.origin==='extra'?'TP adicional':'TP'} · ${b.title}: ${hours(b.personHours)} h-persona · equipo ${t?.name} · cobertura ${c?.coverage??0}% · ${taskStatus(b)}`} onClick={()=>{open(b.id);setSelectedDate(date);}} onDoubleClick={()=>{open(b.id);setSelectedDate(date);}}><span>{b.status==='realizado'?'✓':b.status==='sin_confirmar'?'?':<Grip size={10}/>}</span><b>{hours(b.personHours)}h</b><small>{b.status==='realizado'?'Hecho':`${c?.coverage??0}%`}</small></button>})}
           {!tasks.length&&date>=today()&&weekday(date)!==0&&<button type="button" className={`cap-empty-day ${weekend?'cap-saturday-empty':''}`} title={weekday(date)===6?'Habilitar sábado para este equipo':`Ver ocupación del ${fmtDate(date)}`} onClick={()=>weekday(date)===6?startSaturday(date,a.teamId):setSelectedDate(date)}>{weekday(date)===6?'＋ Sáb': '·'}</button>}
          </div>
       </td>;
    })}</tr>;})}
    <tr className="cap-gantt-total"><th className="cap-gantt-sticky"><strong>Ocupación diaria</strong><small>{selectedTeam==='ALL'?'Todos los equipos':viewing.teamDays.find(t=>t.id===selectedTeam)?.name}</small></th>{visibleDates.map(date=>{const group=shownTeams.map(t=>t.dates.find(d=>d.date===date));const load=group.reduce((a,d)=>a+(d?.load||0),0),cap=group.reduce((a,d)=>a+(d?.capacity||0),0);const p=percent(load,cap);return <td key={date} className={date===selectedDate?'chosen':''}><button type="button" className={`cap-daily-heat ${p>100?'over':p>0?'used':''}`} onClick={()=>setSelectedDate(date)}>{cap?`${p}%`:load?'∞':'·'}</button></td>})}</tr>
  </tbody></table>{!assignments.length&&<div className="cap-empty">No hay tareas con colocación en el filtro seleccionado. <button onClick={()=>setTab('assignments')}>Asignar obra</button></div>}</div>
  <div className="cap-gantt-legend">{store.teams.map((t,i)=><span key={t.id}><i className="cap-swatch" style={{background:teamColor(t,i)}}/> {t.name}</span>)}<span>✓ Realizada · ? Pasada sin confirmar</span><span>Doble clic o toque para editar · arrastrar para proponer nueva fecha · tocá un sábado para habilitarlo</span></div>
  <section className="cap-panel cap-daily-detail"><div className="cap-intro"><div><h2>Ocupación por equipo · {fmtDate(selectedDate)}</h2><p>Ocupación = horas programadas ÷ capacidad disponible. Cobertura = horas respaldadas por operarios asignados ÷ horas de la TP.</p></div><label>Elegir fecha<input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);if(e.target.value.slice(0,7)!==model.month)setMonth(e.target.value.slice(0,7));}}/></label></div>
   <div className="cap-daily-cards">{dayRows.map(({team,day,people,coverage})=><div className="cap-daily-card" key={team.id} style={{borderTop:`4px solid ${teamColor(team,viewing.teamDays.indexOf(team))}`}}><strong>{team.name}</strong><div className="cap-daily-figures"><b className={(day?.load||0)>(day?.capacity||0)?'cap-red':''}>{percent(day?.load||0,day?.capacity||0)}%</b><span>{hours(day?.load||0)} h programadas / {hours(day?.capacity||0)} h disponibles</span></div><small>{people.length} personas: {people.map(p=>p.name+(p.kind==='auxiliar'?' (aux.)':'')).join(', ')||'Ninguna disponible'}</small><div className="cap-day-bar"><i style={{width:`${Math.min(100,percent(day?.load||0,day?.capacity||0))}%`}} className={(day?.load||0)>(day?.capacity||0)?'over':''}/></div><div className="cap-coverage-foot">{hours(coverage.covered)} h cubiertas · <b className={coverage.missing?'cap-red':''}>{hours(coverage.missing)} h sin cubrir</b></div></div>)}</div>
   <p className="cap-muted">Una misma persona no suma más de su jornada pura diaria aunque esté asignada a varias TP. El cálculo es una simulación de capacidad, no confirma productividad real.</p>
  </section>
  <section className="cap-panel cap-monthly-team-detail"><div className="cap-intro"><div><h2>Ocupación por equipo · {fmtDate(visibleDates[0])} a {fmtDate(visibleDates.at(-1))}</h2><p>Compromisos del período contra horas disponibles, sin recortar al 100%. El saldo por cubrir estima necesidad de redistribuir personal.</p></div></div><div className="cap-month-teams">{monthRows.map(({team,covered,missing})=><div className="cap-month-team" key={team.id} style={{borderLeft:`4px solid ${teamColor(team,viewing.teamDays.indexOf(team))}`}}><b>{team.name}</b><strong className={team.load>team.capacity?'cap-red':''}>{percent(team.load,team.capacity)}% <small>ocupación</small></strong><p>{hours(team.load)} h programadas / {hours(team.capacity)} h disponibles</p><p>{hours(covered)} h con personal asignado · <b>{hours(missing)} h por cubrir</b></p></div>)}</div></section>
  <section className="cap-panel cap-reprogram-table"><div className="cap-intro"><div><h2>Registro de TP y reprogramaciones</h2><p>Conteos acumulados del escenario local; cada cambio de día o equipo registra un motivo.</p></div></div><div className="cap-table-scroll"><table><thead><tr><th>Obra</th><th>TP</th><th>TP derivadas</th><th>TP adicionales</th><th>Reprogramaciones</th><th>Backlog</th><th>Realizadas</th></tr></thead><tbody>{stats.byProject.map(p=>{const project=sourceData.projects.find(x=>String(x.id)===p.projectId);return <tr key={p.projectId}><td><b>{project?.numero||p.projectId}</b> · {project?.proyecto||'Obra'}</td><td>{p.cubitos}</td><td>{p.pending} ({hours(p.pendingHours)} h)</td><td>{p.additional}</td><td>{p.reprograms}</td><td>{p.backlog}</td><td>{p.done}</td></tr>})}</tbody></table></div></section>
  <section className="cap-panel cap-backlog"><div className="cap-intro"><div><h2>Backlog · trabajos pendientes</h2><p>TP pendientes desprendidas, suspendidas o sin fecha.</p></div><span className="cap-count">{backlog.length} tareas</span></div><div className="cap-backlog-list">{backlog.map(b=>{const project=sourceData.projects.find(p=>String(p.id)===String(b.projectId));return <div className="cap-backlog-item" key={b.id}><span><b>{project?.numero}</b> · {b.title||'Colocación'} <em className="cap-task-type">{b.origin==='pendiente'?'TP pendiente':b.origin==='extra'?'TP adicional':'TP'}</em><small>{hours(b.personHours)} h-persona · {b.reason||'Sin motivo informado'}</small></span><button className="cap-btn" onClick={()=>open(b.id)}>Programar <CalendarClock size={14}/></button></div>})}{!backlog.length&&<p className="cap-muted">No hay TP pendientes.</p>}</div></section>
  <ExtraForm store={store} setStore={setStore} data={sourceData}/>
  {saturday&&<SaturdayEditor details={saturday} store={store} setStore={setStore} data={sourceData} close={()=>setSaturday(null)} confirmMove={(taskId,date)=>open(taskId,date)}/>}
  {taskForEdit&&<TaskEditor key={`${taskForEdit.id}-${selectedTask.proposalDate||''}`} task={taskForEdit} proposedDate={selectedTask.proposalDate} store={store} setStore={setStore} data={sourceData} close={close}/>}
 </>;
}
