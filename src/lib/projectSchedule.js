/** Gantt por proyecto (UX): fechas teóricas de tareas en jornadas, incidencias y dependencias.
 * No asigna horas a la ocupación de Gerencia ni modifica la hoja de proyectos.
 */
import {countDailyHours,isDateBlocked,WEEK} from './domain.js';
import {addDays} from './planner.js';

export const INCIDENT_REASONS=[
 ['clima','Condiciones climáticas'],['personal','Falta de personal'],
 ['obra','Condiciones de obra'],['materiales','Falta de materiales'],
 ['equipo','Problemas de equipo / herramientas'],['otros','Otros']
];
export const localWeekday=date=>new Date(`${date}T12:00:00`).getDay();
export const isWorkDate=(date,teamId,projectId,calendar={})=>{
 if(!date||localWeekday(date)===0)return false; // domingo siempre cerrado
 return countDailyHours(date,calendar.week||WEEK,calendar.holidays||[],calendar.recesses||[],projectId,calendar.specialDays||[],teamId)>0;
};
export const taskDuration=(task,calendar={},projectId='')=>{
 const n=Number(task.durationDays);
 if(Number.isInteger(n)&&n>0)return Math.min(520,n);
 // Compatibilidad con v0.9: calcula días laborables del intervalo ya guardado.
 if(task.start&&task.end&&task.end>=task.start){
  let d=task.start,days=0;
  for(let i=0;i<730&&d<=task.end;i++,d=addDays(d,1))if(isWorkDate(d,task.teamId,projectId,calendar))days++;
  if(days)return days;
 }
 return Math.max(1,Math.ceil((Number(task.personHours)||12)/12));
};
const startAfter=date=>addDays(date,1);
const dateMax=(a,b)=>!a?a:(!b?a:(a>b?a:b));

/** Cada jornada se pinta con UN cuadrado. Un incidente conserva un marcador gris,
 * no consume jornada y desplaza todos los cuadrados posteriores. Las dependencias
 * se proyectan desde el final calculado del bloqueante, nunca por la fecha antigua.
 */
