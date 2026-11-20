import RangeButtons from './RangeButtons.jsx';
import React,{useEffect,useMemo,useState} from 'react';
import {ArrowRight,CalendarDays,Check,Clock3,Plus,RefreshCw,Timer,Trash2,UsersRound} from 'lucide-react';
import {dateISO,effort,hours,isOutsourced,percent} from '../lib/planner.js';
import {scheduleLinear,replanFutureLinear} from '../lib/linearCapacity.js';
import {isPickupProject} from '../lib/workBlocks.js';
import {teamColor} from '../lib/taskPlanning.js';

const id=()=>`AUTO-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const fmt=d=>d?d.split('-').reverse().join('/'):'—';
const startOf=(month,today)=>`${month}-01`<today?today:`${month}-01`;

export default function MonthlyAutoPlanner({store,setStore,data,month,model,rangeMode,setRangeMode,period,setTab,onGoTimes}){
 const today=dateISO(new Date());
 const [projectId,setProjectId]=useState('');const [teamId,setTeamId]=useState(store.teams[0]?.id||'');
 const [requestedCrew,setRequestedCrew]=useState('99');const [filter,setFilter]=useState('');
 const [warning,setWarning]=useState('');const [message,setMessage]=useState('');
 const eligible=useMemo(()=>data.projects.filter(p=>!isPickupProject(p)&&data.estimates.some(e=>String(e.projectId)===String(p.id)&&!isOutsourced(e))),[data.projects,data.estimates]);
 const unassigned=eligible.filter(p=>!store.assignments.some(a=>String(a.projectId)===String(p.id)));
 const selectable=unassigned.filter(p=>`${p.numero} ${p.proyecto} ${p.cliente}`.toLowerCase().includes(filter.toLowerCase())).slice(0,150);
 const selected=eligible.find(p=>String(p.id)===String(projectId));
 const estimate=data.estimates.find(e=>String(e.projectId)===String(projectId));
 const team=store.teams.find(t=>t.id===teamId);
 const proposed={id:'PREVIEW',projectId,teamId,start:startOf(month,today),crew:requestedCrew==='99'?99:Number(requestedCrew),mode:'automatic'};
 const preview=useMemo(()=>{
   if(!selected||!team)return null;
   try{return {plan:scheduleLinear({assignment:proposed,estimate,projects:data.projects,blocks:store.blocks||[],members:store.members,absences:store.absences,supportShifts:store.supportShifts||[],week:data.week,holidays:data.holidays||[],recesses:data.recesses||[],specialDays:store.specialDays||[],today}),error:''};}
   catch(error){return {plan:null,error:error.message};}
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[selected,team,estimate,month,requestedCrew,store.blocks,store.members,store.absences,store.supportShifts,data.projects,data.week,data.holidays,data.recesses,store.specialDays,today]);
 const add=e=>{
   e.preventDefault();setWarning('');setMessage('');
   if(!selected||!team){setWarning('Seleccioná obra y equipo.');return;}
   if(store.assignments.some(a=>String(a.projectId)===String(projectId))){setWarning('Esta obra ya está asignada.');return;}
   const created={...proposed,id:id(),createdAt:new Date().toISOString()};
   try{
    const result=scheduleLinear({assignment:created,estimate,projects:data.projects,blocks:store.blocks||[],members:store.members,absences:store.absences,supportShifts:store.supportShifts||[],week:data.week,holidays:data.holidays||[],recesses:data.recesses||[],specialDays:store.specialDays||[],today});
    if(result.remaining>0)throw Error('La capacidad disponible no alcanza para completar la obra dentro de los próximos dos años.');
    setStore(s=>({...s,assignments:[...s.assignments,created],blocks:[...(s.blocks||[]),...result.blocks]}));
    setMessage(`Obra asignada desde ${fmt(result.start)} hasta ${fmt(result.end)}, sin superponer días del equipo.`);
    setProjectId('');
   }catch(error){setWarning(error.message);}
 };
 const recalculate=()=>{
  setWarning('');setMessage('');
  try{
   const result=replanFutureLinear({assignments:store.assignments,blocks:store.blocks||[],projects:data.projects,estimates:data.estimates,members:store.members,absences:store.absences,supportShifts:store.supportShifts||[],week:data.week,holidays:data.holidays||[],recesses:data.recesses||[],specialDays:store.specialDays||[],today});
   setStore(s=>({...s,blocks:result.blocks}));setMessage(`Se recalcularon ${result.results.length} obras automáticas. Se conservaron todas las fechas anteriores a hoy y las TP manuales.`);
  }catch(error){setWarning(error.message);}
 };
 const remove=a=>{
   const related=(store.blocks||[]).filter(b=>b.assignmentId===a.id);
   if(related.some(b=>b.date&&b.date<today)){setWarning('Esta obra tiene historial pasado; no se puede eliminar toda la planificación.');return;}
   if(!window.confirm('¿Eliminar la asignación y sus TP futuras?'))return;
   setStore(s=>({...s,assignments:s.assignments.filter(x=>x.id!==a.id),blocks:(s.blocks||[]).filter(b=>b.assignmentId!==a.id)}));
   setMessage('Se quitó la asignación futura.');
 };
 const planned=store.assignments.map(a=>{
   const project=data.projects.find(p=>String(p.id)===String(a.projectId));
   const bs=(store.blocks||[]).filter(b=>b.assignmentId===a.id&&b.date&&b.status!=='backlog').sort((a,b)=>a.date.localeCompare(b.date));
   return {a,project,bs,first:bs[0]?.date||'',last:bs.at(-1)?.date||''};
 }).filter(x=>x.project&&!isPickupProject(x.project));
 return <div className="auto-page">
  <div className="cap-grid-two">
   <section className="cap-panel"><div className="cap-intro"><div><h2>Asignación lineal de obras</h2><p>Seleccioná la obra y el equipo. El sistema reserva el siguiente día laborable libre, sin superponer obras del mismo equipo.</p></div></div>
    <form className="cap-form" onSubmit={add}>
     <label>Buscar una obra con tiempo de colocación<input value={filter} onChange={e=>setFilter(e.target.value)} placeholder="Código, cliente o nombre…"/></label>
     <label>Proyecto<select required value={projectId} onChange={e=>setProjectId(e.target.value)}><option value="">Elegir proyecto…</option>{selectable.map(p=><option key={p.id} value={p.id}>{p.numero} · {p.proyecto.slice(0,76)}</option>)}</select></label>
     <div className="cap-form-row"><label>Equipo<select required value={teamId} onChange={e=>setTeamId(e.target.value)}><option value="">Seleccionar equipo…</option>{store.teams.map((t,i)=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
      <label>Operarios a utilizar<select value={requestedCrew} onChange={e=>setRequestedCrew(e.target.value)}><option value="99">Todos los disponibles</option>{Array.from({length:12},(_,i)=><option key={i+1} value={i+1}>Hasta {i+1}</option>)}</select></label></div>
     <div className="auto-info-row"><CalendarDays size={17}/><span>Mes elegido: <b>{month}</b> · Primera fecha posible: <b>{fmt(startOf(month,today))}</b></span></div>
     {selected&&<div className="auto-preview" aria-live="polite"><strong>Previsión de asignación</strong>{preview?.error?<p className="auto-error">{preview.error}</p>:preview?.plan&&<>
       <div className="auto-preview-metrics"><div><small>Esfuerzo</small><b>{hours(effort(estimate))} h-pers.</b></div><div><small>Primer día libre</small><b>{fmt(preview.plan.start)}</b></div><div><small>Fin estimado</small><b>{fmt(preview.plan.end)}</b></div><div><small>Días de trabajo</small><b>{preview.plan.days}</b></div></div>
       {preview.plan.monthOverflow&&<p className="auto-note">La obra continúa al mes siguiente, sin cortar las horas restantes.</p>}
       {preview.plan.remaining>0&&<p className="auto-error">Quedan {hours(preview.plan.remaining)} h sin ubicar.</p>}
      </>}</div>}
     <button className="cap-btn primary" type="submit" disabled={!preview?.plan||preview.plan.remaining>0}><Plus size={16}/> Asignar automáticamente</button>
    </form>
    {warning&&<p className="auto-error" role="alert">{warning}</p>}{message&&<p className="auto-success" role="status"><Check size={16}/>{message}</p>}
    <p className="auto-note">Regla de esta etapa: un equipo atiende <b>una obra por jornada</b>. Si el trabajo termina antes, las horas libres se muestran en el indicador, pero otra obra comienza el día siguiente. Las TP pasadas no se marcan realizadas.</p>
   </section>
   <section className="cap-panel"><div className="cap-intro"><div><h2>Ocupación del período</h2><p>Capacidad disponible y horas comprometidas para las fechas seleccionadas.</p></div><button className="cap-btn small" onClick={recalculate}><RefreshCw size={15}/> Recalcular futuro</button></div>
    <RangeButtons value={rangeMode} onChange={setRangeMode}/><p className="cap-muted">{period.dates.length?`${period.dates[0]} al ${period.dates.at(-1)}`:"Sin fechas"}</p><div className="auto-kpis"><div><small>Capacidad</small><b>{hours(period.capacity)} h</b></div><div><small>Comprometidas</small><b>{hours(period.load)} h</b></div><div><small>Ocupación</small><b>{Number.isFinite(period.occupancy)?Math.round(period.occupancy)+'%':'Sin capacidad'}</b></div></div>
    {period.teamDays.map((t,i)=>{const ratio=percent(t.load,t.capacity);return <div className="auto-team" key={t.id}><div className="auto-team-line"><b><i style={{background:teamColor(t,i)}}/>{t.name}</b><span>{hours(t.load)} / {hours(t.capacity)} h · {Number.isFinite(ratio)?ratio+'%':'∞'}</span></div><div className="auto-meter"><div style={{width:`${Math.min(100,ratio||0)}%`,background:ratio>100?'#c9233b':teamColor(t,i)}}/></div><small>{t.dates.filter(d=>d.load>0).length} jornadas ocupadas · {hours(Math.max(0,t.capacity-t.load))} h de capacidad libre en este período</small></div>})}
    <div className="auto-quick-actions"><button className="cap-btn small" onClick={()=>setTab('overview')}><ArrowRight size={15}/> Informe Gerencia</button><button className="cap-btn small" onClick={()=>setTab('gantt')}><CalendarDays size={15}/> Ver Gantt diario</button><button className="cap-btn small" onClick={onGoTimes}><Timer size={15}/> Tiempos de obra</button></div>
    <p className="auto-note">Si agregás una baja, un auxiliar o un feriado, usá «Recalcular futuro» para recolocar automáticamente las obras sin tocar el historial.</p>
   </section>
  </div>
  <section className="cap-panel"><div className="cap-intro"><div><h2>Obras asignadas</h2><p>Orden de entrada de obras y fechas resultantes. No se altera la hoja «proyecto».</p></div><span className="auto-tag">{planned.length} asignaciones</span></div>
   <div className="cap-table-scroll"><table><thead><tr><th>Proyecto</th><th>Equipo</th><th>Inicio</th><th>Fin previsto</th><th>Horas-persona</th><th>Modalidad</th><th>Acciones</th></tr></thead><tbody>{planned.map(({a,project,bs,first,last})=><tr key={a.id}><td><b>{project.numero}</b><small>{project.proyecto}</small></td><td>{store.teams.find(t=>t.id===a.teamId)?.name||'Equipo anterior'}</td><td>{fmt(first||a.start)}</td><td>{fmt(last)}</td><td>{hours(bs.reduce((s,b)=>s+Number(b.personHours||0),0))} h</td><td>{a.mode==='automatic'?<span className="auto-tag">Lineal automática</span>:<span className="auto-tag secondary">Plan manual anterior</span>}</td><td><button className="cap-btn small" onClick={()=>setTab('gantt')}>Ver TP</button> <button className="cap-icon-button" title="Eliminar planificación futura" aria-label={`Eliminar asignación de ${project.numero}`} onClick={()=>remove(a)}><Trash2 size={15}/></button></td></tr>)}</tbody></table></div>
   {!planned.length&&<div className="cap-empty">Todavía no hay obras asignadas.</div>}
  </section>
 </div>;
}
