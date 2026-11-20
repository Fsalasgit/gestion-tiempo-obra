import React,{useMemo,useState,useEffect} from 'react';
import {Activity,AlertTriangle,ArrowRight,Calendar,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Download,FileBarChart,HardHat,MapPin,Minus,Plus,Printer,RefreshCcw,Search,ShieldAlert,Timer,Truck,UserMinus,UserPlus,UsersRound,X} from 'lucide-react';
import {dateISO,shiftMonth,monthDates,firstDay,buildMonthPlan,hours,percent,isOutsourced,effort} from '../lib/planner.js';
import {WEEK} from '../lib/domain.js';
import {DEMO_SEED_ASSIGNMENTS} from '../data/scenario.js';
import '../capacity.css';
import GanttTasks from './GanttTasks.jsx';
import PeopleManager from './PeopleManager.jsx';
import MonthlyAutoPlanner from './MonthlyAutoPlanner.jsx';
import {generateBlocks,isPickupProject} from '../lib/workBlocks.js';
import {defaultWorkerIds,teamColor,monthlyBlockCoverage} from '../lib/taskPlanning.js';
import RangeButtons from './RangeButtons.jsx';
import {ganttDates,periodCapacity} from '../lib/ganttRange.js';
import {isDemo} from '../lib/demo.js';
import {demoCapacity} from '../lib/workspaceDefaults.js';
import Logistics from './Logistics.jsx';

