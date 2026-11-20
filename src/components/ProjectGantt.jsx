import React,{useEffect,useMemo,useState} from 'react';
import {ArrowLeft,CalendarDays,CheckCircle2,ChevronDown,ChevronLeft,ChevronRight,ChevronUp,Eye,EyeOff,FolderKanban,Link2,Plus,Printer,Save,Trash2, X} from 'lucide-react';
import {WEEK} from '../lib/domain.js';
import {addDays,dateISO,shiftMonth} from '../lib/planner.js';
import {progressOverview,TASK_STATUSES,validateTaskDates} from '../lib/projectTimeline.js';
import {teamColor} from '../lib/taskPlanning.js';
import {ganttDates,datesBetween,PROJECT_RANGE_OPTIONS} from '../lib/ganttRange.js';
import {buildProjectSchedule,addTaskIncident,deferTaskDays,undoSkippedDay,removeFutureIncident,validateDependency,taskDuration,groupBySector,sectorSpan,summarizeProjectSchedule,firstProjectActivityDate,isHoliday,isWorkDate,localWeekday,INCIDENT_REASONS} from '../lib/projectSchedule.js';
import RangeButtons from './RangeButtons.jsx';
import {searchProjects} from '../lib/projectSearch.js';
import SaturdayEditor from './SaturdayEditor.jsx';
import {projectActivityRows} from '../lib/projectActivity.js';
import './projectGantt.css';

