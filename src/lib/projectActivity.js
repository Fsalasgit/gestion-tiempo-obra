/** Eventos explícitos de seguimiento para el cliente y la Dirección. */
import {INCIDENT_REASONS} from './projectSchedule.js';
const reasonLabel=v=>INCIDENT_REASONS.find(([key])=>key===v)?.[1]||v||'Sin detalle';
export function projectActivityRows(tasks=[],{clientOnly=false}={}){
 const rows=[];
 for(const task of tasks){
  for(const i of task.incidents||[]){
   if(clientOnly&&i.published===false)continue;
   rows.push({taskId:task.id,taskName:task.name,date:i.date,type:'Incidencia',detail:[reasonLabel(i.reason),i.note].filter(Boolean).join(' · ')});
  }
  for(const e of task.reprogramHistory||[]){
   if(clientOnly&&e.published===false)continue;
   rows.push({taskId:task.id,taskName:task.name,date:(e.at||'').slice(0,10),type:'Reprogramación',detail:[reasonLabel(e.reason),e.from&&e.to?`${e.from} → ${e.to}`:'',e.note].filter(Boolean).join(' · ')});
  }
 }
 return rows.sort((a,b)=>String(b.date).localeCompare(String(a.date)));
}