const START=dateISO(new Date()).slice(0,7);
const dayLabel=(iso)=>{const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;};
const monthTitle=(month)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00:00`));
const MON_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const newId=(prefix)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;

function Ring({value}){
 const shown=Number.isFinite(value)?Math.round(value):999;
 const tone=value>100?'over':value>=85?'warn':'ok';
 return <div className={`cap-ring ${tone}`} style={{'--ratio':`${Math.min(shown,100)}%`}}><div><b>{Number.isFinite(value)?`${shown}%`:'∞'}</b><small>ocupación</small></div></div>;
}
function CapBar({value,capacity,compact=false}){
 const r=percent(value,capacity),w=Number.isFinite(r)?Math.max(0,Math.min(100,r)):100;
 return <div className={'cap-bar-wrap '+(compact?'compact':'')} title={`${hours(value)} h previstas / ${hours(capacity)} h disponibles`}><div className="cap-bar"><div className={r>100?'cap-bar-fill overload':r>=85?'cap-bar-fill caution':'cap-bar-fill'} style={{width:`${w}%`}}/></div><strong className={r>100?'cap-red':''}>{Number.isFinite(r)?r+'%':value>0?'Sin capacidad':'—'}</strong>{r>100&&<span className="cap-over">+{hours(value-capacity)} h</span>}</div>;
}
function Pill({children,kind='neutral'}){return <span className={'cap-pill '+kind}>{children}</span>}
function Metric({label,value,sub,icon:Icon,color='blue'}){return <div className="cap-stat"><div className="cap-stat-heading"><span>{label}</span><span className={`cap-stat-icon ${color}`}><Icon size={17}/></span></div><strong>{value}</strong><small>{sub}</small></div>}
function ExportButton({model,month}){
 const exportCSV=()=>{
  const q=s=>'"'+String(s).replaceAll('"','""')+'"';
  const values=[['Período','Equipo','Horas disponibles','Horas planificadas','Ocupación (%)','Excedente (h)'],...model.teamDays.map(t=>[month,t.name,t.capacity.toFixed(2),t.load.toFixed(2),String(percent(t.load,t.capacity)),Math.max(0,t.load-t.capacity).toFixed(2)])];
  const csv='\ufeff'+values.map(row=>row.map(q).join(';')).join('\r\n');
  const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}),url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;link.download=`capacidad-${month}.csv`;link.click();URL.revokeObjectURL(url);
 };
 return <button type="button" className="cap-btn small" onClick={exportCSV}><Download size={16}/> Exportar CSV</button>;
}
function SectionIntro({title,sub,children}){return <div className="cap-intro"><div><h2>{title}</h2><p>{sub}</p></div>{children&&<div className="cap-intro-actions">{children}</div>}</div>}
function OverView({model,sourceData,go,month,setTab,teams,config,rangeMode,setRangeMode,period}){
 const future=Array.from({length:6},(_,i)=>shiftMonth(month,i));
 const upcoming=future.map(m=>buildMonthPlan({...config,month:m}));
 const overTeams=period.teamDays.filter(t=>t.load>t.capacity);
 const capDays=period.teamDays.some(t=>t.dates.some(d=>d.capacity>0));
 return <>
  <div className="cap-period-head"><b>Ocupación del período seleccionado</b><RangeButtons value={rangeMode} onChange={setRangeMode}/><small>{period.dates.length?`${dayLabel(period.dates[0])} al ${dayLabel(period.dates.at(-1))}`:'Sin fechas'}</small></div>
  <div className="cap-overview-top"><div><div className="cap-eyebrow">TABLERO PARA GERENCIA</div><h2>¿Nos alcanza el equipo para las obras?</h2><p>Capacidad efectiva contra horas de colocación comprometidas. Los solapamientos pueden superar el 100%.</p></div><Ring value={period.occupancy}/></div>
  <div className="cap-stat-grid">
   <Metric label="Capacidad disponible" value={`${hours(period.capacity)} h`} sub="Personal activo, feriados y bajas descontados" icon={UsersRound}/>
   <Metric label="Trabajo comprometido" value={`${hours(period.load)} h`} sub="Obras asignadas en el período elegido" icon={Timer} color="violet"/>
   <Metric label="Excedente del período" value={`${hours(period.over)} h`} sub={period.over>0?'Hay más trabajo del que se puede ejecutar':'Sin exceso global en el período'} icon={AlertTriangle} color={period.over>0?'red':'green'}/>
   <Metric label="Días laborables del período" value={period.daily.filter(d=>d.date>=dateISO(new Date())&&d.capacity>0).length} sub={`Hasta fin de mes: ${model.calendarDaysRemaining} días calendario`} icon={CalendarDays} color="amber"/>
  </div>
  <div className="cap-grid-two">
   <div className="cap-panel"><SectionIntro title="Carga por equipo" sub="Los porcentajes mayores a 100% se muestran en rojo."><button className="cap-link" onClick={()=>setTab('people')}>Gestionar equipo <ArrowRight size={15}/></button></SectionIntro>
    {period.teamDays.length?period.teamDays.map(t=><div className="cap-team-load" key={t.id}><div className="cap-team-head"><div><b><i className="cap-team-color-dot" style={{background:teamColor(t,period.teamDays.indexOf(t))}}/> {t.name}</b><small>{Math.max(...t.dates.map(d=>d.people),0)} colaboradores disponibles como máximo en este período</small></div><span>{hours(t.load)} / {hours(t.capacity)} h</span></div><CapBar value={t.load} capacity={t.capacity}/></div>):<div className="cap-empty">Agregá al menos un equipo.</div>}
    <div className="cap-summary-footer"><span><span className="cap-dot teal"/> Disponible</span><span><span className="cap-dot red"/> Sobrecarga</span><span><span className="cap-dot purple"/> Tercerizado (sin carga interna)</span></div>
   </div>
   <div className="cap-panel"><SectionIntro title="Decisiones posibles" sub="Acciones para liberar capacidad y presentar alternativas."/>
     <div className="cap-decision-list">
       <button onClick={()=>setTab('people')}><span className="cap-decision-icon mint"><UserPlus size={20}/></span><span><b>Sumar colaboradores</b><small>Refuerzos con fecha de ingreso y finalización</small></span><ArrowRight size={17}/></button>
       <button onClick={()=>setTab('assignments')}><span className="cap-decision-icon violet"><Truck size={20}/></span><span><b>Tercerizar una obra</b><small>Quitar el esfuerzo de la capacidad interna</small></span><ArrowRight size={17}/></button>
       <button onClick={()=>setTab('people')}><span className="cap-decision-icon peach"><UserMinus size={20}/></span><span><b>Informar una baja</b><small>Accidentes, licencias y ausencias por período</small></span><ArrowRight size={17}/></button>
       <button onClick={()=>setTab('gantt')}><span className="cap-decision-icon sky"><Calendar size={20}/></span><span><b>Reprogramar trabajos</b><small>Mover comienzos y detectar superposiciones</small></span><ArrowRight size={17}/></button>
     </div>
   </div>
  </div>
  <div className="cap-panel cap-future"><SectionIntro title="Proyección de ocupación" sub="Mes por mes, considerando los trabajos que continúan al período siguiente."><button className="cap-link" onClick={()=>setTab('gantt')}>Ver Gantt <ArrowRight size={15}/></button></SectionIntro>
    <div className="cap-month-compare">{upcoming.map(item=><div key={item.month} className="cap-month-col"><b>{new Intl.DateTimeFormat('es-AR',{month:'short'}).format(new Date(`${item.month}-15T12:00:00`)).toUpperCase()}</b><div className="cap-month-bar-space"><div className="cap-100-line"/><div className={'cap-month-bar '+(item.occupancy>100?'over':item.occupancy>=85?'warn':'')} style={{height:`${Math.min(100,item.occupancy/1.6||0)}%`}} title={`${hours(item.load)} de ${hours(item.capacity)} h`}/></div><strong className={item.occupancy>100?'cap-red':''}>{Number.isFinite(item.occupancy)?Math.round(item.occupancy)+'%':'∞'}</strong><small>{hours(item.load)} h</small></div>)}</div>
    <div className="cap-hint"><AlertTriangle size={16}/> La planificación no asignada y las obras sin tiempo no están incluidas en la ocupación. No es una promesa de fecha de entrega.</div>
  </div>
  {(period.over>0||period.teamDays.some(t=>t.load>t.capacity))&&<div className="cap-alert"><AlertTriangle size={21}/><div><b>Atención: hay sobrecarga prevista.</b><p>{hours(period.load)} h comprometidas frente a {hours(period.capacity)} h disponibles. La solución puede combinar reprogramación, personal adicional o tercerización. Los picos diarios pueden existir aunque el total del período sea menor al 100%.</p></div></div>}
  <div className="cap-report-grid"><div className="cap-insight"><strong>{sourceData.projects.length}</strong><span>obras del Excel sin estado terminado</span></div><div className="cap-insight"><strong>{sourceData.projects.length-sourceData.projects.filter(p=>sourceData.estimates.some(e=>String(e.projectId)===String(p.id))).length}</strong><span>obras sin tiempo de colocación</span></div><div className="cap-insight"><strong>{model.unassigned}</strong><span>obras estimadas sin asignar</span></div><div className="cap-insight"><strong>{model.fullyOutsourced}</strong><span>obras tercerizadas</span></div></div>
  {(!capDays||!sourceData.estimates.length)&&<div className="cap-hint">Completá equipos y tiempos reales para transformar esta simulación en un informe de Gerencia.</div>}
 </>;
}
function Assignments({store,setStore,data,run,onGoTimes,month,setTab}){
 const [form,setForm]=useState(()=>{const teamId=store.teams[0]?.id||'',start=firstDay(month)<dateISO(new Date())?dateISO(new Date()):firstDay(month);return {projectId:'',teamId,start,crew:Math.max(1,defaultWorkerIds(teamId,start,store.members,store.absences,store.supportShifts||[]).length)};});
 const [q,setQ]=useState('');
 const estimated=data.projects.filter(p=>!isPickupProject(p)&&data.estimates.some(e=>String(e.projectId)===String(p.id)));
 const available=estimated.filter(p=>(p.numero+' '+p.proyecto+' '+p.cliente).toLowerCase().includes(q.toLowerCase())).slice(0,100);
 const add=e=>{e.preventDefault();if(!form.projectId||!form.teamId||!form.start||Number(form.crew)<1)return;
   if(form.start<dateISO(new Date())){window.alert('No se pueden crear planificaciones en fechas pasadas.');return;}
   if(store.assignments.some(a=>String(a.projectId)===String(form.projectId))){window.alert('Esta obra ya tiene una asignación. Editá la existente para evitar duplicar el esfuerzo.');return;}
   const created={...form,crew:Number(form.crew),id:newId('P')};const estimate=data.estimates.find(x=>String(x.projectId)===String(form.projectId));
   const blocks=generateBlocks(created,estimate,data.week||WEEK,data.holidays||[],data.recesses||[]).map(b=>({...b,workers:b.date>=dateISO(new Date())?defaultWorkerIds(b.teamId,b.date,store.members,store.absences,store.supportShifts||[]):[],workerHours:{}}));
   setStore(s=>({...s,assignments:[...s.assignments,created],blocks:[...s.blocks,...blocks]}));setForm(v=>({...v,projectId:''}));};
 const toggleOutsource=async(projectId)=>{
   const e=data.estimates.find(e=>String(e.projectId)===String(projectId));if(!e)return;
   await run('estimate.save',{estimate:{...e,outsourced:!isOutsourced(e)}},s=>({...s,estimates:s.estimates.map(x=>String(x.projectId)===String(projectId)?{...x,outsourced:!isOutsourced(e)}:x)}),!isOutsourced(e)?'Obra tercerizada; libera capacidad.':'Obra reincorporada al equipo interno.');
 };
 return <>
  <div className="cap-grid-two"><div className="cap-panel"><SectionIntro title="Asignar una obra al equipo" sub="Tomamos las horas-persona de su estimación y las distribuimos desde el día de inicio."/>
   <form className="cap-form" onSubmit={add}><label>Buscar obra estimada<input placeholder="Filtrar por número, obra o cliente…" value={q} onChange={e=>setQ(e.target.value)}/></label><label>Obra<select required value={form.projectId} onChange={e=>setForm(s=>({...s,projectId:e.target.value}))}><option value="">Seleccionar una obra…</option>{available.map(p=><option value={p.id} key={p.id}>{p.numero} · {p.proyecto.slice(0,60)}</option>)}</select></label><div className="cap-form-row"><label>Equipo<select required value={form.teamId} onChange={e=>setForm(s=>({...s,teamId:e.target.value,crew:Math.max(1,defaultWorkerIds(e.target.value,s.start,store.members,store.absences,store.supportShifts||[]).length)}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Personal previsto<input required min="1" max="40" type="number" value={form.crew} onChange={e=>setForm(s=>({...s,crew:e.target.value}))}/></label></div><label>Fecha de inicio de colocación<input required type="date" min={dateISO(new Date())} value={form.start} onChange={e=>setForm(s=>({...s,start:e.target.value,crew:Math.max(1,defaultWorkerIds(s.teamId,e.target.value,store.members,store.absences,store.supportShifts||[]).length)}))}/></label><button className="cap-btn primary" type="submit"><Plus size={16}/> Agregar al Gantt</button></form>
   <div className="cap-hint">Cada obra se asigna una sola vez en esta versión. No hacemos reparto parcial del esfuerzo entre varios equipos todavía.</div>
  </div><div className="cap-panel"><SectionIntro title="Estado de estimación" sub="El Excel solo relaciona obras y estados. La duración de colocación se carga por separado."/><div className="cap-estimate-large"><strong>{estimated.length} / {data.projects.length}</strong><span>obras con tiempo definido</span></div><div className="cap-progress-rail"><div style={{width:`${data.projects.length?estimated.length/data.projects.length*100:0}%`}}/></div><p className="cap-muted">Los proyectos sin tiempo no entran en el cálculo; una carga baja puede reflejar datos incompletos.</p><button className="cap-btn" onClick={onGoTimes}><Timer size={16}/> Cargar tiempos y dirección <ArrowRight size={16}/></button></div></div>
  <div className="cap-panel cap-assign-table"><SectionIntro title="Obras del plan" sub="Las TP se modifican desde el Gantt. El historial pasado permanece bloqueado."/><div className="cap-table-scroll"><table><thead><tr><th>Obra</th><th>Equipo inicial</th><th>Inicio</th><th>Personas previstas</th><th>Esfuerzo estimado</th><th>TP</th><th>Modalidad</th><th>Acción</th></tr></thead><tbody>{store.assignments.map(a=>{const p=data.projects.find(p=>String(p.id)===String(a.projectId)),e=data.estimates.find(e=>String(e.projectId)===String(a.projectId));if(!p||!e||isPickupProject(p))return null;const related=store.blocks.filter(b=>b.assignmentId===a.id),historical=related.some(b=>b.date&&b.date<dateISO(new Date()));return <tr key={a.id}><td><b>{p.numero}</b><small>{p.proyecto}</small></td><td>{store.teams.find(t=>t.id===a.teamId)?.name}</td><td>{dayLabel(a.start)}</td><td>{a.crew}</td><td>{hours(effort(e))} h-pers.</td><td>{related.length}</td><td><button type="button" className={'cap-mode '+(isOutsourced(e)?'outside':'inside')} disabled={historical} onClick={()=>toggleOutsource(p.id)} title={historical?'Historial bloqueado': 'Cambiar modalidad'}>{isOutsourced(e)?'Tercerizada':'Interna'}</button></td><td><button type="button" className="cap-btn small" onClick={()=>setTab('gantt')}>Ver TP</button>{!historical&&<button className="cap-icon-button" title="Eliminar planificación futura" aria-label="Eliminar planificación" onClick={()=>{if(window.confirm('¿Quitar toda la planificación de esta obra?'))setStore(s=>({...s,assignments:s.assignments.filter(x=>x.id!==a.id),blocks:s.blocks.filter(x=>x.assignmentId!==a.id)}));}}><X size={15}/></button>}</td></tr>;})}</tbody></table></div>{!store.assignments.length&&<div className="cap-empty">Todavía no hay asignaciones. Elegí una obra para comenzar.</div>}</div>
 </>;
}
export default function CapacityStudio({data,run,go,store,setStore,editable=true,routeLookup}){
 const [viewMonth,setViewMonth]=useState(START);
 const [tab,setTab]=useState('overview');
 const [selectedTeam,setSelectedTeam]=useState('ALL');
 const [rangeMode,setRangeMode]=useState('month');
 const [notice,setNotice]=useState(false);
 // Conversión una sola vez de v0.4: las asignaciones antiguas se guardan como TP.
 // Los días pasados quedan como 'sin confirmar'; jamás se inventa ejecución real.
 useEffect(()=>{if(Array.isArray(store.blocks))return;setStore(s=>({...s,blocks:s.assignments.flatMap(a=>{const e=data.estimates.find(x=>String(x.projectId)===String(a.projectId));const p=data.projects.find(x=>String(x.id)===String(a.projectId));return e&&p&&!isPickupProject(p)?generateBlocks(a,e,data.week?.length?data.week:WEEK,data.holidays||[],data.recesses||[]):[];})}));},[store.blocks,data.estimates,data.projects,data.week,data.holidays,data.recesses]);
 // Migración aditiva del escenario local v0.5: las TP futuros reciben
 // miembros nominales del equipo, pero los históricos jamás se marcan realizados.
 useEffect(()=>{if(!Array.isArray(store.blocks)||store.uxVersion===6)return;
  setStore(s=>({...s,uxVersion:6,teams:s.teams.map((t,i)=>({...t,color:teamColor(t,i)})),blocks:s.blocks.map(b=>({...b,reprogramHistory:b.reprogramHistory||[],workerHours:b.workerHours||{},workers:b.date>=dateISO(new Date())&&(!b.workers||!b.workers.length)&&b.status==='planificado'?defaultWorkerIds(b.teamId,b.date,s.members,s.absences,s.supportShifts||[]):b.workers||[]}))}));
 },[store.blocks,store.uxVersion]);
 const month=viewMonth; // El mes visible es una preferencia local, no un cambio de planificación compartida.
 const today=dateISO(new Date());
 const config=useMemo(()=>({projects:data.projects,estimates:data.estimates,teams:store.teams,members:store.members,absences:store.absences,assignments:store.assignments,blocks:store.blocks,supportShifts:store.supportShifts||[],specialDays:store.specialDays||[],week:data.week?.length?data.week:WEEK,holidays:data.holidays||[],recesses:data.recesses||[],today}),[data,store,today]);
 const model=useMemo(()=>buildMonthPlan({...config,month}),[config,month]);
 const startDate=[...(store.blocks||[]).map(b=>b.date).filter(Boolean),...store.assignments.map(a=>a.start).filter(Boolean)].sort()[0]||`${month}-01`;
 const endDate=[...(store.blocks||[]).map(b=>b.date).filter(Boolean),today].sort().at(-1)||today;
 const periodDates=useMemo(()=>ganttDates(rangeMode,{month,today,start:startDate,end:endDate}),[rangeMode,month,today,startDate,endDate]);
 const period=useMemo(()=>periodCapacity(config,periodDates),[config,periodDates]);
 const nav=[['overview','Ocupación mensual',Activity],['assignments','Asignación lineal',HardHat],['gantt','TP y backlog',CalendarDays],['people','Equipos y bajas',UsersRound],['logistics','Logística · camiones',Truck]];
 const setMonth=m=>{setViewMonth(m);setRangeMode('month');};
 return <div className="cap-root">
  <div className="cap-page-head"><div><span className="cap-eyebrow">PLANIFICACIÓN OPERATIVA <span>·</span> {isDemo?'VISTA PREVIA UX':'SINCRONIZACIÓN ACTIVA'}</span><h1>Ocupación y capacidad mensual</h1><p>Planificá obras linealmente y consultá qué porcentaje del mes tiene comprometido cada equipo.</p></div><div className="cap-head-actions"><button className="cap-btn" onClick={()=>window.print()}><Printer size={16}/> Imprimir informe</button><ExportButton model={model} month={month}/></div></div>
  {!editable&&<div className="cap-hint">Vista de consulta: tu usuario no tiene permisos para modificar equipos ni planificación. Podés seguir viendo la ocupación de Gerencia.</div>}
  <div className="cap-banner"><span className="cap-banner-icon"><ShieldAlert size={17}/></span><span><b>{isDemo?'Escenario ficticio.':'Planificación compartida.'}</b> {isDemo?'Los cambios quedan en este navegador.':'Los equipos, bajas y TP se sincronizan con Apps Script. Comprobá que el estado indique «Guardado» antes de cerrar.'}</span><button onClick={()=>setNotice(v=>!v)} title="Más información"><ChevronRight size={17}/></button></div>
  {notice&&<div className="cap-hint">Los cambios en equipos, colaboradores, ausencias, tareas y sábados se guardan en una hoja separada del Excel de proyectos. La hoja `proyecto` permanece intacta hasta la próxima importación. Una fecha pasada no confirma ejecución automáticamente.</div>}
  <div className="cap-toolbar"><div className="cap-tabs" role="tablist" aria-label="Módulos de planificación">{nav.map(([key,label,Icon])=><button role="tab" aria-selected={tab===key} className={tab===key?'active':''} key={key} onClick={()=>setTab(key)}><Icon size={16}/>{label}</button>)}</div><div className="cap-month-pick"><button title="Mes anterior" aria-label="Mes anterior" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft size={18}/></button><label><CalendarDays size={15}/><span>{monthTitle(month)}</span><input aria-label="Elegir mes" type="month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></label><button title="Mes siguiente" aria-label="Mes siguiente" onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight size={18}/></button></div></div>
  <div className="cap-panel-body" id="capacity-report">
   {tab==='overview'&&<OverView model={model} sourceData={data} go={go} month={month} setTab={setTab} teams={store.teams} config={config} rangeMode={rangeMode} setRangeMode={setRangeMode} period={period}/>}
   {tab==='gantt'&&<GanttTasks model={model} sourceData={data} store={{...store,blocks:store.blocks||[]}} setStore={setStore} selectedTeam={selectedTeam} changeTeam={setSelectedTeam} setTab={setTab} setMonth={setMonth} rangeMode={rangeMode} setRangeMode={setRangeMode} period={period}/>}
   {tab==='assignments'&&<MonthlyAutoPlanner store={{...store,blocks:store.blocks||[]}} setStore={setStore} data={data} run={run} month={month} model={model} rangeMode={rangeMode} setRangeMode={setRangeMode} period={period} onGoTimes={()=>go('times')} setTab={setTab}/>}
   {tab==='people'&&<PeopleManager store={store} setStore={setStore} month={month}/>}
   {tab==='logistics'&&<Logistics data={data} routeLookup={routeLookup}/>}
  </div>
  <div className="cap-legal"><span>Ocupación del equipo = horas programadas ÷ horas disponibles (puede superar 100%). Cobertura de la TP = horas asignables a operarios ÷ esfuerzo del TP.</span>{isDemo&&<button type="button" onClick={()=>{if(window.confirm('¿Restablecer los datos ficticios de esta demostración?')){setStore(demoCapacity());setTab('overview');}}}><RefreshCcw size={14}/> Restablecer ejemplo</button>}</div>
 </div>;
}
