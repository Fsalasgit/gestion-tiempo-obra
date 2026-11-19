import React,{useState} from 'react';
import {CalendarPlus,Check,Edit3,Plus,UserMinus,UserPlus,X} from 'lucide-react';
import {dateISO,activePeople} from '../lib/planner.js';
import {changeMemberTeam,archiveMember} from '../lib/workBlocks.js';

const id=prefix=>`${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,7)}`;
const today=()=>dateISO(new Date());
const emptyMember=()=>({name:'',kind:'fijo',teamId:'',start:today(),end:''});
const fmt=x=>x?x.split('-').reverse().join('/'):'—';

export default function PeopleManager({store,setStore}){
 const [teamName,setTeamName]=useState('');
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
   <form className="cap-inline-form" onSubmit={e=>{e.preventDefault();if(teamName.trim()){setStore(s=>({...s,teams:[...s.teams,{id:id('T'),name:teamName.trim()}]}));setTeamName('');}}}><input aria-label="Nombre del nuevo equipo" placeholder="Nuevo equipo" value={teamName} onChange={e=>setTeamName(e.target.value)} required/><button className="cap-btn"><Plus size={14}/> Agregar</button></form>
   {store.teams.map(team=><div className="cap-crew-group" key={team.id}><div className="cap-crew-title">
     {rename?.id===team.id?<form className="cap-inline-form cap-rename" onSubmit={e=>{e.preventDefault();if(rename.name.trim())setStore(s=>({...s,teams:s.teams.map(t=>t.id===team.id?{...t,name:rename.name.trim()}:t)}));setRename(null);}}><input autoFocus value={rename.name} onChange={e=>setRename(v=>({...v,name:e.target.value}))}/><button className="cap-btn" type="submit"><Check size={14}/></button><button className="cap-btn" type="button" onClick={()=>setRename(null)}><X size={14}/></button></form>:<><b>{team.name}</b><button className="cap-text-button" type="button" onClick={()=>setRename({id:team.id,name:team.name})}><Edit3 size={13}/> Renombrar</button></>}
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
 </div>;
}