const fmt=d=>d?String(d).split('-').reverse().join('/'):'—';
const fmtInterval=(start,end)=>start&&end?`${fmt(start)} — ${fmt(end)}`:'Sin fechas programadas';
const weekday=d=>['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'][localWeekday(d)];
const uid=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const formBase=(teamId='',start=dateISO(new Date()),sectorId='')=>({id:'',sectorId,name:'',teamId,start,durationDays:'1',dependsOn:'',progress:0,status:'pendiente',notes:'',incidents:[]});
function IncidentModal({task,date,onClose,onSave,onMove,onDelete,today}){
 const existing=task.incidents.find(i=>i.date===date);
 const [reason,setReason]=useState(existing?.reason||'clima');
 const [note,setNote]=useState(existing?.note||'');
 const [published,setPublished]=useState(existing?.published===true);
 const [target,setTarget]=useState(addDays(date,1));
 const [message,setMessage]=useState('');
 return <div className="pj-modal-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
  <section className="pj-modal" role="dialog" aria-modal="true" aria-labelledby="pj-incident-title">
   <div className="pj-panel-heading"><div><h2 id="pj-incident-title">Mover jornada o registrar incidencia · {fmt(date)}</h2><p>{task.name} · {task.durationDays} jornadas. Si solo estás ajustando el plan, podés moverla sin motivo.</p></div><button className="pj-icon" type="button" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>
   {existing?<div className="pj-existing-incident"><b>Incidencia registrada</b><p>{INCIDENT_REASONS.find(x=>x[0]===existing.reason)?.[1]||existing.reason}</p>{existing.note&&<p>{existing.note}</p>}</div>:<form onSubmit={e=>{e.preventDefault();try{onSave({date,reason,note,published});}catch(err){setMessage(err.message);}}} className="pj-incident-form">
     <label>Motivo<select value={reason} onChange={e=>setReason(e.target.value)}>{INCIDENT_REASONS.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
     <label>Observación (opcional)<textarea maxLength="500" rows="3" value={note} onChange={e=>setNote(e.target.value)} placeholder="Qué pasó en la obra, detalle del clima, materiales..."/></label>
     <label className="pj-inline-check"><input type="checkbox" checked={published} onChange={e=>setPublished(e.target.checked)}/> Mostrar el motivo y esta observación en el portal del cliente</label>
     {message&&<p className="pj-error" role="alert">{message}</p>}
     <label>Trasladar jornadas restantes desde esta fecha hasta<input type="date" min={addDays(date,1)} value={target} onChange={e=>setTarget(e.target.value)}/></label><div className="pj-dialog-actions"><button type="button" className="pj-btn" onClick={onClose}>Cancelar</button><button type="button" className="pj-btn" onClick={()=>{try{onMove(date,target);}catch(err){setMessage(err.message);}}}>Mover jornada sin registrar motivo</button><button className="pj-btn primary" type="submit">Registrar incidencia</button></div>
    </form>}
   {existing&&<div className="pj-dialog-actions"><button className="pj-btn" onClick={onClose}>Cerrar</button>{date>=today&&<button className="pj-btn danger" onClick={()=>onDelete(date)}>Quitar incidencia futura</button>}</div>}
  </section>
 </div>;
}
export default function ProjectGantt({data,go=()=>{},editable=true,doc,setDoc=()=>{},capacityData,setCapacityData=()=>{},fixedProjectId='',embeddedClient=false}){
 const [projectId,setProjectId]=useState(fixedProjectId);
 const [projectQuery,setProjectQuery]=useState('');
 const [projectSearchOpen,setProjectSearchOpen]=useState(false);
 const [projectSearchIndex,setProjectSearchIndex]=useState(0);
 const [month,setMonth]=useState(dateISO(new Date()).slice(0,7));
 const [rangeMode,setRangeMode]=useState('full');
 const [clientView,setClientView]=useState(false);
 const [saturday,setSaturday]=useState(null);
 const [incident,setIncident]=useState(null);
 const [collapsed,setCollapsed]=useState({});
 const [newSector,setNewSector]=useState('');
 const [renameSector,setRenameSector]=useState(null);
 const [form,setForm]=useState(()=>formBase());
 const [editing,setEditing]=useState(false);
 const [error,setError]=useState('');
 const [notice,setNotice]=useState('');
 const [recordChange,setRecordChange]=useState(false);
 const [changeReason,setChangeReason]=useState('');
 const [changeNote,setChangeNote]=useState('');
 const today=dateISO(new Date());
 const readOnly=embeddedClient||clientView||!editable;
 useEffect(()=>{if(embeddedClient)setProjectId(String(fixedProjectId||''));},[embeddedClient,fixedProjectId]);
 useEffect(()=>{document.body.classList.toggle('pj-client-mode',clientView);return()=>document.body.classList.remove('pj-client-mode');},[clientView]);
 useEffect(()=>{const close=e=>{if(!e.target.closest('.pj-project-search'))setProjectSearchOpen(false);};document.addEventListener('pointerdown',close);return()=>document.removeEventListener('pointerdown',close);},[]);
 const teams=capacityData.teams||[];
 const calendar=useMemo(()=>({specialDays:capacityData.specialDays||[],week:data.week?.length?data.week:WEEK,holidays:data.holidays||[],recesses:data.recesses||[]}),[capacityData.specialDays,data.week,data.holidays,data.recesses]);
 const project=data.projects.find(p=>String(p.id)===String(projectId));
 const projectMatches=useMemo(()=>searchProjects(data.projects,projectQuery,12),[data.projects,projectQuery]);
 const tasks=doc.tasks.filter(t=>String(t.projectId)===String(projectId));
 const sectors=doc.sectors.filter(s=>String(s.projectId)===String(projectId));
 const computed=useMemo(()=>{try{return {tasks:buildProjectSchedule(tasks,calendar,projectId),error:''};}catch(err){return {tasks:[],error:err.message};}},[doc.tasks,calendar,projectId]);
 const scheduled=computed.tasks;
 const byId=new Map(scheduled.map(t=>[String(t.id),t]));
 const groups=groupBySector(scheduled,sectors);
 const period=summarizeProjectSchedule(scheduled);
 const overall=progressOverview(tasks);
 const activityRows=projectActivityRows(scheduled,{clientOnly:readOnly});
 // «Ver desde inicio» comienza en la primera actividad del Gantt, nunca en la fecha del Excel.
 // Las incidencias grises también cuentan: registran la fecha originalmente prevista.
 const projectBegin=firstProjectActivityDate(scheduled);
 const projectEnd=period.end||'';
 const days=useMemo(()=>['start','full'].includes(rangeMode)&&!projectBegin?[]:ganttDates(rangeMode,{month,today,start:projectBegin,end:projectEnd}),[rangeMode,month,today,projectBegin,projectEnd]);
 const colorFor=tid=>teamColor(teams.find(t=>t.id===tid)||{},Math.max(0,teams.findIndex(t=>t.id===tid)));
 const setF=(key,value)=>setForm(f=>({...f,[key]:value}));
 const reset=()=>{setForm(formBase(teams[0]?.id||'',today));setEditing(false);setError('');setRecordChange(false);setChangeReason('');setChangeNote('');};
 const chooseProject=id=>{
  setProjectId(id);setProjectQuery('');setProjectSearchOpen(false);setProjectSearchIndex(0);setError('');setNotice('');setEditing(false);setIncident(null);
  // Al elegir una obra, situar el mes en su primera tarea, no en Inicio del catálogo.
  const selectedTasks=doc.tasks.filter(t=>String(t.projectId)===String(id));
  let first='';
  try{first=firstProjectActivityDate(buildProjectSchedule(selectedTasks,calendar,id));}
  catch{first=selectedTasks.map(t=>t.start).filter(Boolean).sort()[0]||'';}
  setMonth((first||today).slice(0,7));setRangeMode('full');setForm(formBase(teams[0]?.id||'',today));
 };
 const edit=t=>{
  if(readOnly)return;
  setEditing(true);setError('');setNotice('');
  setForm({...t,durationDays:String(taskDuration(t,calendar,projectId)),sectorId:t.sectorId||'',dependsOn:t.dependsOn||''});
  setRecordChange(false);setChangeReason('');setChangeNote('');
  document.querySelector('.pj-edit-panel')?.scrollIntoView({behavior:'smooth',block:'start'});
 };
 const save=e=>{
  e.preventDefault();if(readOnly)return;setNotice('');setError('');
  const old=editing?tasks.find(t=>t.id===form.id):null;
  const id=old?.id||uid('TAREA');
  const next={...form,id,projectId,name:String(form.name).trim(),durationDays:Number(form.durationDays),
   sectorId:form.sectorId||'',dependsOn:form.dependsOn||'',progress:form.status==='finalizada'?100:Number(form.progress),
   incidents:old?.incidents||[],updatedAt:new Date().toISOString(),createdAt:old?.createdAt||new Date().toISOString(),end:old?.end||form.start};
  try{
   if(!Number.isInteger(next.durationDays)||next.durationDays<1||next.durationDays>260)throw Error('Indicá entre 1 y 260 jornadas laborables.');
   if(!teams.some(t=>t.id===next.teamId))throw Error('Seleccioná un equipo responsable.');
   const moved=old&&(old.start!==next.start||old.teamId!==next.teamId||old.durationDays!==next.durationDays);
   if(moved&&recordChange&&!changeReason)throw Error('Seleccioná un motivo para registrar la reprogramación, o desactivá el registro.');
   if(moved&&recordChange)next.reprogramHistory=[...(old.reprogramHistory||[]),{
    at:new Date().toISOString(),from:old.start,to:next.start,teamBefore:old.teamId,teamAfter:next.teamId,
    reason:changeReason,note:changeNote.trim().slice(0,500),published:true
   }];
   const other=tasks.filter(t=>t.id!==id);
   validateDependency([...other,next],id,next.dependsOn);
   if(old?.start<today&&(Number(old.durationDays||taskDuration(old,calendar,projectId))!==next.durationDays||old.dependsOn!==next.dependsOn))throw Error('No se cambia la duración ni el bloqueante de tareas históricas.');
   const draft=[...other,next];
   const resolved=buildProjectSchedule(draft,calendar,projectId);
   const effective=resolved.find(t=>t.id===id);
   validateTaskDates(old,{...next,end:old?.start<today?old.end:effective.end},today);
   setDoc(d=>({...d,tasks:[...d.tasks.filter(t=>t.id!==id),{...next,end:old?.start<today?old.end:effective.end}]}));
   setMonth(effective.start.slice(0,7));setNotice(old?'Tarea actualizada; el cronograma se recalculó.':'Tarea agregada; se generó un cuadrado por jornada.');reset();
  }catch(err){setError(err.message);}
 };
 const remove=t=>{
  if(readOnly)return;
  if(t.start<today){setError('No se elimina una tarea histórica.');return;}
  if(tasks.some(x=>String(x.dependsOn)===String(t.id))){setError('Esta tarea bloquea otra. Primero cambiá la dependencia.');return;}
  if(window.confirm(`¿Eliminar la tarea «${t.name}»?`)){
   setDoc(d=>({...d,tasks:d.tasks.filter(x=>x.id!==t.id)}));if(form.id===t.id)reset();
  }
 };
 const createSector=e=>{
  e.preventDefault();const name=newSector.trim();if(!name||readOnly)return;
  if(sectors.some(s=>s.name.toLowerCase()===name.toLowerCase())){setError('Ya existe ese sector.');return;}
  const id=uid('SECTOR');setDoc(d=>({...d,sectors:[...d.sectors,{id,projectId,name,createdAt:new Date().toISOString()}]}));
  setCollapsed(x=>({...x,[id]:false}));setNewSector('');setF('sectorId',id);setNotice(`Sector «${name}» creado.`);setError('');
 };
 const updateSector=e=>{
  e.preventDefault();const name=String(renameSector?.name||'').trim();if(!name)return;
  if(sectors.some(s=>s.id!==renameSector.id&&s.name.toLowerCase()===name.toLowerCase())){setError('Ese nombre de sector ya existe.');return;}
  setDoc(d=>({...d,sectors:d.sectors.map(s=>s.id===renameSector.id?{...s,name}:s)}));setRenameSector(null);setError('');
 };
 const deleteSector=s=>{
  if(tasks.some(t=>t.sectorId===s.id)){setError('Para quitar un sector, mové primero sus tareas a «Sin sector».');return;}
  if(window.confirm(`¿Eliminar el sector «${s.name}»?`))setDoc(d=>({...d,sectors:d.sectors.filter(x=>x.id!==s.id)}));
 };
 const registerIncident=({date,reason,note,published})=>{
  const next=addTaskIncident(tasks,incident.taskId,{date,reason,note,published},calendar,projectId,today);
  setDoc(d=>({...d,tasks:d.tasks.map(t=>next.find(n=>n.id===t.id)||t)}));
  setIncident(null);setNotice('Incidencia registrada. Los cuadrados pendientes y sus dependientes fueron desplazados.');setError('');
 };
 const moveWithoutIncident=(date,target)=>{
  try{const next=deferTaskDays(tasks,incident.taskId,date,target,calendar,projectId,today);
   setDoc(d=>({...d,tasks:d.tasks.map(t=>next.find(n=>n.id===t.id)||t)}));
   setIncident(null);setNotice('Jornada desplazada sin registrar una reprogramación.');setError('');
  }catch(err){setError(err.message);}
 };
 const restoreUnrecorded=(taskId,date)=>{
  try{const next=undoSkippedDay(tasks,taskId,date,calendar,projectId,today);
   setDoc(d=>({...d,tasks:d.tasks.map(t=>next.find(n=>n.id===t.id)||t)}));setNotice('Ajuste de planificación revertido.');setError('');
  }catch(err){setError(err.message);}
 };
 const removeIncident=date=>{
  try{const next=removeFutureIncident(tasks,incident.taskId,date,today);buildProjectSchedule(next,calendar,projectId);
   setDoc(d=>({...d,tasks:d.tasks.map(t=>next.find(n=>n.id===t.id)||t)}));setIncident(null);setNotice('Incidencia futura retirada y Gantt recalculado.');
  }catch(err){setError(err.message);}
 };
 const writeCapacity=updater=>setCapacityData(updater);
 const weekendExtra=(day,teamId)=>!readOnly&&day>=today&&localWeekday(day)===6&&!isHoliday(day,calendar,projectId)&&!isWorkDate(day,teamId,projectId,calendar);
 const occupiedSaturdays=scheduled.flatMap(t=>t.days.filter(d=>localWeekday(d)===6).map(date=>({id:`pj-${t.id}-${date}`,date,teamId:t.teamId,status:'planificado'})));
 const renderCalendarDays=(item,kind)=>days.map(day=>{
  const selected=kind==='task'&&item.days.includes(day);
  const event=kind==='task'&&item.incidents.find(i=>i.date===day);
  const span=kind!=='task'&&Boolean(item.activeDays?.includes(day));
  const sunday=localWeekday(day)===0;
  const saturday=localWeekday(day)===6;
  const blocked=isHoliday(day,calendar,projectId);
  const extra=kind==='task'&&weekendExtra(day,item.teamId)&&day>=item.requestedStart&&day<=item.end;
  const incidentTitle=event?`${INCIDENT_REASONS.find(([r])=>r===event.reason)?.[1]||event.reason}${event.note?': '+event.note:''}`:'';
  return <td key={day} className={['pj-day-cell',(saturday||sunday)?'pj-weekend':'',blocked?'pj-holiday':'',selected?'pj-day-active':'',event?'pj-day-incident':''].filter(Boolean).join(' ')}>
    {event?<button type="button" className="pj-incident-day" title={incidentTitle} disabled={readOnly} onClick={()=>setIncident({taskId:item.id,date:day})}>×</button>
     :selected?<div className={'pj-day-square'+(item.blocked?' pj-projection':'')} style={{background:colorFor(item.teamId)}} title={`${item.name} · ${weekday(day)} ${fmt(day)}${item.blocked?' · depende de '+item.dependsOnName:''}`}>
       {!readOnly&&day>=today?<button type="button" className="pj-day-menu" aria-label={`Registrar incidencia de ${item.name} el ${fmt(day)}`} title="Registrar incidencia / reprogramación" onClick={()=>setIncident({taskId:item.id,date:day})}>⋯</button>:<span className="pj-dot">•</span>}
      </div>
     :extra?<button className="pj-sat-inline" type="button" title={`Agregar sábado extra a ${item.name}`} aria-label={`Habilitar sábado ${fmt(day)} para ${item.name}`} onClick={()=>setSaturday({date:day,teamId:item.teamId,projectId})}>＋</button>
     :span?<div className={`pj-span-square ${kind}`} title={kind==='project'?'Obra completa':'Sector: '+item.name}/>:null}
   </td>;
 });
 const taskRow=t=><tr key={t.id} className="pj-task-row pj-hierarchy-task"><th scope="row" className="pj-sticky"><div className="pj-task-ident"><button type="button" disabled={readOnly} onClick={()=>edit(t)} title={readOnly?t.name:'Editar tarea'}><b>{t.name}</b><small style={{color:colorFor(t.teamId)}}>● {teams.find(x=>x.id===t.teamId)?.name||'Equipo no disponible'} · {t.durationDays} {t.durationDays===1?'día':'días'} · {t.progress}%</small></button>{t.dependsOn&&<span className="pj-blocked-tag" title={`Comienza después de «${t.dependsOnName}»`}><Link2 size={12}/> {t.dependsOnName||'Bloqueada'}</span>}</div></th>{renderCalendarDays(t,'task')}</tr>;
 const sectorRow=s=>{
  const limits=sectorSpan(s.tasks),span={...limits,activeDays:datesBetween(limits.start,limits.end)},isCollapsed=Boolean(collapsed[s.id]);
  return <React.Fragment key={s.id}><tr className="pj-sector-row"><th scope="row" className="pj-sticky"><div className="pj-sector-ident"><button type="button" className="pj-collapse" aria-expanded={!isCollapsed} aria-label={`${isCollapsed?'Expandir':'Contraer'} ${s.name}`} onClick={()=>setCollapsed(c=>({...c,[s.id]:!c[s.id]}))}>{isCollapsed?<ChevronRight size={16}/>:<ChevronDown size={16}/>}</button><div><strong>{s.name}</strong><small>{s.tasks.length} tareas · {fmtInterval(span.start,span.end)}</small></div>{!readOnly&&<button type="button" className="pj-sector-rename" title={`Renombrar sector ${s.name}`} onClick={()=>setRenameSector({id:s.id,name:s.name})}>Editar</button>}</div></th>{renderCalendarDays(span,'sector')}</tr>{!isCollapsed&&s.tasks.map(taskRow)}</React.Fragment>;
 };
 const generalBounds=sectorSpan(groups.general),generalSpan={...generalBounds,activeDays:datesBetween(generalBounds.start,generalBounds.end)};
 const incidentTask=incident?byId.get(String(incident.taskId)):null;
 return <div className="pj-root">
  <div className="pj-header"><div><span className="pj-eyebrow">ABALUM · SEGUIMIENTO DE OBRAS</span><h1>Gantt por proyecto</h1><p>Proyecto → Sectores → Tareas. Un cuadrado por jornada. Un equipo puede realizar varias tareas simultáneas, con dependencias opcionales.</p></div><div className="pj-header-actions">{!readOnly&&<button className="pj-btn" onClick={()=>go('planning')}><ArrowLeft size={16}/> Ocupación mensual</button>}<button className="pj-btn" onClick={()=>window.print()}><Printer size={16}/> Imprimir</button>{editable&&!embeddedClient&&<button className={'pj-btn '+(clientView?'primary':'')} disabled={!project&&!clientView} onClick={()=>{setClientView(v=>!v);reset();}}>{clientView?<EyeOff size={16}/>:<Eye size={16}/>} {clientView?'Salir de vista cliente':'Vista cliente'}</button>}</div></div>
  {!readOnly&&<div className="pj-hint">Este Gantt es de <b>seguimiento por proyecto</b>: admite tareas paralelas del mismo equipo, y no reserva horas en Ocupación mensual. Las tareas se recalculan automáticamente cuando se habilita un sábado o se registra una incidencia; el avance ejecutado se informa aparte. Las modificaciones se guardan en Apps Script en segundo plano cuando la conexión está activa.</div>}
  <section className="pj-panel pj-project-filter">
   {!clientView&&!embeddedClient&&<div className="pj-project-search">
    <label htmlFor="pj-project-query">Buscar proyecto por número, nombre o cliente</label>
    <div className="pj-project-search-control">
     <input id="pj-project-query" type="search" role="combobox" autoComplete="off"
      aria-autocomplete="list" aria-expanded={projectSearchOpen} aria-controls="pj-project-options"
      aria-activedescendant={projectSearchOpen&&projectMatches[projectSearchIndex]?`pj-option-${projectMatches[projectSearchIndex].id}`:undefined}
      value={projectQuery} placeholder="Ej.: PR-261011, Shopping, cliente…"
      onFocus={()=>{setProjectSearchOpen(true);setProjectSearchIndex(0);}}
      onChange={e=>{setProjectQuery(e.target.value);setProjectSearchOpen(true);setProjectSearchIndex(0);}}
      onKeyDown={e=>{
       if(e.key==='Escape'){setProjectSearchOpen(false);return;}
       if(!projectSearchOpen&&(e.key==='ArrowDown'||e.key==='Enter')){setProjectSearchOpen(true);e.preventDefault();return;}
       if(e.key==='ArrowDown'){e.preventDefault();setProjectSearchIndex(i=>Math.min(i+1,projectMatches.length-1));}
       if(e.key==='ArrowUp'){e.preventDefault();setProjectSearchIndex(i=>Math.max(0,i-1));}
       if(e.key==='Enter'&&projectMatches.length){e.preventDefault();chooseProject(projectMatches[Math.min(projectSearchIndex,projectMatches.length-1)].id);}
      }}/>
     {projectSearchOpen&&<div className="pj-search-results" id="pj-project-options" role="listbox" aria-label="Proyectos encontrados">
      {projectMatches.length?projectMatches.map((p,i)=><button key={p.id} id={`pj-option-${p.id}`} type="button" role="option" aria-selected={i===projectSearchIndex} className={i===projectSearchIndex?'active':''} onMouseDown={e=>e.preventDefault()} onClick={()=>chooseProject(p.id)}>
       <strong>{p.numero||'Sin número'} · {p.proyecto}</strong><small>{p.cliente||'Cliente sin indicar'} · {p.estado||'Sin estado'}</small>
      </button>):<p className="pj-no-results">No se encontraron proyectos.</p>}
     </div>}
    </div>
    <small className="pj-search-foot">{data.projects.length} proyectos disponibles · se muestran hasta 12 coincidencias</small>
   </div>}
   <div className="pj-project-current">{project?<><small>{project.cliente||'Cliente no indicado'}</small><b>{project.numero} · {project.proyecto}</b></>:<span>Sin obra seleccionada</span>}</div>
  </section>
  {!project?<section className="pj-panel pj-empty"><FolderKanban size={28}/><h2>Elegí una obra para planificar sus sectores y tareas</h2><p>El Excel se utiliza únicamente para identificar la obra y consultar su estado. Este Gantt se guarda por separado.</p></section>:<>
   <div className="pj-metrics"><div><small>Inicio de obra completa</small><strong>{fmt(projectBegin)}</strong></div><div><small>Fin previsto de obra</small><strong>{fmt(projectEnd)}</strong></div><div><small>Tareas / incidencias</small><strong>{period.tasks} / {period.incidents}</strong></div><div><small>Avance declarado</small><strong>{overall.percent}%</strong><div className="pj-progress"><i style={{width:`${overall.percent}%`}}/></div></div></div>
   {computed.error&&<p className="pj-error" role="alert">No se puede proyectar el Gantt: {computed.error}. Revisá las dependencias.</p>}
   {!readOnly&&<>
    <section className="pj-panel pj-sector-create"><div><h2>1. Crear sectores de la obra</h2><p>Ej.: Planta baja, Frente norte, Sector 1. Las tareas generales, como ruteo de Aluco, no necesitan sector.</p></div><form onSubmit={createSector}><input aria-label="Nombre del sector" maxLength="75" value={newSector} onChange={e=>setNewSector(e.target.value)} placeholder="Nombre del sector…"/><button className="pj-btn" type="submit"><Plus size={15}/> Crear sector</button></form></section>
    <section className="pj-panel pj-edit-panel"><div className="pj-panel-heading"><div><h2>2. {editing?'Editar tarea':'Crear tarea'}</h2><p>Ingresá jornadas (días), equipo y fecha mínima. Si hay un bloqueante, la tarea comenzará después de que termine su programación.</p></div>{editing&&<button type="button" className="pj-icon" onClick={reset} aria-label="Cancelar edición"><X size={18}/></button>}</div>
     <form className="pj-form" onSubmit={save}>
      <label>Sector<select value={form.sectorId||''} onChange={e=>setF('sectorId',e.target.value)}><option value="">Sin sector · tarea general</option>{sectors.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Nombre de tarea<input required maxLength="110" placeholder="Ej.: Colocar vidrios, ruteo de Aluco" value={form.name} onChange={e=>setF('name',e.target.value)}/></label>
      <label>Equipo responsable<select required value={form.teamId} disabled={editing&&form.start<today} onChange={e=>setF('teamId',e.target.value)}><option value="">Seleccionar equipo…</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Jornadas necesarias (días)<input required type="number" min="1" max="260" step="1" value={form.durationDays} disabled={editing&&form.start<today} onChange={e=>setF('durationDays',e.target.value)}/></label>
      <label>Fecha mínima de inicio<input required type="date" value={form.start} disabled={editing&&form.start<today} onChange={e=>setF('start',e.target.value)}/></label>
      <label>Tarea bloqueante<select value={form.dependsOn||''} disabled={editing&&form.start<today} onChange={e=>setF('dependsOn',e.target.value)}><option value="">Sin bloqueante · puede comenzar en paralelo</option>{tasks.filter(t=>t.id!==form.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Estado<select value={form.status} onChange={e=>{const s=e.target.value;setForm(f=>({...f,status:s,progress:s==='finalizada'?100:f.progress}));}}>{TASK_STATUSES.map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></label>
      <label>Avance: <b>{form.status==='finalizada'?100:Number(form.progress)||0}%</b><input type="range" min="0" max="100" step="5" disabled={form.status==='finalizada'} value={form.status==='finalizada'?100:form.progress} onChange={e=>setF('progress',Number(e.target.value))}/></label>
      {editing&&<div className="pj-wide pj-optional-history"><label className="pj-inline-check"><input type="checkbox" checked={recordChange} onChange={e=>setRecordChange(e.target.checked)}/> Registrar este cambio como reprogramación (opcional)</label>{recordChange&&<div className="pj-optional-fields"><label>Motivo<select value={changeReason} onChange={e=>setChangeReason(e.target.value)}><option value="">Seleccionar motivo…</option>{INCIDENT_REASONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></label><label>Detalle para el cliente<textarea maxLength="500" rows="2" value={changeNote} onChange={e=>setChangeNote(e.target.value)}/></label></div>}</div>}
      <label className="pj-wide">Observaciones<textarea maxLength="1000" rows="2" value={form.notes||''} onChange={e=>setF('notes',e.target.value)} placeholder="Materiales, avances, condiciones de la obra…"/></label>
      <div className="pj-form-footer"><span>Los días de descanso y feriados no generan cuadrados. Los sábados se habilitan solo por equipo y fecha.</span><button className="pj-btn primary" type="submit" disabled={!teams.length}><Save size={16}/> {editing?'Guardar tarea':'Agregar tarea'}</button></div>
     </form>
    </section>
   </>}
   <section className="pj-panel"><div className="pj-panel-heading"><div><h2>3. Gantt de obra completa</h2><p>Primero la obra, luego sectores desplegables y debajo sus tareas; las tareas generales van fuera de sectores.</p></div><div className="pj-month-controls"><button type="button" aria-label="Mes anterior" onClick={()=>{setMonth(shiftMonth(month,-1));setRangeMode('month');}}><ChevronLeft size={18}/></button><input type="month" aria-label="Mes del Gantt" value={month} onChange={e=>{setMonth(e.target.value);setRangeMode('month');}}/><button type="button" aria-label="Mes siguiente" onClick={()=>{setMonth(shiftMonth(month,1));setRangeMode('month');}}><ChevronRight size={18}/></button></div></div>
    <div className="pj-range-wrap"><RangeButtons value={rangeMode} onChange={setRangeMode} options={PROJECT_RANGE_OPTIONS}/><small>{days.length?`${fmt(days[0])} al ${fmt(days.at(-1))}`:['start','full'].includes(rangeMode)?'Sin tareas programadas':''}</small></div>
    <div className="pj-gantt-legend"><span><i className="pj-key-line"/> Período de sector / obra</span><span><i className="pj-key-team"/> Jornada de equipo</span><span><i className="pj-key-incident"/> Incidencia</span><span><i className="pj-key-none"/> Día no laborable</span></div>
    <div className="pj-calendar-scroll"><table className="pj-gantt-table pj-hierarchical-table"><thead><tr><th className="pj-sticky">Proyecto / sector / tarea</th>{days.map(day=><th key={day} className={[localWeekday(day)===0||localWeekday(day)===6?'pj-weekend':'',isHoliday(day,calendar,projectId)?'pj-holiday':''].join(' ')}><small>{weekday(day)}</small>{Number(day.slice(-2))}{localWeekday(day)===6&&!readOnly&&day>=today&&!isHoliday(day,calendar,projectId)&&<button type="button" className="pj-head-plus" title={`Habilitar sábado ${fmt(day)}`} onClick={()=>setSaturday({date:day,teamId:form.teamId||teams[0]?.id||'',projectId})}>＋</button>}</th>)}</tr></thead><tbody>
       <tr className="pj-project-row"><th className="pj-sticky"><b>OBRA COMPLETA</b><small>{fmtInterval(projectBegin,projectEnd)} · {project.proyecto}</small></th>{renderCalendarDays({start:projectBegin,end:projectEnd,activeDays:datesBetween(projectBegin,projectEnd)},'project')}</tr>
       {groups.sectors.map(sectorRow)}
       {!!groups.general.length&&<><tr className="pj-sector-row pj-general-row"><th className="pj-sticky"><strong>Tareas generales · sin sector</strong><small>{groups.general.length} tareas · {fmtInterval(generalSpan.start,generalSpan.end)}</small></th>{renderCalendarDays(generalSpan,'sector')}</tr>{groups.general.map(taskRow)}</>}
      </tbody></table></div>
    {!scheduled.length&&<p className="pj-no-tasks">Creá un sector y sus tareas, o agregá directamente una tarea general.</p>}
    <p className="pj-calendar-foot">Usá «⋯» sobre un cuadrado para moverlo libremente o, si necesitás dejar constancia, registrar lluvia u otro motivo. La jornada queda gris y se desplazan las tareas futuras dependientes. El signo «＋» habilita un sábado extra y puede adelantar las fechas.</p>
   </section>
   <section className="pj-panel pj-activity-panel"><div className="pj-panel-heading"><div><h2>Registro de novedades y reprogramaciones</h2><p>Se muestran incidencias y reprogramaciones registradas expresamente. Los movimientos de planificación sin motivo no generan un evento.</p></div></div>
    <div className="pj-activity-scroll"><table className="pj-activity-table"><thead><tr><th>Fecha</th><th>Tarea</th><th>Tipo</th><th>Detalle</th></tr></thead><tbody>{activityRows.map((row,index)=><tr key={`${row.taskId}-${row.date}-${index}`}><td>{fmt(row.date)}</td><td>{row.taskName}</td><td>{row.type}</td><td>{row.detail}</td></tr>)}{!activityRows.length&&<tr><td colSpan="4" className="pj-activity-empty">Aún no hay novedades registradas en esta obra.</td></tr>}</tbody></table></div>
   </section>
   <section className="pj-panel"><div className="pj-panel-heading"><div><h2>Detalle y evolución de tareas</h2><p>El avance se declara manualmente: estar programada no significa que esté realizada.</p></div></div><div className="pj-task-list">{scheduled.map(t=><article className="pj-task-card" key={t.id}><div className="pj-task-head"><div><span className="pj-stage-tag">{sectors.find(s=>s.id===t.sectorId)?.name||'Tarea general'}</span><h3>{t.name}</h3><p>{fmtInterval(t.start,t.end)} · {t.durationDays} jornadas · {teams.find(x=>x.id===t.teamId)?.name||'Equipo no disponible'}</p>{t.dependsOn&&<p className="pj-dependency-line">Bloqueante: {t.dependsOnName} {t.blocked?'(pendiente de confirmar finalización)':'(finalizado)'}</p>}</div><span className={'pj-status '+t.status}>{TASK_STATUSES.find(([key])=>key===t.status)?.[1]||t.status}</span></div><div className="pj-task-progress"><div><span>Avance informado</span><b>{t.progress}%</b></div><div className="pj-progress"><i style={{width:`${t.progress}%`,background:colorFor(t.teamId)}}/></div></div>{t.incidents.length>0&&<p className="pj-task-notes">{t.incidents.length} incidencia(s): {t.incidents.map(i=>`${fmt(i.date)} · ${INCIDENT_REASONS.find(([v])=>v===i.reason)?.[1]||i.reason}`).join(' | ')}</p>}{t.notes&&!readOnly&&<p className="pj-task-notes">{t.notes}</p>}{!readOnly&&(t.skippedDays||[]).length>0&&<div className="pj-unlogged-moves"><small>Desplazamientos de planificación (sin motivo):</small>{t.skippedDays.map(date=><button key={date} type="button" className="pj-btn" disabled={date<today} onClick={()=>restoreUnrecorded(t.id,date)}>Deshacer {fmt(date)}</button>)}</div>}{!readOnly&&<div className="pj-task-actions"><button className="pj-btn" onClick={()=>edit(t)}>Editar tarea / avance</button><button className="pj-btn danger" disabled={t.start<today} onClick={()=>remove(t)}><Trash2 size={14}/> Eliminar</button></div>}</article>)}</div></section>
   {renameSector&&!readOnly&&<div className="pj-modal-scrim" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setRenameSector(null);}}><section className="pj-modal" role="dialog" aria-modal="true" aria-label="Renombrar sector"><div className="pj-panel-heading"><h2>Editar sector</h2><button className="pj-icon" type="button" onClick={()=>setRenameSector(null)} aria-label="Cerrar"><X size={18}/></button></div><form className="pj-incident-form" onSubmit={updateSector}><label>Nombre<input maxLength="75" required value={renameSector.name} onChange={e=>setRenameSector(s=>({...s,name:e.target.value}))}/></label><div className="pj-dialog-actions"><button className="pj-btn danger" type="button" onClick={()=>{const s=sectors.find(x=>x.id===renameSector.id);setRenameSector(null);if(s)deleteSector(s);}}>Eliminar sector vacío</button><button className="pj-btn primary" type="submit">Guardar</button></div></form></section></div>}
   {incident&&incidentTask&&!readOnly&&<IncidentModal key={`${incident.taskId}-${incident.date}`} task={incidentTask} date={incident.date} today={today} onClose={()=>setIncident(null)} onSave={registerIncident} onMove={moveWithoutIncident} onDelete={removeIncident}/>}
   {saturday&&!readOnly&&<SaturdayEditor details={saturday} store={{...capacityData,teams,blocks:[...(capacityData.blocks||[]),...occupiedSaturdays],specialDays:capacityData.specialDays||[]}} setStore={writeCapacity} data={data} close={()=>setSaturday(null)}/>}
   {(error||notice)&&<div className={error?'pj-error pj-floating-message':'pj-success pj-floating-message'} role={error?'alert':'status'}>{error||notice}<button type="button" aria-label="Cerrar mensaje" onClick={()=>{setError('');setNotice('');}}><X size={15}/></button></div>}
   {readOnly&&<p className="pj-client-foot">Vista de seguimiento · ABALUM · Las fechas son previstas y el avance se confirma manualmente.</p>}
  </>}
 </div>;
}
