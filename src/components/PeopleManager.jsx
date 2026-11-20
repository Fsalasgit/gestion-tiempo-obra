import React,{useState} from 'react';
import {CalendarPlus,Check,Edit3,Plus,UserMinus,UserPlus,X} from 'lucide-react';
import {dateISO,activePeople} from '../lib/planner.js';
import {changeMemberTeam,archiveMember} from '../lib/workBlocks.js';
import {teamColor,rgbaColor,DEFAULT_TEAM_COLORS} from '../lib/taskPlanning.js';

const id=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const today=()=>dateISO(new Date());
const emptyMember=()=>({name:'',kind:'fijo',teamId:'',start:today(),end:''});
const fmt=x=>x?x.split('-').reverse().join('/'):'—';

function toRgb(color){const m=String(color||'').match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?/);return m?{r:+m[1],g:+m[2],b:+m[3],a:m[4]===undefined?1:Number(m[4])}:{r:201,g:35,b:59,a:1};}
function toHex(c){return '#'+[c.r,c.g,c.b].map(n=>Math.round(n).toString(16).padStart(2,'0')).join('');}
function TeamColorModal({team,onSave,onClose}){
 const initial=toRgb(team.color);
 const [name,setName]=useState(team.name||'');
 const [rgb,setRgb]=useState(initial);
 const color=rgbaColor(rgb.r,rgb.g,rgb.b,rgb.a);
 return <div className="cap-modal-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}>
   <section className="cap-modal cap-color-dialog" role="dialog" aria-modal="true" aria-label="Color y nombre del equipo">
    <div className="cap-modal-head"><div><h2>{team.id?'Editar equipo':'Crear equipo'}</h2><p>Elegí un color para identificar sus tareas en el Gantt.</p></div><button type="button" className="cap-icon-button" onClick={onClose} aria-label="Cerrar"><X size={18}/></button></div>
    <label className="cap-color-name">Nombre del equipo<input required autoFocus value={name} onChange={e=>setName(e.target.value)}/></label>
    <div className="cap-color-preview" style={{background:color}}><strong>{name||'Vista previa del equipo'}</strong><span>{color}</span></div>
    <div className="cap-palette" aria-label="Paleta de colores sugeridos">{DEFAULT_TEAM_COLORS.map((c,i)=><button type="button" key={i} aria-label={`Seleccionar color ${i+1}`} title={c} style={{background:c}} onClick={()=>setRgb(toRgb(c))}/>)}</div>
    <div className="cap-color-controls"><label>Color personalizado<input type="color" value={toHex(rgb)} onChange={e=>{const h=e.target.value;setRgb(old=>({...old,r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}));}}/></label><label>Opacidad RGBA · {Math.round(rgb.a*100)}%<input type="range" min="0.35" max="1" step="0.05" value={rgb.a} onChange={e=>setRgb(old=>({...old,a:Number(e.target.value)}))}/></label></div>
    <div className="cap-modal-actions"><button type="button" className="cap-btn" onClick={onClose}>Cancelar</button><button type="button" className="cap-btn primary" disabled={!name.trim()} onClick={()=>onSave({name:name.trim(),color})}>Guardar equipo</button></div>
   </section>
  </div>;
}
export default function PeopleManager({store,setStore}){
 const [colorTeam,setColorTeam]=useState(null);
 const [rename,setRename]=useState(null);
 const [member,setMember]=useState(emptyMember);
 const [editId,setEditId]=useState(null);
 const [absence,setAbsence]=useState({memberId:'',start:today(),end:today(),reason:'Accidente / licencia'});
 const [support,setSupport]=useState({memberId:'',teamId:store.teams[0]?.id||'',date:today()});
 const updateMember=e=>{e.preventDefault();if(!member.name.trim()||member.end&&member.end<member.start)return;
  setStore(s=>({...s,members:editId?s.members.map(m=>{
    if(m.id!==editId)return m;
    const next=member.kind==='auxiliar'?({...m,...member,teamId:'',teamHistory:m.teamHistory}):m.teamId===member.teamId?({...m,...member}):changeMemberTeam({...m,...member,teamId:m.teamId},member.teamId,today());
    return next;
  }):[...s.members,{...member,id:id('M'),active:true,teamId:member.kind==='auxiliar'?'':member.teamId}]}));
  setMember(emptyMember());setEditId(null);
 };
 const archive=m=>{if(!window.confirm(`¿Dar de baja a ${m.name} desde hoy? Se conserva el historial anterior.`))return;
  setStore(s=>({...s,members:s.members.map(x=>x.id===m.id?archiveMember(x):x)}));
  if(editId===m.id){setEditId(null);setMember(emptyMember());}
 };
 const addSupport=e=>{e.preventDefault();if(support.date<today())return;
  if(store.supportShifts?.some(sh=>sh.memberId===support.memberId&&sh.date===support.date)){window.alert('Ese auxiliar ya está solicitado para esa fecha.');return;}
  setStore(s=>({...s,supportShifts:[...(s.supportShifts||[]),{...support,id:id('S')}]}));
 };
 const addAbsence=e=>{e.preventDefault();if(!absence.memberId||absence.start<today()||absence.end<absence.start)return;
  setStore(s=>({...s,absences:[...s.absences,{...absence,id:id('A')}]}));
 };
 const eligible=store.members.filter(m=>m.kind==='auxiliar'&&!m.archivedAt);
 return <div className="cap-people-layout cap-people-v5">
  <div className="cap-panel">
   <div className="cap-intro"><div><h2>Equipos de colocación</h2><p>Podés renombrar equipos, editar operarios y desvincular personas sin borrar el historial.</p></div></div>
   <button className="cap-btn primary" type="button" onClick={()=>setColorTeam({name:'',color:DEFAULT_TEAM_COLORS[store.teams.length%DEFAULT_TEAM_COLORS.length]})}><Plus size={14}/> Nuevo equipo y color</button>
   {store.teams.map(team=><div className="cap-crew-group" key={team.id}><div className="cap-crew-title">
     <span className="cap-team-color-dot" style={{background:teamColor(team,store.teams.indexOf(team))}} aria-hidden="true"/>
     {rename?.id===team.id?<form className="cap-inline-form cap-rename" onSubmit={e=>{e.preventDefault();if(rename.name.trim())setStore(s=>({...s,teams:s.teams.map(t=>t.id===team.id?{...t,name:rename.name.trim()}:t)}));setRename(null);}}><input autoFocus value={rename.name} onChange={e=>setRename(v=>({...v,name:e.target.value}))}/><button className="cap-btn" type="submit"><Check size={14}/></button><button className="cap-btn" type="button" onClick={()=>setRename(null)}><X size={14}/></button></form>:<><b>{team.name}</b><button className="cap-text-button" type="button" onClick={()=>setRename({id:team.id,name:team.name})}><Edit3 size={13}/> Renombrar</button><button className="cap-text-button" type="button" onClick={()=>setColorTeam(team)}>Color RGBA</button></>}
    <span>{activePeople(team.id,today(),store.members,store.absences,store.supportShifts||[]).length} disponibles hoy</span>
   </div>{store.members.filter(m=>m.kind!=='auxiliar'&&((m.teamId===team.id&&!m.archivedAt)||m.teamHistory?.some(h=>h.teamId===team.id&&h.end&&h.end>=today()))).map(m=><div className="cap-member" key={m.id}><div className="cap-initial">{m.name.slice(0,1).toUpperCase()}</div><div className="cap-member-detail"><b>{m.name}</b><small>{m.kind==='adicional'?'Refuerzo':'Fijo'} · {m.archivedAt?'Baja registrada':m.end?'Hasta '+fmt(m.end):'Activo'}</small></div><button className="cap-text-button" onClick={()=>{setEditId(m.id);setMember({name:m.name,teamId:m.teamId,kind:m.kind,start:m.start,end:m.end||''});}}><Edit3 size={13}/> Editar</button><button className="cap-text-button danger" onClick={()=>archive(m)}><UserMinus size={13}/> Baja</button></div>)}
   </div>)}
   <div className="cap-crew-group"><div className="cap-crew-title"><b>Sin equipo asignado</b></div>{store.members.filter(m=>m.kind!=='auxiliar'&&m.teamId===''&&!m.archivedAt).map(m=><div className="cap-member" key={m.id}><div className="cap-initial">{m.name.slice(0,1).toUpperCase()}</div><div className="cap-member-detail"><b>{m.name}</b><small>Disponible para reasignar a un equipo</small></div><button className="cap-text-button" onClick={()=>{setEditId(m.id);setMember({name:m.name,kind:m.kind,teamId:'',start:m.start,end:m.end||''});}}><Edit3 size={13}/> Asignar</button><button className="cap-text-button danger" onClick={()=>archive(m)}><UserMinus size={13}/> Baja</button></div>)}</div>
   <div className="cap-crew-group"><div className="cap-crew-title"><b>Bolsa de operarios auxiliares · Producción</b><span>{eligible.length} disponibles para solicitar</span></div>
     {eligible.map(m=><div className="cap-member" key={m.id}><div className="cap-initial">{m.name.slice(0,1).toUpperCase()}</div><div className="cap-member-detail"><b>{m.name}</b><small>No suma capacidad hasta asignarle un día</small></div><button className="cap-text-button" onClick={()=>{setEditId(m.id);setMember({name:m.name,teamId:'',kind:'auxiliar',start:m.start,end:m.end||''});}}><Edit3 size={13}/> Editar</button><button className="cap-text-button danger" onClick={()=>archive(m)}><UserMinus size={13}/> Baja</button></div>)}
     {!eligible.length&&<p className="cap-muted">Todavía no cargaste auxiliares de Producción.</p>}
   </div>
  </div>
  <div className="cap-people-side">
   <div className="cap-panel"><div className="cap-intro"><div><h2>{editId?'Editar colaborador':'Incorporar colaborador'}</h2><p>Los cambios de equipo se aplican desde hoy; las asignaciones anteriores quedan registradas.</p></div></div>
    <form className="cap-form" onSubmit={updateMember}><label>Nombre<input required value={member.name} onChange={e=>setMember(s=>({...s,name:e.target.value}))}/></label><div className="cap-form-row"><label>Tipo<select disabled={!!editId} value={member.kind} onChange={e=>setMember(s=>({...s,kind:e.target.value,teamId:e.target.value==='auxiliar'?'':s.teamId}))}><option value="fijo">Fijo</option><option value="adicional">Refuerzo temporal</option><option value="auxiliar">Auxiliar de Producción</option></select></label>{member.kind!=='auxiliar'&&<label>Equipo<select value={member.teamId} onChange={e=>setMember(s=>({...s,teamId:e.target.value}))}><option value="">Sin equipo</option>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>}</div><div className="cap-form-row"><label>Alta<input type="date" value={member.start} disabled={!!editId} min={editId?undefined:today()} required onChange={e=>setMember(s=>({...s,start:e.target.value}))}/></label><label>Hasta (opcional)<input type="date" min={editId?today():member.start} value={member.end} onChange={e=>setMember(s=>({...s,end:e.target.value}))}/></label></div><div className="cap-inline-actions"><button type="submit" className="cap-btn primary"><UserPlus size={15}/>{editId?'Guardar cambios':'Agregar'}</button>{editId&&<button type="button" className="cap-btn" onClick={()=>{setEditId(null);setMember(emptyMember());}}>Cancelar</button>}</div></form>
   </div>
   <div className="cap-panel"><div className="cap-intro"><div><h2>Solicitar auxiliares por día</h2><p>Personal de Producción que se suma solo en el día solicitado.</p></div></div>
    <form className="cap-form" onSubmit={addSupport}><label>Operario<select required value={support.memberId} onChange={e=>setSupport(s=>({...s,memberId:e.target.value}))}><option value="">Seleccionar auxiliar…</option>{eligible.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="cap-form-row"><label>Equipo<select required value={support.teamId} onChange={e=>setSupport(s=>({...s,teamId:e.target.value}))}>{store.teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label><label>Fecha<input type="date" min={today()} required value={support.date} onChange={e=>setSupport(s=>({...s,date:e.target.value}))}/></label></div><button className="cap-btn primary" disabled={!eligible.length}><CalendarPlus size={15}/> Solicitar</button></form>
    <div className="cap-absences">{(store.supportShifts||[]).filter(x=>x.date>=today()).sort((a,b)=>a.date.localeCompare(b.date)).map(sh=><div className="cap-absence" key={sh.id}><div><b>{store.members.find(m=>m.id===sh.memberId)?.name}</b><small>{fmt(sh.date)} · {store.teams.find(t=>t.id===sh.teamId)?.name}</small></div><button title="Cancelar solicitud" onClick={()=>setStore(s=>({...s,supportShifts:s.supportShifts.filter(x=>x.id!==sh.id)}))}><X size={15}/></button></div>)}</div>
   </div>
   <div className="cap-panel"><div className="cap-intro"><div><h2>Bajas y ausencias</h2><p>Una ausencia reduce horas disponibles; el historial anterior no se elimina.</p></div></div>
    <form className="cap-form" onSubmit={addAbsence}><label>Colaborador<select required value={absence.memberId} onChange={e=>setAbsence(s=>({...s,memberId:e.target.value}))}><option value="">Seleccionar…</option>{store.members.filter(m=>!m.archivedAt).map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></label><div className="cap-form-row"><label>Desde<input type="date" required min={today()} value={absence.start} onChange={e=>setAbsence(s=>({...s,start:e.target.value}))}/></label><label>Hasta<input type="date" required min={absence.start} value={absence.end} onChange={e=>setAbsence(s=>({...s,end:e.target.value}))}/></label></div><label>Motivo<input required value={absence.reason} onChange={e=>setAbsence(s=>({...s,reason:e.target.value}))}/></label><button className="cap-btn" type="submit"><UserMinus size={15}/> Registrar ausencia</button></form>
    <div className="cap-absences">{store.absences.map(a=><div className="cap-absence" key={a.id}><div><b>{store.members.find(m=>m.id===a.memberId)?.name}</b><small>{a.reason} · {fmt(a.start)} al {fmt(a.end)}</small></div>{a.start>=today()&&<button onClick={()=>setStore(s=>({...s,absences:s.absences.filter(x=>x.id!==a.id)}))} title="Eliminar ausencia futura"><X size={15}/></button>}</div>)}</div>
   </div>
  </div>
  {colorTeam&&<TeamColorModal key={colorTeam.id||'new'} team={colorTeam} onClose={()=>setColorTeam(null)} onSave={({name,color})=>{setStore(old=>({...old,teams:colorTeam.id?old.teams.map(t=>t.id===colorTeam.id?{...t,name,color}:t):[...old.teams,{id:id('T'),name,color}]}));setColorTeam(null);}}/>}
 </div>;
}
