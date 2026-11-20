/** Gantt de seguimiento por proyecto. No consume capacidad: evita contar dos veces las TP. */
import {countDailyHours} from './domain.js';
import {activePeople,addDays,dateISO} from './planner.js';

export const TASK_STATUSES=[['pendiente','Pendiente'],['en_curso','En curso'],['demorada','Demorada'],['finalizada','Finalizada']];
export function taskWindow({start,personHours,projectId,teamId,members=[],absences=[],supportShifts=[],week,holidays=[],recesses=[],specialDays=[],maxDays=730}) {
  const total=Number(personHours);if(!start||!teamId||!Number.isFinite(total)||total<=0)return {end:'',days:0,available:0,remaining:total||0};
  let date=start,remaining=total,available=0,days=0;
  for(let i=0;i<maxDays && remaining>0.00001;i++,date=addDays(date,1)){
    const dailyHours=countDailyHours(date,week,holidays,recesses,projectId,specialDays,teamId);
    if(dailyHours<=0)continue;
    const personnel=activePeople(teamId,date,members,absences,supportShifts).length;
    if(!personnel)continue;
    const capacity=dailyHours*personnel;
    available+=capacity;days++;
    remaining=Math.max(0,remaining-capacity);
    if(remaining<0.00001)return {end:date,days,available,remaining:0};
  }
  return {end:'',days,available,remaining};
}
export function intervalCapacity({start,end,teamId,projectId,members=[],absences=[],supportShifts=[],week,holidays=[],recesses=[],specialDays=[]}){
  if(!start||!end||end<start)return 0;
  let total=0;
  for(let date=start;date<=end;date=addDays(date,1))total+=countDailyHours(date,week,holidays,recesses,projectId,specialDays,teamId)*activePeople(teamId,date,members,absences,supportShifts).length;
  return total;
}
export function progressOverview(tasks=[]){
  // Gantt cliente: el avance global se pondera por jornadas, no por horas-persona.
  // Compatibilidad v1.2: las tareas antiguas sin durationDays conservan su ponderación.
  const weight=t=>Math.max(0,Number(t.durationDays)||Number(t.personHours)||1);
  const units=tasks.reduce((s,t)=>s+weight(t),0);
  const done=tasks.reduce((s,t)=>s+weight(t)*Math.min(1,Math.max(0,(Number(t.progress)||0)/100)),0);
  return {tasks:tasks.length,units,done,percent:units>0?Math.round(100*done/units):0,finished:tasks.filter(t=>t.status==='finalizada').length};
}
export function validateTaskDates(previous,next,today=dateISO(new Date())){
  if(!next.name?.trim()||!next.teamId||!next.start||!next.end)throw Error('Completá tarea, equipo, inicio y fin.');
  if(next.end<next.start)throw Error('El fin no puede ser anterior al comienzo.');
  if(!(Number(next.durationDays)>0) && !(Number(next.personHours)>0))throw Error('Ingresá las jornadas necesarias.');
  if(!Number.isFinite(Number(next.progress))||Number(next.progress)<0||Number(next.progress)>100)throw Error('El avance debe estar entre 0 y 100%.');
  if(previous?.start && previous.start<today && (next.start!==previous.start||next.end!==previous.end||next.teamId!==previous.teamId))throw Error('No se pueden mover fechas ni equipo de una tarea histórica. Podés actualizar su avance.');
  return true;
}
