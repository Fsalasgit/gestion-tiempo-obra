import React, {useCallback,useEffect,useMemo,useState} from 'react';
import {
  Activity,ArrowRight,BookOpen,CalendarDays,CalendarPlus,Check,ChevronDown,ChevronRight,
  CircleHelp,Clock3,CloudUpload,ExternalLink,FolderKanban,HardHat,LayoutDashboard,
  LogOut,MapPin,Menu,Plus,RefreshCw,Save,Search,Settings2,ShieldCheck,Timer,UsersRound,X
} from 'lucide-react';
import {
  WEEK,effectiveStart,estimateCrewHours,formatNumber,getPersonHours,
  projectSummary,sortProjects,weeklyCapacity,countDailyHours
} from './lib/domain.js';
import {DEMO_DATA,isDemo,readDemo,saveDemo} from './lib/demo.js';
import CapacityStudio from './components/CapacityStudio.jsx';
import {previewExcelFile} from './lib/excelImport.js';
import {request,readFileAsBase64} from './lib/api.js';
import {isPickupProject} from './lib/workBlocks.js';

const NAV=[
  {id:'planning',label:'Capacidad y Gantt',icon:Activity},
  {id:'dashboard',label:'Obras y avance',icon:LayoutDashboard},
  {id:'projects',label:'Proyectos',icon:FolderKanban},
  {id:'times',label:'Tiempos de obra',icon:Timer},
  {id:'calendar',label:'Calendario laboral',icon:CalendarDays},
  {id:'users',label:'Usuarios',icon:UsersRound},
  {id:'help',label:'Cómo funciona',icon:BookOpen}
];
const EMPTY={projects:[],estimates:[],week:WEEK,holidays:[],recesses:[],events:[],users:[],teamSize:3};
const canEdit=actor=>actor && ['SUPERADMIN','ADMIN','PLANIFICADOR'].includes(actor.role);
const canAdmin=actor=>actor && ['SUPERADMIN','ADMIN'].includes(actor.role);
const strDate=(s)=>{if(!s)return 'Sin fecha';const [y,m,d]=s.slice(0,10).split('-');return `${d}/${m}/${y}`;};
function Pill({children,tone='slate'}) {return <span className={'pill '+tone}>{children}</span>;}
function Empty({title,desc}) {return <div className="empty"><FolderKanban size={28}/><strong>{title}</strong><span>{desc}</span></div>;}
function SectionHead({eyebrow,title,sub,action}) {return <div className="section-head"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{sub&&<p>{sub}</p>}</div>{action}</div>;}
function Metric({icon:Icon,label,value,hint,tone='blue'}) {return <div className="metric"><div className={'metric-icon '+tone}><Icon size={20}/></div><div className="metric-label">{label}</div><div className="metric-number">{value}</div><div className="metric-hint">{hint}</div></div>;}
function Notice({children,type='info'}) {return <div role="status" className={'notice '+type}>{children}</div>;}
function DateCell({date}) {return <span className="date-text">{strDate(date)}</span>;}
function ProjectName({p}) {return <div className="project-cell"><strong>{p.proyecto||'Proyecto sin nombre'}</strong><small>{p.numero} · {p.cliente||'Cliente sin especificar'}</small>{/retiro\s+en\s+abalum/i.test(String(p.grupo||''))&&<small className="block muted">Retiro en ABALUM · sin colocación</small>}</div>;}
function ProjectTable({projects,estimates=[],onEstimate,compact=false}) {
  if(!projects.length)return <Empty title="No hay proyectos" desc="Importá tu primera hoja o modificá los filtros."/>;
  return <div className="table-wrap"><table><thead><tr><th>Proyecto / cliente</th><th>Estado</th><th>Inicio considerado</th>{!compact&&<th>Producción</th>}<th>Tiempo de obra</th><th className="right">{onEstimate?'Acción':'Artículos'}</th></tr></thead><tbody>
    {projects.map(p=>{const e=estimates.find(x=>String(x.projectId)===String(p.id));return <tr key={p.id}>
      <td><ProjectName p={p}/></td>
      <td><Pill tone={p.estado==='Ejecucion'?'green':p.estado==='Aprobado'?'blue':'slate'}>{p.estado||'Sin estado'}</Pill></td>
      <td><DateCell date={effectiveStart(p)}/>{!p.inicio && p.inicioP && <small className="block muted">Inicio previsto</small>}</td>
      {!compact&&<td><span className="muted">{p.produccion||'—'}</span></td>}
      <td>{isPickupProject(p)?<Pill tone="slate">No requiere colocación</Pill>:e?<><strong>{formatNumber(e.value)} {e.unit}</strong>{e.outsourced&&<small className="block"><Pill tone="violet">Tercerizada</Pill></small>}</>:<Pill tone="amber">Pendiente de estimar</Pill>}</td>
      <td className="right">{onEstimate?(isPickupProject(p)?<span className="muted">—</span>:<button className="btn tiny secondary" onClick={()=>onEstimate(p)}>{e?'Editar':'Estimar'} <ArrowRight size={14}/></button>):formatNumber(p.items||0,0)}</td>
    </tr>;})}
  </tbody></table></div>;
}
function Login({onLogin}) {
  const [username,setUsername]=useState('');
  const [password,setPassword]=useState('');
  const [error,setError]=useState('');
  const [loading,setLoading]=useState(false);
  const submit=async(e)=>{
    e.preventDefault();setError('');setLoading(true);
    try {await onLogin(username,password);setPassword('');}
    catch(err){setError(err.message||'No se pudo iniciar sesión.');}
    finally {setLoading(false);}
  };
  return <main className="login-screen"><div className="login-card"><div className="brand-mark large"><HardHat/></div><span className="eyebrow">ABALUM · GESTIÓN OPERATIVA</span><h1>Planificá con<br/><span>tiempo real.</span></h1><p>Obras, horas de trabajo, equipo y calendario en un mismo lugar.</p><div className="login-divider"/><strong>Iniciar sesión</strong>
    <form className="login-form" onSubmit={submit}>
      <label className="field" htmlFor="login-username">Usuario<input id="login-username" name="username" autoComplete="username" autoCapitalize="none" spellCheck="false" required minLength="3" maxLength="32" value={username} onChange={e=>setUsername(e.target.value)}/></label>
      <label className="field" htmlFor="login-password">Contraseña<input id="login-password" name="password" type="password" autoComplete="current-password" required value={password} onChange={e=>setPassword(e.target.value)}/></label>
      {error&&<Notice type="danger">{error}</Notice>}
      <button className="btn primary full" disabled={loading} type="submit">{loading?'Ingresando…':'Ingresar'} <ArrowRight size={16}/></button>
    </form><small>Tu sesión se conserva al volver a abrir la aplicación.</small>
  </div></main>;
}
function Dashboard({data,go}) {
  const projects=sortProjects(data.projects), summary=projectSummary(projects,data.estimates);
  const activeIds=new Set(data.projects.map(x=>String(x.id)));
  const outsourced=data.estimates.filter(x=>activeIds.has(String(x.projectId)) && (x.outsourced===true||String(x.outsourced)==='true')).length;
  const capacity=weeklyCapacity(data.week,data.teamSize);
  return <>
    <SectionHead eyebrow="VISIÓN GENERAL" title="Panel de trabajo" sub="Estado actual de las obras y su estimación de esfuerzo." action={<button className="btn primary" onClick={()=>go('times')}><Plus size={16}/> Cargar un tiempo</button>}/>
    <div className="metrics-grid">
      <Metric icon={FolderKanban} label="Obras activas" value={summary.projects} hint="Consolidadas desde el origen"/>
      <Metric icon={Timer} label="Tiempos definidos" value={`${summary.estimated} / ${projects.filter(p=>!isPickupProject(p)).length}`} hint={`${summary.pending} pendientes de estimar`} tone="green"/>
      <Metric icon={UsersRound} label="Capacidad del equipo" value={`${formatNumber(capacity,0)} h`} hint={`${data.teamSize} personas · por semana tipo`} tone="violet"/>
      <Metric icon={CloudUpload} label="Obras tercerizadas" value={outsourced} hint="No consumen capacidad interna" tone="amber"/>
    </div>
    <div className="split-panels">
      <div className="panel"><div className="panel-heading"><div><h2>Próximas obras</h2><p>Ordenadas por Inicio o Inicio P.</p></div><button className="link-btn" onClick={()=>go('projects')}>Ver todas <ArrowRight size={15}/></button></div><div className="mini-projects">
        {projects.slice(0,5).map((p,i)=><div className="mini-project" key={p.id}><div className="mini-index">{String(i+1).padStart(2,'0')}</div><ProjectName p={p}/><span className="mini-date">{strDate(effectiveStart(p))}</span></div>)}
        {!projects.length&&<Empty title="Sin obras importadas" desc="Cargá un Excel desde la sección Proyectos."/>}
      </div></div>
      <div className="panel"><div className="panel-heading"><div><h2>Cómo se calcula</h2><p>Base: dos personas por estimación.</p></div></div><div className="formula-card"><span>Ejemplo · 12 horas con 2 personas</span><div className="formula-number">24 <small>horas-persona</small></div><div className="formula-row"><span>Con 1 persona</span><strong>24 h</strong></div><div className="formula-row"><span>Con 2 personas</span><strong>12 h</strong></div><div className="formula-row"><span>Con 3 personas</span><strong>8 h</strong></div></div><div className="callout">Lunes a jueves: <b>6 h puras</b>. Viernes: <b>5 h puras</b>. Los recesos y feriados reducen disponibilidad.</div><button className="btn secondary full" onClick={()=>go('help')}><CircleHelp size={16}/> Ver la lógica completa</button></div>
    </div>
  </>;
}
function Projects({data,actor,run,go,onEstimate}) {
  const [term,setTerm]=useState('');const [status,setStatus]=useState('TODOS');const [source,setSource]=useState('');const [tab,setTab]=useState('');const [file,setFile]=useState(null);const [previewReport,setPreviewReport]=useState(null);
  const projects=useMemo(()=>sortProjects(data.projects).filter(p=>(status==='TODOS'||p.estado===status) && [p.numero,p.cliente,p.proyecto,p.lider].some(v=>String(v||'').toLowerCase().includes(term.toLowerCase()))),[data.projects,term,status]);
  const statuses=[...new Set(data.projects.map(p=>p.estado).filter(Boolean))];
  return <>
    <SectionHead eyebrow="FUENTE DEL SISTEMA" title="Proyectos" sub="La información de origen se consulta aquí. No se puede editar una obra desde esta app."/>
    {canAdmin(actor)&&<div className="panel importer"><div className="panel-heading"><div><h2>Actualizar origen de proyectos</h2><p>Importá un Excel o vinculá una hoja de Google. Los tiempos cargados se conservan.</p></div><Pill tone="blue">Solo lectura de origen</Pill></div>
      <div className="import-grid"><label className="field">Google Sheet · URL o ID<input value={source} onChange={e=>setSource(e.target.value)} placeholder="https://docs.google.com/spreadsheets/d/..."/></label><label className="field">Pestaña (opcional)<input value={tab} onChange={e=>setTab(e.target.value)} placeholder="Primera pestaña"/></label><button className="btn primary align-end" disabled={!source.trim()} onClick={()=>run('project.importSheet',{spreadsheetId:source,sheetName:tab},null,'Origen importado.')}><CloudUpload size={16}/> Vincular e importar</button></div>
      <div className="import-bottom"><label className="file-input"><CloudUpload size={17}/><span>{file?file.name:'Seleccionar Excel (.xls / .xlsx)'}</span><input type="file" accept=".xls,.xlsx" onChange={e=>setFile(e.target.files?.[0]||null)}/></label><button disabled={!file} className="btn secondary" onClick={async()=>{try{
        if(isDemo){const result=await previewExcelFile(file);setPreviewReport(result.report);await run('project.preview',{},state=>({...state,projects:result.projects,sourceFile:file.name}),`Excel leído en vista previa: ${result.report.active} proyectos activos. No se modificó Google Sheets.`);}
        else {const base64=await readFileAsBase64(file);await run('project.uploadExcel',{filename:file.name,base64},null,'Excel convertido e importado.');}
      }catch(e){window.dispatchEvent(new CustomEvent('obra-error',{detail:e.message}));}}}>{isDemo?'Actualizar vista previa':'Subir Excel'}</button><button className="btn ghost" onClick={()=>run('project.refresh',{},null,'Proyectos actualizados.')}><RefreshCw size={15}/> Refrescar origen</button></div>
      {data.sourceSheetId&&<small className="muted block">Hoja de origen conectada: {data.sourceSheetId}</small>}
      {isDemo&&<Notice>Vista previa: la hoja de proyecto se actualiza únicamente al seleccionar un nuevo Excel. No podés editar sus campos. Las estimaciones se conservan en otra estructura. La demo incluye seis proyectos ficticios. Para visualizar obras reales, seleccioná tu Excel en esta pantalla.</Notice>}{previewReport&&<Notice type="success">Filas leídas: {previewReport.originalRows} · Obras activas: {previewReport.active} · Filas con estado cerrado: {previewReport.closed} · Otras filas omitidas: {previewReport.skipped}.</Notice>}
    </div>}
    <div className="panel"><div className="toolbar"><div className="search-control"><Search size={17}/><input aria-label="Buscar proyectos" value={term} onChange={e=>setTerm(e.target.value)} placeholder="Buscar obra, cliente o número…"/></div><select aria-label="Filtrar por estado" value={status} onChange={e=>setStatus(e.target.value)}><option value="TODOS">Todos los estados</option>{statuses.map(s=><option key={s}>{s}</option>)}</select><span className="toolbar-count">{projects.length} obras</span></div><ProjectTable projects={projects} estimates={data.estimates} onEstimate={canEdit(actor)?onEstimate:null}/></div>
  </>;
}
function Times({data,actor,run,selection,onSelect}) {
  const [term,setTerm]=useState('');const [estimate,setEstimate]=useState({value:'',unit:'horas',outsourced:false,address:'',notes:''});const [crew,setCrew]=useState(3);
  const [editing,setEditing]=useState(false);
  const sorted=useMemo(()=>sortProjects(data.projects).filter(p=>!isPickupProject(p)&&[p.numero,p.cliente,p.proyecto].some(v=>String(v||'').toLowerCase().includes(term.toLowerCase()))),[data.projects,term]);
  const chosen=data.projects.find(p=>String(p.id)===String(selection)&&!isPickupProject(p));
  useEffect(()=>{
    if(!chosen){setEditing(false);return;}
    const old=data.estimates.find(e=>String(e.projectId)===String(chosen.id));
    setEstimate(old?{value:String(old.value),unit:old.unit,outsourced:old.outsourced===true||String(old.outsourced)==='true',address:old.address||'',notes:old.notes||''}:{value:'',unit:'horas',outsourced:false,address:'',notes:''});setEditing(true);
  },[selection,data.estimates,chosen?.id]);
  const personHours=getPersonHours(estimate.value,estimate.unit);
  return <>
    <SectionHead eyebrow="ESTIMACIÓN DE ESFUERZO" title="Tiempos de obra" sub="Tiempo de colocación para dos personas. Las obras de retiro en ABALUM no se estiman."/>
    <div className="times-grid"><div className="panel"><div className="panel-heading"><div><h2>Seleccionar obra</h2><p>Un tiempo por proyecto, editable.</p></div></div><div className="search-control in-panel"><Search size={17}/><input aria-label="Buscar obra para estimar" placeholder="Buscar proyecto…" value={term} onChange={e=>setTerm(e.target.value)}/></div><div className="selection-list">
      {sorted.map(p=>{const e=data.estimates.find(x=>String(x.projectId)===String(p.id));return <button className={'selection-item '+(String(p.id)===String(selection)?'selected':'')} key={p.id} onClick={()=>onSelect(p.id)}><div><strong>{p.proyecto}</strong><small>{p.numero} · {p.cliente}</small></div>{e?<Check size={17} className="check"/>:<Plus size={17}/>}</button>;})}
      {!sorted.length&&<Empty title="Sin coincidencias" desc="Probá otra búsqueda."/>}
    </div></div>
    <div className="panel edit-panel">{editing&&chosen?<><div className="panel-heading"><div><span className="eyebrow">OBRA SELECCIONADA</span><h2>{chosen.proyecto}</h2><p>{chosen.numero} · {chosen.cliente}</p></div><button aria-label="Cerrar edición" className="icon-btn" onClick={()=>{onSelect('');setEditing(false);}}><X size={18}/></button></div>
      <form onSubmit={e=>{e.preventDefault();run('estimate.save',{estimate:{...estimate,projectId:chosen.id,crewReference:2}},state=>({...state,estimates:[...state.estimates.filter(x=>String(x.projectId)!==String(chosen.id)),{...estimate,projectId:chosen.id,crewReference:2}]}),'Tiempo guardado.');}}>
        <div className="inline-note"><UsersRound size={18}/> Equipo de referencia: <strong>2 personas</strong></div>
        <div className="form-two"><label className="field">Cantidad de tiempo<input type="number" min="0.1" max="100000" step="0.1" required value={estimate.value} onChange={e=>setEstimate(v=>({...v,value:e.target.value}))} placeholder="Ej. 12"/></label><label className="field">Unidad<select value={estimate.unit} onChange={e=>setEstimate(v=>({...v,unit:e.target.value}))}><option value="horas">Horas</option><option value="dias">Días (6 h estándar)</option></select></label></div>
        <label className="switch-line"><input type="checkbox" checked={!!estimate.outsourced} onChange={e=>setEstimate(v=>({...v,outsourced:e.target.checked}))}/><span><strong>Obra tercerizada</strong><small>No utiliza capacidad del equipo interno</small></span></label>
        <label className="field">Dirección de colocación (se carga aquí, NO en el Excel)
          <input type="text" maxLength="400" value={estimate.address||''} onChange={e=>setEstimate(v=>({...v,address:e.target.value}))} placeholder="Calle, altura, ciudad, provincia"/>
          {chosen.localidad&&<small className="muted block">Localidad indicada por el origen: {chosen.localidad}. Completá la dirección exacta para futura logística.</small>}
        </label>
        {estimate.address&&<a className="btn secondary" href={'https://www.google.com/maps/search/?api=1&query='+encodeURIComponent(estimate.address+', Tucumán, Argentina')} target="_blank" rel="noopener noreferrer"><MapPin size={15}/> Ver dirección en Google Maps (consulta manual)</a>}
        <label className="field">Observaciones<textarea rows="3" value={estimate.notes} onChange={e=>setEstimate(v=>({...v,notes:e.target.value}))} placeholder="Detalles del trabajo o condiciones especiales…"/></label>
        <div className="calc-card"><span className="eyebrow">CONVERSIÓN AUTOMÁTICA</span><div className="result-large">{formatNumber(personHours)} <small>horas-persona</small></div><div className="team-tabs"><span>Equipo de simulación</span><select value={crew} onChange={e=>setCrew(Number(e.target.value))}>{[1,2,3,4,5,6,7,8].map(n=><option value={n} key={n}>{n} {n===1?'persona':'personas'}</option>)}</select></div><div className="calc-result">Duración teórica con {crew} personas <b>{formatNumber(estimateCrewHours(estimate.value,estimate.unit,crew))} horas</b></div></div>
        {canEdit(actor)&&<button className="btn primary full" type="submit" disabled={!Number(estimate.value)||Number(estimate.value)<=0}><Save size={17}/> Guardar tiempo de obra</button>}
      </form></>:<div className="selection-placeholder"><div className="illustration-mark"><Timer size={40}/></div><h2>Elegí una obra</h2><p>Podrás indicar horas o días, calcular el esfuerzo para distintos tamaños de equipo y marcar si se terceriza.</p></div>}</div></div>
    <div className="panel margin-top"><div className="panel-heading"><div><h2>Resumen de estimaciones</h2><p>Tiempos guardados para cada obra.</p></div></div><ProjectTable projects={sortProjects(data.projects)} estimates={data.estimates} compact onEstimate={canEdit(actor)?(p)=>onSelect(p.id):null}/></div>
  </>;
}
function CalendarPage({data,actor,run}) {
  const [week,setWeek]=useState(data.week?.length?data.week:WEEK);
  const [holiday,setHoliday]=useState({date:'',label:'',kind:'manual',active:true});
  const [recess,setRecess]=useState({start:'',end:'',projectId:'',note:''});
  const [event,setEvent]=useState({projectId:'',date:'',start:'08:00',end:'10:00',people:2});
  const [year,setYear]=useState(2026);
  useEffect(()=>setWeek(data.week?.length?data.week:WEEK),[data.week]);
  const cap=weeklyCapacity(week,data.teamSize);
  const patch=(d,key,value)=>setWeek(prev=>prev.map(w=>Number(w.day)===Number(d)?{...w,[key]:value}:w));
  return <>
    <SectionHead eyebrow="DISPONIBILIDAD REAL" title="Calendario laboral" sub="Definí días, horarios, pausas, feriados y recesos. La capacidad se calcula con horas puras."/>
    <div className="metrics-grid two"><Metric icon={Clock3} label="Horas por persona" value={`${formatNumber(weeklyCapacity(week,1))} h`} hint="Semana sin feriados"/><Metric icon={UsersRound} label="Capacidad del equipo" value={`${formatNumber(cap)} h`} hint={`${data.teamSize} integrantes · sin ausencias individuales`} tone="green"/></div>
    <div className="panel margin-top"><div className="panel-heading"><div><h2>Jornada semanal</h2><p>El tiempo de pausa no cuenta como trabajo productivo.</p></div>{canAdmin(actor)&&<button className="btn primary" onClick={()=>run('calendar.save',{week},state=>({...state,week}),'Jornada actualizada.')}><Save size={16}/> Guardar jornada</button>}</div><div className="table-wrap"><table className="week-table"><thead><tr><th>Día</th><th>Activo</th><th>Entrada</th><th>Salida</th><th>Inicio pausa</th><th>Fin pausa</th><th>Horas puras</th><th>Capacidad</th></tr></thead><tbody>{[...week].sort((a,b)=>(Number(a.day)||7)-(Number(b.day)||7)).map(w=>{
      const enabled=w.enabled===true||String(w.enabled)==='true';
      const available=enabled?Math.max(0,Math.min(Number(w.target)||0,((timeMinutes(w.end)-timeMinutes(w.start))-(w.breakStart&&w.breakEnd?Math.max(0,timeMinutes(w.breakEnd)-timeMinutes(w.breakStart)):0))/60)):0;
      return <tr key={w.day}><td><strong>{w.name}</strong></td><td><input aria-label={'Activar '+w.name} type="checkbox" disabled={!canAdmin(actor)} checked={enabled} onChange={e=>patch(w.day,'enabled',e.target.checked)}/></td>{['start','end','breakStart','breakEnd'].map(k=><td key={k}><input aria-label={k+' '+w.name} className="time-input" type="time" disabled={!canAdmin(actor)||!enabled} value={w[k]||''} onChange={e=>patch(w.day,k,e.target.value)}/></td>)}<td><input aria-label={'Horas puras '+w.name} className="hours-input" type="number" min="0" step="0.5" disabled={!canAdmin(actor)||!enabled} value={Number(w.target)||0} onChange={e=>patch(w.day,'target',e.target.value)}/></td><td><strong>{formatNumber(available)} h</strong></td></tr>;
    })}</tbody></table></div></div>
    <div className="split-panels margin-top"><div className="panel"><div className="panel-heading"><div><h2>Feriados / días no laborables</h2><p>Precarga editable; incluye cargas manuales.</p></div></div>{canAdmin(actor)&&<><div className="import-bottom compact"><select aria-label="Año de precarga" value={year} onChange={e=>setYear(Number(e.target.value))}>{[2025,2026].map(y=><option key={y} value={y}>{y}</option>)}</select><button className="btn secondary" onClick={()=>run('holiday.sync',{year},null,'Feriados consultados. Revisalos antes de planificar.')}><RefreshCw size={15}/> Precargar feriados de Argentina</button></div><small className="muted block">Fuente: ArgentinaDatos (no oficial). Verificar con el calendario nacional.</small><form className="compact-form" onSubmit={e=>{e.preventDefault();run('holiday.save',{holiday},state=>({...state,holidays:[...state.holidays.filter(h=>h.date!==holiday.date),holiday]}),'Día bloqueado guardado.');setHoliday({date:'',label:'',kind:'manual',active:true});}}><input aria-label="Fecha feriado" type="date" required value={holiday.date} onChange={e=>setHoliday(v=>({...v,date:e.target.value}))}/><input aria-label="Motivo del feriado" required placeholder="Feriado / motivo" value={holiday.label} onChange={e=>setHoliday(v=>({...v,label:e.target.value}))}/><button className="btn primary" type="submit"><Plus size={16}/></button></form></>}
      <div className="list-compact">{[...data.holidays].sort((a,b)=>a.date.localeCompare(b.date)).slice(0,30).map(h=><div className="compact-row" key={h.date}><span><b>{strDate(h.date)}</b> · {h.label}</span>{canAdmin(actor)?<label className="toggle-sm"><input type="checkbox" checked={h.active===true||String(h.active)==='true'} onChange={e=>run('holiday.save',{holiday:{...h,active:e.target.checked}},state=>({...state,holidays:state.holidays.map(x=>x.date===h.date?{...x,active:e.target.checked}:x)}),'Feriado actualizado.')}/></label>:<Pill>{h.active?'Activo':'Excluido'}</Pill>}</div>)}{!data.holidays.length&&<p className="muted">Todavía no se cargaron feriados.</p>}</div>
    </div><div className="panel"><div className="panel-heading"><div><h2>Recesos</h2><p>Bloqueos para todas las obras o para una obra puntual.</p></div></div>{canEdit(actor)&&<form onSubmit={e=>{e.preventDefault();run('recess.save',{recess},state=>({...state,recesses:[...state.recesses,{...recess,id:crypto.randomUUID()}]}),'Receso guardado.');setRecess({start:'',end:'',projectId:'',note:''});}}><div className="form-two"><label className="field">Desde<input type="date" value={recess.start} required onChange={e=>setRecess(v=>({...v,start:e.target.value}))}/></label><label className="field">Hasta<input type="date" value={recess.end} required min={recess.start} onChange={e=>setRecess(v=>({...v,end:e.target.value}))}/></label></div><label className="field">Aplicar a<select value={recess.projectId} onChange={e=>setRecess(v=>({...v,projectId:e.target.value}))}><option value="">Todas las obras</option>{sortProjects(data.projects).map(p=><option value={p.id} key={p.id}>{p.numero} · {p.proyecto}</option>)}</select></label><div className="compact-form"><input aria-label="Motivo de receso" placeholder="Motivo (opcional)" value={recess.note} onChange={e=>setRecess(v=>({...v,note:e.target.value}))}/><button type="submit" className="btn primary"><Plus size={16}/> Agregar</button></div></form>}
      <div className="list-compact">{data.recesses.map(r=><div className="compact-row" key={r.id}><span><b>{strDate(r.start)} al {strDate(r.end)}</b><small className="block muted">{r.projectId ? (data.projects.find(p=>String(p.id)===String(r.projectId))?.numero||'Obra'):'Todas las obras'} {r.note&&'· '+r.note}</small></span>{canEdit(actor)&&<button className="icon-btn" aria-label="Eliminar receso" onClick={()=>{if(window.confirm('¿Eliminar este receso?'))run('recess.delete',{id:r.id},state=>({...state,recesses:state.recesses.filter(x=>x.id!==r.id)}),'Receso eliminado.');}}><X size={16}/></button>}</div>)}{!data.recesses.length&&<p className="muted">No hay recesos definidos.</p>}</div>
    </div></div>
    <div className="panel margin-top"><div className="panel-heading"><div><h2>Eventos en Google Calendar</h2><p>Crear eventos puntuales vinculados con una obra en el calendario de la organización.</p></div><Pill tone="violet">Integración Calendar</Pill></div><form className="events-form" onSubmit={e=>{e.preventDefault();if(!countDailyHours(event.date,data.week,data.holidays,data.recesses,event.projectId)){window.dispatchEvent(new CustomEvent('obra-error',{detail:'El día no está disponible según el calendario laboral.'}));return;}run('event.create',{event},state=>({...state,events:[...state.events,{...event,id:crypto.randomUUID(),title:'Obra '+(data.projects.find(p=>String(p.id)===String(event.projectId))?.numero||'')}] }),'Evento creado.');}}>
      <label className="field grow">Obra<select value={event.projectId} required onChange={e=>setEvent(v=>({...v,projectId:e.target.value}))}><option value="">Elegir obra</option>{sortProjects(data.projects).map(p=><option key={p.id} value={p.id}>{p.numero} · {p.proyecto}</option>)}</select></label><label className="field">Fecha<input type="date" required value={event.date} onChange={e=>setEvent(v=>({...v,date:e.target.value}))}/></label><label className="field">Desde<input type="time" value={event.start} onChange={e=>setEvent(v=>({...v,start:e.target.value}))}/></label><label className="field">Hasta<input type="time" value={event.end} onChange={e=>setEvent(v=>({...v,end:e.target.value}))}/></label><label className="field narrow">Personas<input type="number" min="1" max="100" value={event.people} onChange={e=>setEvent(v=>({...v,people:Number(e.target.value)}))}/></label><button type="submit" className="btn primary align-end" disabled={!canEdit(actor)}><CalendarPlus size={16}/> Crear</button>
    </form>{isDemo&&<Notice>En demo los eventos solo se simulan en este navegador; no se publican en Google Calendar.</Notice>}
    <div className="list-compact">{data.events.slice(-8).reverse().map(ev=><div className="compact-row" key={ev.id}><span><b>{ev.title}</b> · {strDate(ev.date)} · {ev.start}–{ev.end}</span><span className="muted">{ev.people} pers.</span></div>)}{!data.events.length&&<p className="muted">Aún no creaste eventos.</p>}</div>
    </div>
  </>;
}
const timeMinutes=s=>{const m=/^(\d{2}):(\d{2})$/.exec(s||'');return m?Number(m[1])*60+Number(m[2]):0;};
function Users({data,actor,run}) {
  const blank=()=>({username:'',name:'',password:'',role:'PLANIFICADOR',active:true});
  const [form,setForm]=useState(blank);
  const [editingUsername,setEditingUsername]=useState(null);
  const existing=editingUsername!==null;
  return <><SectionHead eyebrow="SEGURIDAD Y PERMISOS" title="Usuarios" sub="Solo los usuarios habilitados pueden ingresar. El superadministrador administra cuentas y permisos."/>
    {actor.role==='SUPERADMIN'&&<div className="panel" id="users-editor"><div className="panel-heading"><div><h2>Agregar o actualizar usuario</h2><p>Elegí «Editar» para cambiar la clave de una cuenta. Dejala vacía si no querés cambiarla. Se acepta desde 1 carácter, aunque se recomienda una clave más larga.</p></div></div>
      <form className="events-form" onSubmit={async e=>{e.preventDefault();const saved=await run('user.save',{user:form},null,'Usuario guardado.');if(saved){setForm(blank());setEditingUsername(null);}}}>
        <label className="field grow">Usuario<input required minLength="3" maxLength="32" pattern="[a-zA-Z0-9._-]{3,32}" disabled={existing} autoCapitalize="none" value={form.username} onChange={e=>setForm(v=>({...v,username:e.target.value.toLowerCase()}))} placeholder="ej. juan.perez"/></label>
        <label className="field grow">Nombre<input required value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))}/></label>
        <label className="field grow">{existing?`Nueva contraseña para ${editingUsername} (opcional)`:'Contraseña'}<input type="password" autoComplete="new-password" required={!existing} minLength="1" maxLength="200" value={form.password} onChange={e=>setForm(v=>({...v,password:e.target.value}))} placeholder={existing?'Dejar vacía para mantener':'Desde 1 carácter (menos seguro)'}/></label>
        <label className="field">Rol<select value={form.role} onChange={e=>setForm(v=>({...v,role:e.target.value}))}>{['ADMIN','PLANIFICADOR','LECTOR','SUPERADMIN'].map(r=><option key={r}>{r}</option>)}</select></label>
        <label className="field">Estado<select value={String(form.active)} onChange={e=>setForm(v=>({...v,active:e.target.value==='true'}))}><option value="true">Activo</option><option value="false">Inactivo</option></select></label>
        <button className="btn primary align-end" type="submit"><Plus size={16}/> Guardar</button>
        {existing&&<button className="btn secondary align-end" type="button" onClick={()=>{setForm(blank());setEditingUsername(null);}}>Cancelar edición</button>}
      </form></div>}
    <div className="panel margin-top"><div className="panel-heading"><div><h2>Usuarios autorizados</h2><p>{data.users.length} usuarios registrados</p></div></div><div className="table-wrap"><table><thead><tr><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Estado</th>{actor.role==='SUPERADMIN'&&<th className="right">Acción</th>}</tr></thead><tbody>{data.users.map(u=><tr key={u.username}><td><strong>{u.name}</strong></td><td>{u.username||'Sin usuario asignado'}</td><td><Pill tone={u.role==='SUPERADMIN'?'violet':'slate'}>{u.role}</Pill></td><td><Pill tone={u.active===true||String(u.active)==='true'?'green':'amber'}>{u.active===true||String(u.active)==='true'?'Activo':'Inactivo'}</Pill></td>{actor.role==='SUPERADMIN'&&<td className="right"><button className="btn tiny secondary" title="Editar usuario o cambiar su contraseña" disabled={!u.username} onClick={()=>{setEditingUsername(u.username);setForm({username:u.username,name:u.name,role:u.role,active:u.active===true||String(u.active)==='true',password:''});document.getElementById('users-editor')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Editar / clave</button></td>}</tr>)}</tbody></table></div>{!data.users.length&&<Empty title="Sin usuarios para mostrar" desc="No hay usuarios habilitados todavía."/>}</div>
  </>;
}
function Help({go}) {return <><SectionHead eyebrow="DOCUMENTACIÓN INTEGRADA" title="Cómo funciona" sub="Reglas de negocio y recorrido de uso de ObraTiempo. El mismo detalle está en README.md."/>
    <div className="help-layout"><div className="panel help-content"><h2>1. Importación de proyectos</h2><p>La pestaña <b>proyecto</b> recibe una obra por cada <b>Project ID</b> (o Numero, si falta el ID). El formato nuevo tiene una fila por obra (Estado, Numero, Nombre); el formato anterior podía traer varios artículos por obra, que se consolidan sin duplicarlos. La pantalla no permite modificar los datos originales y las importaciones no borran tiempos previamente cargados.</p><p>Se excluyen los estados generales cerrados o terminados (por ejemplo, Terminado y Cancelado). <b>Producido = Completa</b> o <b>Entrega = Completa</b> no implica cierre si el estado general sigue activo.</p>
    <h2>2. Fecha que manda</h2><p>Para ordenar obras se utiliza <b>Inicio</b> cuando existe; de lo contrario se utiliza <b>Inicio P.</b>. Las obras se muestran en orden cronológico ascendente. Las obras sin ninguna de las dos fechas quedan al final.</p>
    <h2>3. Tiempos de obra</h2><p>El usuario carga horas o días para un equipo de referencia de <b>2 personas</b>. Un día estimado representa convencionalmente <b>6 horas</b> por persona, aunque los viernes tienen 5 horas disponibles al programar.</p><div className="doc-formula">Horas-persona = Cantidad × (horas por día, si corresponde) × 2<br/>Duración teórica = Horas-persona ÷ Personas asignadas</div><p>Ejemplo: 10 horas para dos personas = 20 horas-persona. Con tres personas serían 6,67 horas de reloj, <b>si el trabajo se puede dividir proporcionalmente</b>.</p>
    <h2>4. Calendario disponible</h2><p>La jornada base es de 6 horas puras de lunes a jueves y 5 los viernes: <b>29 horas por persona por semana</b>. El administrador modifica horarios y pausas. Los feriados bloqueados y los recesos generales o por obra descuentan disponibilidad.</p><p>La API de ArgentinaDatos permite precargar feriados hasta 2026, pero es una fuente <b>no oficial</b>. Todos pueden revisarse y los futuros cargarse manualmente.</p>
    <h2>5. Tercerización</h2><p>Una obra tercerizada conserva su tiempo estimado y su historial, pero <b>no consume capacidad interna</b> en la planificación. La fecha comprometida con el tercero se administrará en una etapa posterior.</p>
    <h2>6. Seguridad y Calendar</h2><p>Roles: SUPERADMIN, ADMIN, PLANIFICADOR y LECTOR. Apps Script valida usuario, token vigente y rol en cada solicitud. El token se guarda en el navegador durante 30 días o hasta cerrar sesión. Google Calendar crea eventos en el calendario configurado en Apps Script, sujeto a los días laborables y bloqueos.</p>
    <h2>7. Capacidad y Gantt mensual (vista previa)</h2><p>La pantalla Capacidad y Gantt permite simular equipos, refuerzos, bajas, asignaciones simultáneas y tercerización, sin limitar la ocupación al 100%. Ocupación mensual = horas-persona programadas en el mes / capacidad disponible del mes. Las obras sin estimación o sin fecha de asignación no se incluyen todavía. La dirección se carga con el tiempo de colocación y no modifica la hoja proyecto. Personal y asignaciones se guardan localmente durante esta fase UX, no en Apps Script. Los kilómetros, traslados reales y fechas comprometidas se agregarán después.</p>
    <h2>8. Cubitos, backlog y personal auxiliar (v0.5)</h2><p>Cada cubito es una tarea individual movible en el futuro. Lo que quedó programado en el pasado es solo lectura y no se supone ejecutado. Pueden crearse tareas extra y guardar saldos pendientes en backlog si llueve o se finaliza solo parcialmente. Tocá el día del Gantt para ver ocupación y personas de cada equipo. Los auxiliares de Producción se incorporan a Colocación únicamente en las fechas solicitadas. Las obras del grupo <b>Retiro en Abalum</b> quedan fuera de la planificación. Todo el módulo de tareas sigue guardado solo en el navegador y no está sincronizado con Apps Script.</p>
    </div><div className="help-side"><div className="panel"><div className="panel-heading"><h2>Ruta recomendada</h2></div><div className="steps"><div><b>01</b><span>Importar proyectos</span></div><div><b>02</b><span>Estimar tiempo por obra</span></div><div><b>03</b><span>Definir equipo y jornadas</span></div><div><b>04</b><span>Cargar feriados y recesos</span></div><div><b>05</b><span>Crear eventos y planificar</span></div></div><button className="btn primary full" onClick={()=>go('projects')}>Ir a proyectos <ArrowRight size={16}/></button></div><div className="panel"><div className="panel-heading"><h2>Archivos del proyecto</h2></div><p className="muted">README.md explica el uso. README_AI.md contiene las convenciones técnicas para próximas modificaciones.</p><Pill tone="blue">React + Vite + Apps Script</Pill></div></div></div>
  </>;}
function App() {
  const [screen,setScreen]=useState('planning');const [menuOpen,setMenuOpen]=useState(false);
  const [data,setData]=useState(()=>isDemo?readDemo():EMPTY);
  const [token,setToken]=useState(()=>isDemo?'':localStorage.getItem('obras-session-token')||'');
  const [actor,setActor]=useState(()=>isDemo?{username:'admin',name:'Administrador de demostración',role:'SUPERADMIN'}:null);
  const [busy,setBusy]=useState(false);const [toast,setToast]=useState(null);const [selectedProject,setSelectedProject]=useState('');
  const showToast=useCallback((message,type='success')=>setToast({message,type}),[]);
  useEffect(()=>{if(!toast)return;const t=setTimeout(()=>setToast(null),5500);return()=>clearTimeout(t);},[toast]);
  useEffect(()=>{const fn=e=>showToast(e.detail,'danger');window.addEventListener('obra-error',fn);return()=>window.removeEventListener('obra-error',fn);},[showToast]);
  useEffect(()=>{if(isDemo)saveDemo(data);},[data]);
  const reload=useCallback(async(tok=token)=>{
    if(isDemo)return;
    setBusy(true);
    try {const fresh=await request('bootstrap',tok);setData(fresh);setActor(fresh.actor);return true;}
    catch(e){showToast(e.message,'danger');if(e.code==='AUTH_REQUIRED'){localStorage.removeItem('obras-session-token');setToken('');setActor(null);}return false;}
    finally{setBusy(false);}
  },[token,showToast]);
  useEffect(()=>{if(!isDemo && token)reload(token);},[token,reload]);
  const onLogin=useCallback(async(username,password)=>{const result=await request('auth.login',null,{username,password});localStorage.setItem('obras-session-token',result.token);setToken(result.token);setActor(result.actor);},[]);
  const logOut=()=>{const old=token;localStorage.removeItem('obras-session-token');setToken('');setActor(null);setData(EMPTY);request('auth.logout',old).catch(()=>{});};
  const run=async(action,payload,localChange,success)=>{
    if(isDemo){
      if(action==='project.refresh' || action==='project.importSheet' || action==='project.uploadExcel' || action==='holiday.sync'){
        showToast('Esta acción requiere conectar Apps Script. En demo no se importa información real.','danger');return false;
      }
      if(action==='team.save')localChange=s=>({...s,teamSize:Number(payload.teamSize)});
      if(localChange)setData(current=>localChange(current));
      showToast(success||'Cambio guardado en demo.');return true;
    }
    setBusy(true);
    try {await request(action,token,payload);const activeSession=await reload(token);if(activeSession===false)return false;showToast(success||'Guardado correctamente.');return true;}
    catch(e){showToast(e.message,'danger');if(e.code==='AUTH_REQUIRED'){localStorage.removeItem('obras-session-token');setToken('');setActor(null);}return false;}
    finally{setBusy(false);}
  };
  const go=target=>{setScreen(target);setMenuOpen(false);window.scrollTo({top:0,behavior:'smooth'});};
  const selectEstimate=p=>{setSelectedProject(p.id);go('times');};
  const [teamEdit,setTeamEdit]=useState('3');
  useEffect(()=>setTeamEdit(String(data.teamSize||3)),[data.teamSize]);
  if(!isDemo && !actor)return <><Login onLogin={onLogin}/>{busy&&<div className="loading-overlay">Verificando acceso…</div>}{toast&&<div className={'toast '+toast.type}>{toast.message}</div>}</>;
  const visibleNav=NAV.filter(x=>x.id!=='users'||canAdmin(actor));
  const page={
    dashboard:<Dashboard data={data} go={go}/>,
    projects:<Projects data={data} actor={actor} run={run} go={go} onEstimate={selectEstimate}/>,
    times:<Times data={data} actor={actor} run={run} selection={selectedProject} onSelect={setSelectedProject}/>,
    calendar:<CalendarPage data={data} actor={actor} run={run}/>,
    planning:<CapacityStudio data={data} go={go} run={run}/>,
    users:<Users data={data} actor={actor} run={run}/>,
    help:<Help go={go}/>
  };
  return <div className="shell">
    <aside className={'sidebar '+(menuOpen?'open':'')}><div className="brand"><div className="brand-mark"><HardHat size={23}/></div><div><strong>ABALUM</strong><small>OBRATIEMPO · PLANIFICACIÓN</small></div></div>
      <div className="nav-category">ESPACIO DE TRABAJO</div><nav aria-label="Navegación principal">{visibleNav.map(item=><button key={item.id} className={'nav-item '+(screen===item.id?'active':'')} aria-current={screen===item.id?'page':undefined} onClick={()=>go(item.id)}><item.icon size={19}/>{item.label}{screen===item.id&&<ChevronRight size={15} className="nav-chevron"/>}</button>)}</nav>
      <div className="sidebar-bottom"><div className="sidebar-box"><div className="sidebar-box-icon"><ShieldCheck size={19}/></div><strong>{isDemo?'Versión demostración':'Conexión protegida'}</strong><p>{isDemo?'Datos ficticios. No modifica Google Sheets.':'Información centralizada en Google Sheets.'}</p></div><div className="account"><div className="avatar">{(actor?.name||'A').charAt(0).toUpperCase()}</div><div className="account-info"><strong>{actor?.name||'Usuario'}</strong><small>{actor?.role||''}</small></div>{!isDemo&&<button className="logout" aria-label="Cerrar sesión" title="Cerrar sesión" onClick={logOut}><LogOut size={17}/></button>}</div></div>
    </aside>
    {menuOpen&&<button className="mobile-overlay" aria-label="Cerrar menú" onClick={()=>setMenuOpen(false)}/>}
    <div className="main-layout"><header className="topbar"><div className="topbar-left"><button className="menu-toggle" aria-label="Abrir menú" onClick={()=>setMenuOpen(true)}><Menu size={22}/></button><span>Gestión de tiempo</span><ChevronRight size={14}/><b>{NAV.find(x=>x.id===screen)?.label}</b></div><div className="topbar-right">{isDemo&&<Pill tone="amber">Modo demo</Pill>}<span className="online"><span/> {isDemo?'Local':'Conectado'}</span><button className="btn tiny secondary" onClick={()=>go('planning')}><UsersRound size={15}/> Planificar equipos</button></div></header>
    <main className="content" id="main-content">{page[screen]}</main><footer className="footer"><span>ABALUM · ObraTiempo v0.5 · UX de tareas</span><span>Gestión de tiempos y capacidad · <button onClick={()=>go('help')}>Documentación</button></span></footer></div>
    {busy&&<div className="loading-overlay" role="status"><RefreshCw size={22} className="spin"/> Procesando…</div>}
    {toast&&<div role="alert" className={'toast '+toast.type}><span>{toast.message}</span><button onClick={()=>setToast(null)} aria-label="Cerrar aviso"><X size={16}/></button></div>}
  </div>;
}
export default App;