export function buildProjectSchedule(tasks=[],calendar={},projectId='',{maxSearchDays=1600}={}){
 const map=new Map(tasks.map(t=>[String(t.id),t]));
 const memo=new Map(),visiting=new Set();
 function scheduleTask(task){
  const id=String(task.id);
  if(memo.has(id))return memo.get(id);
  if(visiting.has(id))throw Error(`Dependencia circular en «${task.name}».`);
  visiting.add(id);
  let earliest=task.start;
  let predecessor=null;
  if(task.dependsOn){
   predecessor=map.get(String(task.dependsOn));
   if(!predecessor)throw Error(`No se encontró el bloqueante de «${task.name}».`);
   if(String(predecessor.id)===id)throw Error('Una tarea no puede bloquearse a sí misma.');
   const previous=scheduleTask(predecessor);
   earliest=dateMax(earliest,startAfter(previous.end));
  }
  if(!earliest)throw Error(`Falta la fecha de inicio de «${task.name}».`);
  const durationDays=taskDuration(task,calendar,projectId);
  const incidentMap=new Map((task.incidents||[]).map(i=>[i.date,i]));
  const days=[];
  let day=earliest,tries=0;
  while(days.length<durationDays&&tries<maxSearchDays){
   if(isWorkDate(day,task.teamId,projectId,calendar)&&!incidentMap.has(day))days.push(day);
   day=addDays(day,1);tries++;
  }
  if(days.length!==durationDays)throw Error(`No hay suficientes días laborables para «${task.name}».`);
  const start=days[0],end=days.at(-1);
  // Incidencias: visibles aunque el desplazamiento de un bloqueante cambie fechas.
  const incidents=(task.incidents||[]).filter(i=>i.date&&i.reason);
  const result={...task,days,start,end,requestedStart:task.start,durationDays,incidents,
    dependsOnName:predecessor?.name||'',blocked:!!predecessor&&predecessor.status!=='finalizada',
    shifted:start!==task.start||end!==task.end};
  visiting.delete(id);memo.set(id,result);return result;
 }
 return tasks.map(scheduleTask);
}
export function validateDependency(tasks,taskId,dependsOn){
 if(!dependsOn)return true;
 const map=new Map(tasks.map(t=>[String(t.id),t]));
 if(!map.has(String(dependsOn)))throw Error('Elegí una tarea bloqueante válida.');
 const seen=new Set([String(taskId)]);let pointer=String(dependsOn);
 while(pointer){
  if(seen.has(pointer))throw Error('Esa dependencia generaría un ciclo entre tareas.');
  seen.add(pointer);pointer=String(map.get(pointer)?.dependsOn||'');
 }
 return true;
}
export function addTaskIncident(tasks,taskId,{date,reason,note=''},calendar={},projectId='',today){
 if(!reason||!INCIDENT_REASONS.some(([r])=>r===reason))throw Error('Elegí un motivo para la reprogramación.');
 if(today&&date<today)throw Error('No se permite modificar una fecha histórica.');
 const before=buildProjectSchedule(tasks,calendar,projectId);
 const current=before.find(t=>String(t.id)===String(taskId));
 if(!current||!current.days.includes(date))throw Error('Elegí una jornada planificada de esa tarea.');
 if((current.incidents||[]).some(i=>i.date===date))throw Error('Esta fecha ya tiene un motivo registrado.');
 const affected=tasks.map(t=>String(t.id)===String(taskId)?{...t,incidents:[...(t.incidents||[]),{date,reason,note:String(note).trim().slice(0,500),createdAt:new Date().toISOString()}]}:t);
 // Recalcula antes de confirmar; garantiza que nunca se persista un ciclo o cronograma imposible.
 buildProjectSchedule(affected,calendar,projectId);
 return affected;
}
export function removeFutureIncident(tasks,taskId,date,today){
 if(date<today)throw Error('No se modifica una incidencia histórica.');
 return tasks.map(t=>String(t.id)===String(taskId)?{...t,incidents:(t.incidents||[]).filter(i=>i.date!==date)}:t);
}
/** Primera fecha con actividad del proyecto: jornada programada o incidencia histórica.
 * No usa la fecha de alta/Inicio del Excel ni una fecha mínima teórica en día no laborable.
 */
export function firstProjectActivityDate(scheduled=[]){
 const dates=scheduled.flatMap(task=>[
  ...(task.days||[]),
  ...(task.incidents||[]).map(incident=>incident.date)
 ]).filter(date=>/^\d{4}-\d{2}-\d{2}$/.test(String(date||'')));
 return dates.sort()[0]||'';
}
export function summarizeProjectSchedule(scheduled=[]){
 const dates=scheduled.flatMap(t=>t.days);
 const first=dates.length?[...dates].sort()[0]:'';
 const last=dates.length?[...dates].sort().at(-1):'';
 return {start:first,end:last,tasks:scheduled.length,workDays:new Set(dates).size,incidents:scheduled.reduce((s,t)=>s+t.incidents.length,0)};
}
export function groupBySector(scheduled=[],sectors=[]){
 const output=sectors.map(s=>({...s,tasks:scheduled.filter(t=>t.sectorId===s.id)}));
 const general=scheduled.filter(t=>!t.sectorId||!sectors.some(s=>s.id===t.sectorId));
 return {sectors:output,general};
}
export function sectorSpan(tasks=[]){
 const dates=tasks.flatMap(t=>t.days||[]).sort();
 return {start:dates[0]||'',end:dates.at(-1)||''};
}
export function isHoliday(date,calendar={},projectId=''){
 return isDateBlocked(date,calendar.holidays||[],calendar.recesses||[],projectId);
}
