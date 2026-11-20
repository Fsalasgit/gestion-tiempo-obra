import React,{useEffect,useState} from 'react';
import {HardHat,LogOut,RefreshCw,Search,ShieldCheck} from 'lucide-react';
import ProjectGantt from './components/ProjectGantt.jsx';
import {request} from './lib/api.js';
import './clientPortal.css';

const TOKEN_KEY='obras-cliente-token';
const EMPTY_DOC={tasks:[],sectors:[],projectMeta:{}};

/** Portal independiente: nunca obtiene workspace.load ni bootstrap. El backend filtra por usuario. */
export default function ClientPortal(){
 const [token,setToken]=useState(()=>localStorage.getItem(TOKEN_KEY)||'');
 const [username,setUsername]=useState('');
 const [password,setPassword]=useState('');
 const [actor,setActor]=useState(null);
 const [projects,setProjects]=useState([]);
 const [projectId,setProjectId]=useState('');
 const [details,setDetails]=useState(null);
 const [query,setQuery]=useState('');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [reloadCount,setReloadCount]=useState(0);
 const [version,setVersion]=useState(0);
 const logout=()=>{
  const old=token;
  localStorage.removeItem(TOKEN_KEY);setToken('');setActor(null);setProjects([]);setProjectId('');setDetails(null);setError('');
  if(old)void request('auth.logout',old).catch(()=>{});
 };
 const signIn=async e=>{
  e.preventDefault();setBusy(true);setError('');
  try{
   const result=await request('auth.login',null,{username,password});
   if(result.actor?.role!=='CLIENTE'){
    void request('auth.logout',result.token).catch(()=>{});
    throw Error('Este acceso es solo para clientes. Para personal de ABALUM utilizá el ingreso principal.');
   }
   localStorage.setItem(TOKEN_KEY,result.token);
   setActor(result.actor);setToken(result.token);setPassword('');
  }catch(err){setError(err.message);}finally{setBusy(false);}
 };
 useEffect(()=>{
  if(!token)return;
  let alive=true;
  setBusy(true);setError('');
  request('client.list',token).then(list=>{
   if(!alive)return;
   setProjects(Array.isArray(list)?list:[]);
   setProjectId(old=>(list||[]).some(p=>String(p.id)===String(old))?old:String(list?.[0]?.id||''));
  }).catch(err=>{
   if(!alive)return;
   setError(err.message);
   if(err.code==='AUTH_REQUIRED'||/autorizaci[oó]n|permiso|cliente/i.test(err.message)){localStorage.removeItem(TOKEN_KEY);setToken('');}
  }).finally(()=>{if(alive)setBusy(false);});
  return()=>{alive=false;};
 },[token,reloadCount]);
 useEffect(()=>{
  if(!projectId||!token){setDetails(null);return;}
  let alive=true;
  setBusy(true);setError('');
  request('client.project',token,{projectId}).then(result=>{
   if(alive){setDetails(result);setVersion(v=>v+1);}
  }).catch(err=>{if(alive){setDetails(null);setError(err.message);}}).finally(()=>{if(alive)setBusy(false);});
  return()=>{alive=false;};
 },[token,projectId,reloadCount]);
 const filtered=projects.filter(p=>`${p.numero} ${p.proyecto} ${p.cliente}`.toLocaleLowerCase('es').includes(query.toLocaleLowerCase('es')));
 if(!token)return <main className="cp-auth"><form className="cp-login" onSubmit={signIn}>
  <div className="cp-mark"><HardHat size={28}/></div><span className="cp-eyebrow">ABALUM · PORTAL DE CLIENTES</span>
  <h1>Seguimiento de tu obra</h1><p>Consultá las tareas planificadas, avances y novedades de los proyectos habilitados para tu cuenta.</p>
  <label>Usuario<input required autoComplete="username" autoCapitalize="none" value={username} onChange={e=>setUsername(e.target.value)}/></label>
  <label>Contraseña<input required type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
  {error&&<p role="alert" className="cp-error">{error}</p>}
  <button type="submit" disabled={busy}>{busy?'Ingresando…':'Entrar al portal'}</button>
  <a href="/">Ingreso para personal de ABALUM</a>
 </form></main>;
 return <div className="cp-root"><header className="cp-header"><div className="cp-brand"><span className="cp-mark"><HardHat size={21}/></span><div><strong>ABALUM</strong><small>Seguimiento de obras</small></div></div><div className="cp-session"><span><ShieldCheck size={15}/> Acceso privado</span><button onClick={()=>setReloadCount(n=>n+1)} title="Actualizar avances" disabled={busy}><RefreshCw size={16}/> Actualizar</button><button onClick={logout}><LogOut size={16}/> Salir</button></div></header>
  <main className="cp-main"><div className="cp-welcome"><div><span className="cp-eyebrow">CONSULTA DE PROYECTOS</span><h1>{actor?.name||'Mis proyectos'}</h1><p>Las fechas son previsiones de trabajo. El avance se informa por ABALUM.</p></div></div>
   <div className="cp-select"><label htmlFor="cp-filter">Buscar entre mis obras</label><div className="cp-search"><Search size={17}/><input id="cp-filter" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Número o nombre de obra"/></div><div className="cp-projects">{filtered.map(p=><button key={p.id} className={String(projectId)===String(p.id)?'selected':''} onClick={()=>setProjectId(String(p.id))}><strong>{p.numero||'Obra'} · {p.proyecto||'Sin título'}</strong><small>{p.estado||'En seguimiento'}</small></button>)}{!filtered.length&&<p>No hay obras disponibles para esta búsqueda.</p>}</div></div>
   {error&&<p role="alert" className="cp-error">{error}</p>}
   {busy&&<p role="status" className="cp-loading">Actualizando información de obra…</p>}
   {details&&String(details.project?.id)===String(projectId)&&<ProjectGantt key={`${projectId}-${version}`} data={{projects:[details.project],week:details.calendar?.week||[],holidays:details.calendar?.holidays||[],recesses:details.calendar?.recesses||[]}} doc={{...EMPTY_DOC,tasks:details.tasks||[],sectors:details.sectors||[]}} capacityData={{teams:details.teams||[],specialDays:details.specialDays||[]}} fixedProjectId={projectId} editable={false} embeddedClient/>}
   {!busy&&!details&&!error&&<div className="cp-empty">Esta obra todavía no tiene tareas publicadas.</div>}
  </main><footer className="cp-footer">ABALUM · Portal de seguimiento · Acceso limitado a los proyectos autorizados</footer>
 </div>;
}
