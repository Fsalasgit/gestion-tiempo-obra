import React,{useEffect,useMemo,useState} from 'react';
import {CalendarClock,Check,CloudRain,Grip,Plus,Undo2,X} from 'lucide-react';
import {activePeople,dateISO,hours,isOutsourced,percent,shiftMonth} from '../lib/planner.js';
import {canEditBlock,canScheduleOn,isPast,isPickupProject,moveBlock,newBlockId,splitPartial,taskStatus} from '../lib/workBlocks.js';
const MON_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const weekday=iso=>new Date(`${iso}T12:00:00`).getDay();
const today=()=>dateISO(new Date());
const fmtDate=s=>s?s.split('-').reverse().join('/'):'Backlog';
const isVisible=(a,estimates)=>!isOutsourced(estimates.find(e=>String(e.projectId)===String(a.projectId)));

function TaskEditor({task,store,setStore,data,close}){
 const [draft,setDraft]=useState(task);
 const [doneHours,setDoneHours]=useState('');
 useEffect(()=>{setDraft(task);setDoneHours('');},[task]);
 const past=isPast(task.date);
 const locked=past||task.status==='realizado';
 const people=activePeople(draft.teamId,draft.date||today(),store.members,store.absences,store.supportShifts||[]);
 const team=store.teams.find(x=>x.id===task.teamId);
 const project=data.projects.find(x=>String(x.id)===String(task.projectId));
 const update=()=>{
  if(locked)return;
  if(draft.date && draft.date<today()){window.alert('No se pueden editar fechas pasadas.');return;}
  if(!canScheduleOn(draft.date,draft.projectId,data.week,data.holidays,data.recesses)){window.alert('Ese día está bloqueado o no es laboral.');return;}
  if(!(Number(draft.personHours)>0)){window.alert('Ingresá horas-persona mayores a cero.');return;}
  const next=moveBlock({...draft,personHours:Number(draft.personHours),crew:Number(draft.crew)||1},draft.date);
  setStore(s=>({...s,blocks:s.blocks.map(x=>x.id===task.id?next:x)}));close();
 };
 const sendBacklog=reason=>{if(locked)return;setStore(s=>({...s,blocks:s.blocks.map(x=>x.id===task.id?{...moveBlock(x,''),reason}:x)}));close();};
 const complete=()=>{if(locked||draft.date!==today()){window.alert('Solo se puede completar una tarea del día actual.');return;}
  if(!draft.workers?.length){window.alert('Seleccioná quiénes trabajaron para conservar el registro.');return;}
  const names=store.members.filter(m=>draft.workers.includes(m.id)).map(m=>m.name);
  setStore(s=>({...s,blocks:s.blocks.map(x=>x.id===task.id?{...draft,status:'realizado',workerNames:names,completedAt:new Date().toISOString()}:x)}));close();
 };
 const partial=()=>{if(locked||draft.date!==today())return;
  if(!draft.workers?.length){window.alert('Seleccioná qué operarios participaron.');return;}
  try{const {completed,remaining}=splitPartial({...draft,workers:[...draft.workers]},Number(doneHours));
   const names=store.members.filter(m=>draft.workers.includes(m.id)).map(m=>m.name);
   setStore(s=>({...s,blocks:[...s.blocks.map(x=>x.id===task.id?{...completed,workerNames:names}:x),remaining]}));close();
  }catch(e){window.alert(e.message);}
 };
 return <section className="cap-panel cap-task-inspector" aria-label="Detalle del bloque" aria-live="polite">
   <div className="cap-intro"><div><h2>{locked?'Registro de tarea':'Editar cubito · tarea'}</h2><p>{project?.numero} · {project?.proyecto} · {taskStatus(task)}</p></div><button className="cap-icon-button" type="button" onClick={close} aria-label="Cerrar detalle"><X size={17}/></button></div>
   <div className="cap-task-info"><span>Equipo: <b>{team?.name||'Sin equipo'}</b></span><span>Fecha: <b>{fmtDate(task.date)}</b></span><span>Esfuerzo: <b>{hours(task.personHours)} h-persona</b></span></div>
   {locked?<div className="cap-task-history"><strong>{past?'Fecha pasada · solo lectura':'Tarea completada · solo lectura'}</strong><p>{task.status==='sin_confirmar'?'El trabajo estaba planificado, pero no hay confirmación de ejecución. No se inventan operarios ni horas realizadas.':'La tarea queda conservada como parte del historial.'}</p><p>Personal registrado: <b>{task.workerNames?.join(', ')||'Sin confirmar'}</b></p>{task.reason&&<p>Motivo: {task.reason}</p>}</div>:<div className="cap-task-edit-grid">
     <label>Nombre de la tarea<input value={draft.title||''} onChange={e=>setDraft(s=>({...s,title:e.target.value}))}/></label>
     <label>Fecha (vacío = backlog)<input type="date" min={today()} value={draft.date||''} onChange={e=>setDraft(s=>({...s,date:e.target.value}))}/></label>
     <label>Equipo<select value={draft.teamId} onChange={e=>setDraft(s=>({...s,teamId:e.target.value,workers:[]}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
     <label>Personas previstas<input type="number" min="1" max="40" value={draft.crew||2} onChange={e=>setDraft(s=>({...s,crew:Number(e.target.value)}))}/></label>
     <label>Esfuerzo del cubito (h-persona)<input type="number" min="0.1" step="0.5" value={draft.personHours} onChange={e=>setDraft(s=>({...s,personHours:e.target.value}))}/></label>
     <label>Motivo / observación<input value={draft.reason||''} onChange={e=>setDraft(s=>({...s,reason:e.target.value}))} placeholder="Lluvia, ajuste final, material pendiente…"/></label>
     <fieldset className="cap-task-workers"><legend>Operarios asociados ({draft.workers?.length||0})</legend><small>Seleccioná los participantes; cuando marques la tarea como terminada, sus nombres se conservarán.</small><div>{people.map(p=><label key={p.id}><input type="checkbox" checked={draft.workers?.includes(p.id)||false} onChange={e=>setDraft(s=>({...s,workers:e.target.checked?[...(s.workers||[]),p.id]:(s.workers||[]).filter(x=>x!==p.id)}))}/>{p.name}{p.kind==='auxiliar'?' · Aux.':''}</label>)}{!people.length&&<span className="cap-muted">No hay personal disponible para ese equipo en esa fecha.</span>}</div></fieldset>
     <div className="cap-task-actions"><button className="cap-btn primary" onClick={update}><Check size={15}/> Guardar cambios</button><button className="cap-btn" onClick={()=>sendBacklog(draft.reason||'Pendiente de reprogramación')}><Undo2 size={15}/> Enviar a backlog</button><button className="cap-btn" onClick={()=>sendBacklog('Lluvia / jornada suspendida')}><CloudRain size={15}/> Suspender por lluvia</button></div>
     {draft.date===today()&&<div className="cap-task-execution"><button type="button" className="cap-btn primary" onClick={complete}><Check size={15}/> Marcar realizada</button><label>Si se terminó solo una parte, horas-persona ejecutadas<input type="number" min="0.1" max={Number(draft.personHours)} step="0.5" value={doneHours} onChange={e=>setDoneHours(e.target.value)}/></label><button type="button" className="cap-btn" onClick={partial} disabled={!doneHours}>Registrar parcial y crear pendiente</button></div>}
   </div>}
 </section>;
}

function ExtraForm({store,setStore,data}){
 const [form,setForm]=useState({projectId:'',teamId:store.teams[0]?.id||'',date:'',personHours:3,crew:2,title:'Ajuste final'});
 const choices=data.projects.filter(p=>!isPickupProject(p)&&data.estimates.some(e=>String(e.projectId)===String(p.id)&&!isOutsourced(e)));
 const submit=e=>{e.preventDefault();if(!form.projectId||!form.teamId||Number(form.personHours)<=0)return;
  if(form.date && (form.date<today()||!canScheduleOn(form.date,form.projectId,data.week,data.holidays,data.recesses))){window.alert('Elegí una fecha laboral futura o dejala vacía para backlog.');return;}
  const assigned=store.assignments.find(a=>String(a.projectId)===String(form.projectId));
  const assignmentId=assigned?.id||`A-extra-${Date.now()}`;
  const block={id:newBlockId(),assignmentId,projectId:form.projectId,teamId:form.teamId,date:form.date,personHours:Number(form.personHours),crew:Number(form.crew),title:form.title||'Tarea extra',status:form.date?'planificado':'backlog',workers:[],reason:'Tarea adicional',origin:'extra'};
  setStore(s=>({...s,assignments:assigned?s.assignments:[...s.assignments,{id:assignmentId,projectId:form.projectId,teamId:form.teamId,start:form.date||today(),crew:Number(form.crew),manual:true}],blocks:[...s.blocks,block]}));
  setForm(s=>({...s,date:'',title:'Ajuste final'}));
 };
 return <form className="cap-extra-form cap-panel" onSubmit={submit}><div className="cap-intro"><div><h2>Crear cubito extra</h2><p>Para ajustes, pendientes o trabajos que la estimación original no contempló.</p></div></div><div className="cap-task-edit-grid"><label>Obra<select required value={form.projectId} onChange={e=>setForm(s=>({...s,projectId:e.target.value}))}><option value="">Seleccionar obra…</option>{choices.map(p=><option key={p.id} value={p.id}>{p.numero} · {p.proyecto}</option>)}</select></label><label>Tarea<input required value={form.title} onChange={e=>setForm(s=>({...s,title:e.target.value}))}/></label><label>Equipo<select value={form.teamId} onChange={e=>setForm(s=>({...s,teamId:e.target.value}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Día (opcional, para backlog)<input type="date" min={today()} value={form.date} onChange={e=>setForm(s=>({...s,date:e.target.value}))}/></label><label>Horas-persona<input type="number" min="0.1" step="0.5" required value={form.personHours} onChange={e=>setForm(s=>({...s,personHours:e.target.value}))}/></label><label>Personas previstas<input type="number" min="1" max="40" required value={form.crew} onChange={e=>setForm(s=>({...s,crew:e.target.value}))}/></label></div><button className="cap-btn primary" type="submit"><Plus size={15}/> Crear tarea</button></form>;
}

export default function GanttTasks({model,sourceData,store,setStore,selectedTeam,changeTeam,setTab,setMonth}){
 const [selectedDate,setSelectedDate]=useState(today());
 const [selectedTask,setSelectedTask]=useState(null);
 const [dragged,setDragged]=useState(null);

 const assignments=useMemo(()=>store.assignments.filter(a=>{
  const project=sourceData.projects.find(p=>String(p.id)===String(a.projectId));
  return project&&!isPickupProject(project)&&isVisible(a,sourceData.estimates)&&(selectedTeam==='ALL'||store.blocks.some(b=>b.assignmentId===a.id&&b.teamId===selectedTeam));
 }),[store.assignments,store.blocks,selectedTeam,sourceData.projects,sourceData.estimates]);
 const activeTasks=store.blocks.filter(b=>b.status!=='backlog'&&b.date);
 const backlog=store.blocks.filter(b=>b.status==='backlog'&&isVisible(b,sourceData.estimates));
 const getTask=id=>store.blocks.find(b=>b.id===id);
 const move=(taskId,date)=>{
  const task=getTask(taskId);if(!task||!canEditBlock(task)||task.status==='realizado'||date<today())return;
  if(!canScheduleOn(date,task.projectId,sourceData.week,sourceData.holidays,sourceData.recesses)){window.alert('Fecha bloqueada o sin jornada laboral.');return;}
  setStore(s=>({...s,blocks:s.blocks.map(x=>x.id===task.id?moveBlock(x,date):x)}));
 };
 const taskForEdit=selectedTask&&getTask(selectedTask);
 const shownTeams=selectedTeam==='ALL'?model.teamDays:model.teamDays.filter(t=>t.id===selectedTeam);
 const dayRows=shownTeams.map(t=>({team:t,day:t.dates.find(d=>d.date===selectedDate),people:activePeople(t.id,selectedDate,store.members,store.absences,store.supportShifts||[])}));
 useEffect(()=>{if(selectedDate.slice(0,7)!==model.month)setSelectedDate(`${model.month}-01`);},[model.month]);
 return <>
  <div className="cap-intro"><div><h2>Gantt de colocación · cubitos movibles</h2><p>Arrastrá tareas futuras a otro día o seleccionalas para reprogramar. El pasado es solo lectura; los trabajos pendientes van al backlog.</p></div><div className="cap-filter"><label htmlFor="gantt-filter">Equipo</label><select id="gantt-filter" value={selectedTeam} onChange={e=>changeTeam(e.target.value)}><option value="ALL">Todos los equipos</option>{model.teamDays.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div></div>
  <div className="cap-gantt-wrap"><table className="cap-gantt-table"><thead><tr><th className="cap-gantt-sticky cap-project-col">Obra / equipo</th>{model.dates.map(iso=><th key={iso} className={`${[0,6].includes(weekday(iso))?'weekend':''} ${iso===today()?'today':''} ${selectedDate===iso?'chosen':''}`}><button className="cap-day-button" aria-label={`Ver ocupación ${fmtDate(iso)}`} onClick={()=>setSelectedDate(iso)}><span>{MON_SHORT[weekday(iso)]}</span><b>{Number(iso.slice(-2))}</b></button></th>)}</tr></thead><tbody>
    {assignments.map(a=>{const project=sourceData.projects.find(p=>String(p.id)===String(a.projectId));return <tr key={a.id}><th className="cap-gantt-sticky"><div className="cap-gantt-title" title={project?.proyecto}><strong>{project?.numero}</strong><span>{project?.proyecto}</span><small>{store.teams.find(t=>t.id===a.teamId)?.name} · {store.blocks.filter(b=>b.assignmentId===a.id).length} cubitos</small></div></th>{model.dates.map(date=>{
       const tasks=activeTasks.filter(b=>b.assignmentId===a.id&&b.date===date&&(selectedTeam==='ALL'||b.teamId===selectedTeam));
       const weekend=[0,6].includes(weekday(date));
       return <td key={date} className={`${weekend?'weekend':''} ${date===today()?'today':''} ${date===selectedDate?'chosen':''}`} onDragOver={e=>{if(date>=today())e.preventDefault();}} onDrop={e=>{e.preventDefault();const id=e.dataTransfer.getData('text/plain')||dragged;if(id)move(id,date);}}>
          <div className="cap-day-slot">{tasks.map(b=><button key={b.id} type="button" draggable={canEditBlock(b)&&b.status!=='realizado'} onDragStart={e=>{e.dataTransfer.setData('text/plain',b.id);e.dataTransfer.effectAllowed='move';setDragged(b.id);}} onDragEnd={()=>setDragged(null)} className={`cap-block-task ${b.status==='realizado'?'done':''} ${b.status==='sin_confirmar'?'unverified':''} ${b.teamId!==a.teamId?'alt':''}`} title={`${b.title}: ${hours(b.personHours)} h-persona · ${taskStatus(b)}`} onClick={()=>{setSelectedTask(b.id);setSelectedDate(date);}}><span>{b.status==='realizado'?'✓':b.status==='sin_confirmar'?'?':<Grip size={10}/>}</span><b>{hours(b.personHours)}h</b></button>)}
           {!tasks.length&&date>=today()&&!weekend&&<button type="button" className="cap-empty-day" title={`Ver ocupación del ${fmtDate(date)} / mover selección`} onClick={()=>{setSelectedDate(date);}}>·</button>}
          </div>
       </td>;
    })}</tr>;})}
    <tr className="cap-gantt-total"><th className="cap-gantt-sticky"><strong>Ocupación diaria</strong><small>{selectedTeam==='ALL'?'Todos los equipos':model.teamDays.find(t=>t.id===selectedTeam)?.name}</small></th>{model.dates.map(date=>{const group=shownTeams.map(t=>t.dates.find(d=>d.date===date));const load=group.reduce((a,d)=>a+(d?.load||0),0),cap=group.reduce((a,d)=>a+(d?.capacity||0),0);const p=percent(load,cap);return <td key={date} className={date===selectedDate?'chosen':''}><button type="button" className={`cap-daily-heat ${p>100?'over':p>0?'used':''}`} onClick={()=>setSelectedDate(date)}>{cap?`${p}%`:load?'∞':'·'}</button></td>})}</tr>
  </tbody></table>{!assignments.length&&<div className="cap-empty">No hay tareas con colocación en el filtro seleccionado. <button onClick={()=>setTab('assignments')}>Asignar obra</button></div>}</div>
  <div className="cap-gantt-legend"><span><i className="cap-swatch blue"/> Programada</span><span><i className="cap-swatch green"/> Realizada</span><span><i className="cap-swatch gray"/> Fecha pasada sin confirmar</span><span>Arrastrar en PC · tocar tarea y cambiar fecha en celular</span></div>
  <section className="cap-panel cap-daily-detail"><div className="cap-intro"><div><h2>Ocupación por equipo · {fmtDate(selectedDate)}</h2><p>Al elegir un día, vemos la capacidad real y las horas-persona comprometidas por equipo. La sobrecarga puede superar el 100%.</p></div><label>Elegir fecha<input type="date" value={selectedDate} onChange={e=>{setSelectedDate(e.target.value);if(e.target.value.slice(0,7)!==model.month)setMonth(e.target.value.slice(0,7));}}/></label></div>
   <div className="cap-daily-cards">{dayRows.map(({team,day,people})=><div className="cap-daily-card" key={team.id}><strong>{team.name}</strong><div className="cap-daily-figures"><b className={(day?.load||0)>(day?.capacity||0)?'cap-red':''}>{percent(day?.load||0,day?.capacity||0)}%</b><span>{hours(day?.load||0)} h programadas / {hours(day?.capacity||0)} h disponibles</span></div><small>{people.length} personas: {people.map(p=>p.name+(p.kind==='auxiliar'?' (aux.)':'')).join(', ')||'Ninguna disponible'}</small><div className="cap-day-bar"><i style={{width:`${Math.min(100,percent(day?.load||0,day?.capacity||0))}%`}} className={(day?.load||0)>(day?.capacity||0)?'over':''}/></div></div>)}</div>
   <p className="cap-muted">Las fechas pasadas muestran programación histórica no necesariamente ejecución confirmada. Los registros de operarios se consultan abriendo cada cubito.</p>
  </section>
  {taskForEdit&&<TaskEditor key={taskForEdit.id} task={taskForEdit} store={store} setStore={setStore} data={sourceData} close={()=>setSelectedTask(null)}/>}
  <section className="cap-panel cap-backlog"><div className="cap-intro"><div><h2>Backlog · trabajos pendientes</h2><p>Cubitos suspendidos, no terminados o todavía sin día asignado.</p></div><span className="cap-count">{backlog.length} tareas</span></div><div className="cap-backlog-list">{backlog.map(b=>{const project=sourceData.projects.find(p=>String(p.id)===String(b.projectId));return <div className="cap-backlog-item" key={b.id}><span><b>{project?.numero}</b> · {b.title||'Colocación'}<small>{hours(b.personHours)} h-persona · {b.reason||'Sin motivo informado'}</small></span><button className="cap-btn" onClick={()=>setSelectedTask(b.id)}>Programar <CalendarClock size={14}/></button></div>})}{!backlog.length&&<p className="cap-muted">No hay cubitos pendientes en el backlog.</p>}</div></section>
  <ExtraForm store={store} setStore={setStore} data={sourceData}/>
 </>;
}
