import React,{useMemo,useState,useEffect} from 'react';
import {Activity,AlertTriangle,ArrowRight,Calendar,CalendarDays,CheckCircle2,ChevronLeft,ChevronRight,Clock3,Download,FileBarChart,HardHat,MapPin,Minus,Plus,Printer,RefreshCcw,Search,ShieldAlert,Timer,Truck,UserMinus,UserPlus,UsersRound,X} from 'lucide-react';
import {dateISO,shiftMonth,monthDates,firstDay,buildMonthPlan,hours,percent,isOutsourced,effort} from '../lib/planner.js';
import {WEEK} from '../lib/domain.js';
import {DEMO_SEED_ASSIGNMENTS} from '../data/scenario.js';
import '../capacity.css';

const KEY='obras-capacidad-ux-v3';
const START=dateISO(new Date()).slice(0,7);
const initial=()=>({
 teams:[{id:'T1',name:'Equipo A · colocación'},{id:'T2',name:'Equipo B · colocación'}],
 members:[
  {id:'M1',name:'Colaborador 01',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
  {id:'M2',name:'Colaborador 02',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
  {id:'M3',name:'Colaborador 03',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
  {id:'M4',name:'Colaborador 04',teamId:'T2',kind:'fijo',start:'2026-01-01',end:'',active:true},
  {id:'M5',name:'Colaborador 05',teamId:'T2',kind:'fijo',start:'2026-01-01',end:'',active:true}
 ],absences:[],assignments:DEMO_SEED_ASSIGNMENTS,month:START
});
function loadInitial(){try{const saved=JSON.parse(localStorage.getItem(KEY));if(saved && Array.isArray(saved.teams)&&Array.isArray(saved.members)&&Array.isArray(saved.assignments))return {...initial(),...saved};}catch{}return initial();}
const dayLabel=(iso)=>{const [y,m,d]=iso.split('-');return `${d}/${m}/${y}`;};
const monthTitle=(month)=>new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(new Date(`${month}-15T12:00:00`));
const MON_SHORT=['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const newId=(prefix)=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const demoAlert=()=>window.alert('Esta es una vista previa. Las modificaciones del equipo y el Gantt se guardan solamente en este navegador, no en Google Sheets.');

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
function OverView({model,sourceData,go,month,setTab,teams,config}){
 const future=Array.from({length:6},(_,i)=>shiftMonth(month,i));
 const upcoming=future.map(m=>buildMonthPlan({...config,month:m}));
 const overTeams=model.teamDays.filter(t=>t.load>t.capacity);
 const capDays=model.teamDays.some(t=>t.dates.some(d=>d.capacity>0));
 return <>
  <div className="cap-overview-top"><div><div className="cap-eyebrow">TABLERO PARA GERENCIA</div><h2>¿Nos alcanza el equipo para las obras?</h2><p>Capacidad efectiva contra horas de colocación comprometidas. Los solapamientos pueden superar el 100%.</p></div><Ring value={model.occupancy}/></div>
  <div className="cap-stat-grid">
   <Metric label="Capacidad disponible" value={`${hours(model.capacity)} h`} sub="Personal activo, feriados y bajas descontados" icon={UsersRound}/>
   <Metric label="Trabajo comprometido" value={`${hours(model.load)} h`} sub="Obras asignadas dentro del mes" icon={Timer} color="violet"/>
   <Metric label="Excedente del mes" value={`${hours(model.over)} h`} sub={model.over>0?'Hay más trabajo del que se puede ejecutar':'Sin exceso global este mes'} icon={AlertTriangle} color={model.over>0?'red':'green'}/>
   <Metric label="Días hasta fin de mes" value={model.calendarDaysRemaining} sub={`${model.workdaysRemaining} jornadas con capacidad, contando hoy si corresponde`} icon={CalendarDays} color="amber"/>
  </div>
  <div className="cap-grid-two">
   <div className="cap-panel"><SectionIntro title="Carga por equipo" sub="Los porcentajes mayores a 100% se muestran en rojo."><button className="cap-link" onClick={()=>setTab('people')}>Gestionar equipo <ArrowRight size={15}/></button></SectionIntro>
    {model.teamDays.length?model.teamDays.map(t=><div className="cap-team-load" key={t.id}><div className="cap-team-head"><div><b>{t.name}</b><small>{Math.max(...t.dates.map(d=>d.people),0)} colaboradores disponibles como máximo en este mes</small></div><span>{hours(t.load)} / {hours(t.capacity)} h</span></div><CapBar value={t.load} capacity={t.capacity}/></div>):<div className="cap-empty">Agregá al menos un equipo.</div>}
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
  {(model.over>0||overTeams.length>0)&&<div className="cap-alert"><AlertTriangle size={21}/><div><b>Atención: hay sobrecarga prevista.</b><p>{hours(model.load)} h comprometidas frente a {hours(model.capacity)} h disponibles. La solución puede combinar reprogramación, personal adicional o tercerización. Los picos diarios pueden existir aunque el total mensual sea menor al 100%.</p></div></div>}
  <div className="cap-report-grid"><div className="cap-insight"><strong>{sourceData.projects.length}</strong><span>obras del Excel sin estado terminado</span></div><div className="cap-insight"><strong>{sourceData.projects.length-sourceData.projects.filter(p=>sourceData.estimates.some(e=>String(e.projectId)===String(p.id))).length}</strong><span>obras sin tiempo de colocación</span></div><div className="cap-insight"><strong>{model.unassigned}</strong><span>obras estimadas sin asignar</span></div><div className="cap-insight"><strong>{model.fullyOutsourced}</strong><span>obras tercerizadas</span></div></div>
  {(!capDays||!sourceData.estimates.length)&&<div className="cap-hint">Completá equipos y tiempos reales para transformar esta simulación en un informe de Gerencia.</div>}
 </>;
}
function Gantt({model,sourceData,selectedTeam,changeTeam,go,setTab}){
 const dt=new Date(`${model.month}-01T12:00:00`);
 const weekday=iso=>new Date(`${iso}T12:00:00`).getDay();
 const filtered=model.computed.filter(a=>(selectedTeam==='ALL'||a.teamId===selectedTeam));
 const holidays=new Set((sourceData.holidays||[]).filter(h=>h.active!==false&&String(h.active)!=='false').map(h=>h.date));
 return <>
  <SectionIntro title="Gantt de colocación" sub="Un bloque representa trabajo programado. Una obra puede continuar en el mes siguiente; el Gantt no limita la sobrecarga."><div className="cap-filter"><label htmlFor="gantt-filter">Equipo</label><select id="gantt-filter" value={selectedTeam} onChange={e=>changeTeam(e.target.value)}><option value="ALL">Todos los equipos</option>{model.teamDays.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></div></SectionIntro>
  <div className="cap-gantt-wrap"><table className="cap-gantt-table"><thead><tr><th className="cap-gantt-sticky cap-project-col">Obra / equipo</th>{model.dates.map(iso=><th key={iso} className={`${[0,6].includes(weekday(iso))?'weekend':''} ${iso===dateISO(new Date())?'today':''}`}><span>{MON_SHORT[weekday(iso)]}</span><b>{Number(iso.slice(-2))}</b></th>)}</tr></thead><tbody>
    {filtered.map(a=><tr key={a.id}><th className="cap-gantt-sticky"><div className="cap-gantt-title" title={a.project.proyecto}><strong>{a.project.numero}</strong><span>{a.project.proyecto}</span><small>{model.teamDays.find(t=>t.id===a.teamId)?.name||'Sin equipo'} · {a.crew} personas · {hours(effort(a.estimate))} h-persona</small></div></th>{model.dates.map(date=>{const val=a.schedule.days[date]||0;const out=isOutsourced(a.estimate);return <td key={date} className={`${[0,6].includes(weekday(date))?'weekend':''} ${date===dateISO(new Date())?'today':''}`} title={`${a.project.numero} · ${dayLabel(date)} · ${val?hours(val)+' h-persona':'Sin tarea'}`}>
     {out?(date===a.start?<div className="cap-gantt-outsourced">T</div>:null):val>0?<div className={'cap-gantt-block '+(a.teamId!=='T1'?'alt':'')} title={`${hours(val)} h-persona`}/>:null}
    </td>})}</tr>)}
    <tr className="cap-gantt-total"><th className="cap-gantt-sticky"><strong>Ocupación diaria</strong><small>Todos los equipos</small></th>{model.daily.map(d=><td key={d.date} title={`${hours(d.load)} h / ${hours(d.capacity)} h disponibles`}><span className={d.load>d.capacity?'cap-daily-heat over':d.load>0?'cap-daily-heat used':'cap-daily-heat'}>{d.capacity>0?percent(d.load,d.capacity)+'%':d.load>0?'∞':'·'}</span></td>)}</tr>
  </tbody></table>{!filtered.length&&<div className="cap-empty">Todavía no hay obras asignadas para visualizar. <button onClick={()=>setTab('assignments')}>Crear asignación</button></div>}</div>
  <div className="cap-gantt-legend"><span><i className="cap-swatch blue"/> Equipo A / trabajos internos</span><span><i className="cap-swatch green"/> Otros equipos</span><span><i className="cap-swatch purple"/> Tercerizada</span><span><i className="cap-swatch gray"/> Fin de semana</span></div>
  <div className="cap-hint">El calendario se calcula con 6 horas puras de lunes a jueves y 5 los viernes, salvo que modifiques la jornada. Los feriados y recesos bloqueados se descuentan; los traslados no están incluidos en esta primera etapa.</div>
 </>;
}
function People({store,setStore,month}){
 const [tname,setTname]=useState('');const [member,setMember]=useState({name:'',teamId:'T1',kind:'fijo',start:firstDay(month),end:''});
 const [absence,setAbsence]=useState({memberId:'',start:firstDay(month),end:firstDay(month),reason:'Accidente / baja'});
 const addTeam=e=>{e.preventDefault();if(!tname.trim())return;setStore(s=>({...s,teams:[...s.teams,{id:newId('T'),name:tname.trim()}]}));setTname('');};
 const addMember=e=>{e.preventDefault();if(!member.name.trim()||!member.teamId||member.end&&member.end<member.start)return;setStore(s=>({...s,members:[...s.members,{...member,id:newId('M'),active:true}]}));setMember(s=>({...s,name:'',end:''}));};
 const addAbsence=e=>{e.preventDefault();if(!absence.memberId||!absence.start||!absence.end||absence.end<absence.start)return;setStore(s=>({...s,absences:[...s.absences,{...absence,id:newId('A')}]}));};
 return <div className="cap-people-layout">
  <div className="cap-panel"><SectionIntro title="Equipos y colaboradores" sub="Podés asignar personal fijo y refuerzos temporales. La capacidad se calcula por persona y día."/><form className="cap-inline-form" onSubmit={addTeam}><input value={tname} onChange={e=>setTname(e.target.value)} placeholder="Nombre del nuevo equipo" required/><button className="cap-btn" type="submit"><Plus size={15}/> Equipo</button></form>
   {store.teams.map(team=><div className="cap-crew-group" key={team.id}><div className="cap-crew-title"><b>{team.name}</b><span>{store.members.filter(m=>m.teamId===team.id&&m.active!==false).length} activos</span></div>{store.members.filter(m=>m.teamId===team.id).map(m=><div className="cap-member" key={m.id}><div className="cap-initial">{m.name.slice(0,1).toUpperCase()}</div><div className="cap-member-detail"><b>{m.name}</b><small>{m.kind==='adicional'?'Refuerzo':'Personal fijo'} · desde {dayLabel(m.start)}{m.end?' hasta '+dayLabel(m.end):''}</small></div><button type="button" className={'cap-switch '+(!m.active?'off':'')} aria-label={m.active?'Desactivar colaborador':'Activar colaborador'} title={m.active?'Desactivar colaborador':'Activar colaborador'} onClick={()=>setStore(s=>({...s,members:s.members.map(x=>x.id===m.id?{...x,active:!x.active}:x)}))}><span/></button></div>)}{!store.members.some(m=>m.teamId===team.id)&&<small className="cap-muted">Sin colaboradores</small>}</div>)}
  </div>
  <div className="cap-people-side"><div className="cap-panel"><SectionIntro title="Agregar colaborador" sub="La fecha de ingreso impacta la capacidad a partir de ese día."/><form className="cap-form" onSubmit={addMember}><label>Nombre<input required value={member.name} onChange={e=>setMember(s=>({...s,name:e.target.value}))} placeholder="Nombre o identificación"/></label><div className="cap-form-row"><label>Equipo<select required value={member.teamId} onChange={e=>setMember(s=>({...s,teamId:e.target.value}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Vínculo<select value={member.kind} onChange={e=>setMember(s=>({...s,kind:e.target.value}))}><option value="fijo">Fijo</option><option value="adicional">Adicional</option></select></label></div><div className="cap-form-row"><label>Desde<input type="date" required value={member.start} onChange={e=>setMember(s=>({...s,start:e.target.value}))}/></label><label>Hasta (opcional)<input type="date" min={member.start} value={member.end} onChange={e=>setMember(s=>({...s,end:e.target.value}))}/></label></div><button className="cap-btn primary" type="submit"><UserPlus size={16}/> Incorporar</button></form></div>
   <div className="cap-panel"><SectionIntro title="Bajas y ausencias" sub="Licencias, accidentes y otros motivos descuentan horas en el período seleccionado."/><form className="cap-form" onSubmit={addAbsence}><label>Colaborador<select required value={absence.memberId} onChange={e=>setAbsence(s=>({...s,memberId:e.target.value}))}><option value="">Seleccionar…</option>{store.members.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="cap-form-row"><label>Desde<input type="date" required value={absence.start} onChange={e=>setAbsence(s=>({...s,start:e.target.value}))}/></label><label>Hasta<input type="date" required min={absence.start} value={absence.end} onChange={e=>setAbsence(s=>({...s,end:e.target.value}))}/></label></div><label>Motivo<input required value={absence.reason} onChange={e=>setAbsence(s=>({...s,reason:e.target.value}))}/></label><button className="cap-btn" type="submit"><UserMinus size={16}/> Registrar baja</button></form>
    <div className="cap-absences">{store.absences.map(a=><div className="cap-absence" key={a.id}><div><b>{store.members.find(m=>m.id===a.memberId)?.name||'Colaborador'}</b><small>{a.reason} · {dayLabel(a.start)} al {dayLabel(a.end)}</small></div><button type="button" aria-label="Eliminar ausencia" title="Eliminar ausencia" onClick={()=>setStore(s=>({...s,absences:s.absences.filter(x=>x.id!==a.id)}))}><X size={15}/></button></div>)}</div>
   </div></div>
 </div>;
}
function Assignments({store,setStore,data,run,onGoTimes,month}){
 const [form,setForm]=useState({projectId:'',teamId:store.teams[0]?.id||'',start:firstDay(month),crew:2});
 const [q,setQ]=useState('');
 const estimated=data.projects.filter(p=>data.estimates.some(e=>String(e.projectId)===String(p.id)));
 const available=estimated.filter(p=>(p.numero+' '+p.proyecto+' '+p.cliente).toLowerCase().includes(q.toLowerCase())).slice(0,100);
 const add=e=>{e.preventDefault();if(!form.projectId||!form.teamId||!form.start||Number(form.crew)<1)return;
   if(store.assignments.some(a=>String(a.projectId)===String(form.projectId))){window.alert('Esta obra ya tiene una asignación. Editá la existente para evitar duplicar el esfuerzo.');return;}
   setStore(s=>({...s,assignments:[...s.assignments,{...form,crew:Number(form.crew),id:newId('P')}]}));setForm(v=>({...v,projectId:''}));};
 const toggleOutsource=async(projectId)=>{
   const e=data.estimates.find(e=>String(e.projectId)===String(projectId));if(!e)return;
   await run('estimate.save',{estimate:{...e,outsourced:!isOutsourced(e)}},s=>({...s,estimates:s.estimates.map(x=>String(x.projectId)===String(projectId)?{...x,outsourced:!isOutsourced(e)}:x)}),!isOutsourced(e)?'Obra tercerizada; libera capacidad.':'Obra reincorporada al equipo interno.');
 };
 return <>
  <div className="cap-grid-two"><div className="cap-panel"><SectionIntro title="Asignar una obra al equipo" sub="Tomamos las horas-persona de su estimación y las distribuimos desde el día de inicio."/>
   <form className="cap-form" onSubmit={add}><label>Buscar obra estimada<input placeholder="Filtrar por número, obra o cliente…" value={q} onChange={e=>setQ(e.target.value)}/></label><label>Obra<select required value={form.projectId} onChange={e=>setForm(s=>({...s,projectId:e.target.value}))}><option value="">Seleccionar una obra…</option>{available.map(p=><option value={p.id} key={p.id}>{p.numero} · {p.proyecto.slice(0,60)}</option>)}</select></label><div className="cap-form-row"><label>Equipo<select required value={form.teamId} onChange={e=>setForm(s=>({...s,teamId:e.target.value}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Personal previsto<input required min="1" max="40" type="number" value={form.crew} onChange={e=>setForm(s=>({...s,crew:e.target.value}))}/></label></div><label>Fecha de inicio de colocación<input required type="date" value={form.start} onChange={e=>setForm(s=>({...s,start:e.target.value}))}/></label><button className="cap-btn primary" type="submit"><Plus size={16}/> Agregar al Gantt</button></form>
   <div className="cap-hint">Cada obra se asigna una sola vez en esta versión. No hacemos reparto parcial del esfuerzo entre varios equipos todavía.</div>
  </div><div className="cap-panel"><SectionIntro title="Estado de estimación" sub="El Excel solo relaciona obras y estados. La duración de colocación se carga por separado."/><div className="cap-estimate-large"><strong>{estimated.length} / {data.projects.length}</strong><span>obras con tiempo definido</span></div><div className="cap-progress-rail"><div style={{width:`${data.projects.length?estimated.length/data.projects.length*100:0}%`}}/></div><p className="cap-muted">Los proyectos sin tiempo no entran en el cálculo; una carga baja puede reflejar datos incompletos.</p><button className="cap-btn" onClick={onGoTimes}><Timer size={16}/> Cargar tiempos y dirección <ArrowRight size={16}/></button></div></div>
  <div className="cap-panel cap-assign-table"><SectionIntro title="Obras del plan" sub="Modificá las fechas o la cantidad de personas. Tercerizar descuenta su carga interna sin borrar la estimación."/><div className="cap-table-scroll"><table><thead><tr><th>Obra</th><th>Equipo</th><th>Inicio</th><th>Personas</th><th>Esfuerzo</th><th>Modalidad</th><th></th></tr></thead><tbody>{store.assignments.map(a=>{const p=data.projects.find(p=>String(p.id)===String(a.projectId)),e=data.estimates.find(e=>String(e.projectId)===String(a.projectId));if(!p||!e)return null;return <tr key={a.id}><td><b>{p.numero}</b><small>{p.proyecto}</small></td><td><select value={a.teamId} onChange={ev=>setStore(s=>({...s,assignments:s.assignments.map(x=>x.id===a.id?{...x,teamId:ev.target.value}:x)}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></td><td><input aria-label={`Inicio ${p.numero}`} type="date" value={a.start} onChange={ev=>setStore(s=>({...s,assignments:s.assignments.map(x=>x.id===a.id?{...x,start:ev.target.value}:x)}))}/></td><td><input aria-label={`Personas para ${p.numero}`} type="number" min="1" max="40" value={a.crew} onChange={ev=>setStore(s=>({...s,assignments:s.assignments.map(x=>x.id===a.id?{...x,crew:Math.max(1,Number(ev.target.value))}:x)}))}/></td><td>{hours(effort(e))} h</td><td><button className={'cap-mode '+(isOutsourced(e)?'outside':'inside')} onClick={()=>toggleOutsource(p.id)} title="Cambiar modalidad">{isOutsourced(e)?'Tercerizada':'Interna'}</button></td><td><button className="cap-icon-button" title="Quitar del plan" aria-label="Quitar del plan" onClick={()=>setStore(s=>({...s,assignments:s.assignments.filter(x=>x.id!==a.id)}))}><X size={16}/></button></td></tr>;})}</tbody></table></div>{!store.assignments.length&&<div className="cap-empty">Todavía no hay asignaciones. Elegí una obra para comenzar.</div>}</div>
 </>;
}
function Logistics({data}){
 const addresses=data.estimates.filter(e=>e.address && data.projects.some(p=>String(p.id)===String(e.projectId)));
 const origin='Avenida Siria 1633, San Miguel de Tucumán, Tucumán, Argentina';
 const [selected,setSelected]=useState('');
 const address=addresses.find(a=>String(a.projectId)===String(selected))?.address||'';
 const uri=address?'https://www.google.com/maps/dir/?api=1&origin='+encodeURIComponent(origin)+'&destination='+encodeURIComponent(address+', Tucumán, Argentina')+'&travelmode=driving':'';
 return <div className="cap-grid-two"><div className="cap-panel"><SectionIntro title="Logística · futura etapa" sub="Preparada para recorridos entre obras, viajes de ida y vuelta y tiempos que descuentan disponibilidad."/><div className="cap-logistics-origin"><MapPin size={21}/><div><small>ORIGEN PREDETERMINADO</small><b>{origin}</b></div></div><div className="cap-form"><label>Elegí una obra con dirección cargada<select value={selected} onChange={e=>setSelected(e.target.value)}><option value="">Seleccionar destino…</option>{addresses.map(e=>{const p=data.projects.find(p=>String(p.id)===String(e.projectId));return <option key={e.projectId} value={e.projectId}>{p?.numero} · {e.address}</option>})}</select></label>{address&&<a href={uri} className="cap-btn" rel="noopener noreferrer" target="_blank"><MapPin size={16}/> Abrir ruta en Google Maps <ArrowRight size={16}/></a>}</div><div className="cap-hint">Este botón abre una ruta para consulta manual. No calcula kilómetros ni tiempos automáticamente ni reserva capacidad.</div></div>
 <div className="cap-panel"><SectionIntro title="Motor de traslados" sub="Diseño previsto, sin datos simulados de kilómetros."/><div className="cap-logistics-steps"><div><span>1</span> Punto de salida: Avenida Siria 1633</div><div><span>2</span> Viaje a obra A, y luego obra B si corresponde</div><div><span>3</span> Regreso a base o siguiente destino</div><div><span>4</span> Distancia real por ruta + velocidad configurable del camión</div><div><span>5</span> Tiempo de viaje descontado del equipo y del transporte</div></div><p className="cap-muted">Para el cálculo automático real se conectará un servicio de rutas. Velocidades cargadas o estándar configurables, sin inventar tiempos a partir de kilómetros en línea recta.</p><div className="cap-roadmap"><Truck size={18}/> Próximamente: mapa, trayectos A→B→base, transportes y disponibilidad.</div></div></div>;
}
export default function CapacityStudio({data,run,go}){
 const [store,setStore]=useState(loadInitial);
 const [tab,setTab]=useState('overview');
 const [selectedTeam,setSelectedTeam]=useState('ALL');
 const [notice,setNotice]=useState(false);
 useEffect(()=>{localStorage.setItem(KEY,JSON.stringify(store));},[store]);
 const month=store.month||START;
 const today=dateISO(new Date());
 const config=useMemo(()=>({projects:data.projects,estimates:data.estimates,teams:store.teams,members:store.members,absences:store.absences,assignments:store.assignments,week:data.week?.length?data.week:WEEK,holidays:data.holidays||[],recesses:data.recesses||[],today}),[data,store,today]);
 const model=useMemo(()=>buildMonthPlan({...config,month}),[config,month]);
 const nav=[['overview','Resumen de capacidad',Activity],['gantt','Gantt mensual',CalendarDays],['assignments','Asignaciones',HardHat],['people','Equipos y bajas',UsersRound],['logistics','Logística futura',Truck]];
 const setMonth=m=>setStore(s=>({...s,month:m}));
 return <div className="cap-root">
  <div className="cap-page-head"><div><span className="cap-eyebrow">PLANIFICACIÓN OPERATIVA <span>·</span> VISTA PREVIA UX</span><h1>Capacidad de colocación</h1><p>Ocupación de los equipos y carga de obras para decidir con anticipación.</p></div><div className="cap-head-actions"><button className="cap-btn" onClick={()=>window.print()}><Printer size={16}/> Imprimir informe</button><ExportButton model={model} month={month}/></div></div>
  <div className="cap-banner"><span className="cap-banner-icon"><ShieldAlert size={17}/></span><span><b>Escenario de prueba.</b> Las seis estimaciones y las personas precargadas son ejemplos para evaluar el diseño, no datos confirmados. El Excel de proyectos sí es el archivo recibido. Los cambios de equipos y asignaciones se guardan solo en este navegador.</span><button onClick={()=>setNotice(v=>!v)} title="Más información"><ChevronRight size={17}/></button></div>
  {notice&&<div className="cap-hint">Cuando validemos la UX, las nuevas pestañas de colaboradores, equipos, ausencias y planificación se conectarán con Apps Script. La pestaña `proyecto` seguirá siendo solo una copia actualizada del Excel.</div>}
  <div className="cap-toolbar"><div className="cap-tabs" role="tablist" aria-label="Módulos de planificación">{nav.map(([key,label,Icon])=><button role="tab" aria-selected={tab===key} className={tab===key?'active':''} key={key} onClick={()=>setTab(key)}><Icon size={16}/>{label}</button>)}</div><div className="cap-month-pick"><button title="Mes anterior" aria-label="Mes anterior" onClick={()=>setMonth(shiftMonth(month,-1))}><ChevronLeft size={18}/></button><label><CalendarDays size={15}/><span>{monthTitle(month)}</span><input aria-label="Elegir mes" type="month" value={month} onChange={e=>e.target.value&&setMonth(e.target.value)}/></label><button title="Mes siguiente" aria-label="Mes siguiente" onClick={()=>setMonth(shiftMonth(month,1))}><ChevronRight size={18}/></button></div></div>
  <div className="cap-panel-body" id="capacity-report">
   {tab==='overview'&&<OverView model={model} sourceData={data} go={go} month={month} setTab={setTab} teams={store.teams} config={config}/>}
   {tab==='gantt'&&<Gantt model={model} sourceData={data} selectedTeam={selectedTeam} changeTeam={setSelectedTeam} setTab={setTab} go={go}/>}
   {tab==='assignments'&&<Assignments store={store} setStore={setStore} data={data} run={run} month={month} onGoTimes={()=>go('times')}/>}
   {tab==='people'&&<People store={store} setStore={setStore} month={month}/>}
   {tab==='logistics'&&<Logistics data={data}/>}
  </div>
  <div className="cap-legal"><span>Horas-persona = tiempo estimado × 2 · Ocupación = esfuerzo asignado ÷ capacidad disponible.</span><button type="button" onClick={()=>{if(window.confirm('¿Restaurar el escenario de ejemplo en este navegador?')){setStore(initial());setTab('overview');}}}><RefreshCcw size={14}/> Restablecer ejemplo</button></div>
 </div>;
}
