import {countDailyHours} from './domain.js';
import {dateISO,addDays,scheduleAssignment,isOutsourced} from './planner.js';

export const isPickupProject = p => /retiro\s+en\s+abalum/i.test(String(p?.grupo||p?.group||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
export const isPast = (day, today=dateISO(new Date())) => Boolean(day && day<today);
export const canEditBlock = (block,today=dateISO(new Date())) => !isPast(block.date,today);
export const newBlockId = () => `B-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
export function generateBlocks(assignment,estimate,week,holidays=[],recesses=[],today=dateISO(new Date())) {
  const sch=scheduleAssignment(assignment,estimate,week,holidays,recesses);
  return Object.entries(sch.days).map(([date,personHours],index)=>({
    id:`${assignment.id}-D${index+1}-${date}`,assignmentId:assignment.id,projectId:assignment.projectId,teamId:assignment.teamId,
    date,personHours,crew:Number(assignment.crew)||2,title:'Colocación',workers:[],
    status:date<today?'sin_confirmar':'planificado',reason:'',createdAt:new Date().toISOString(),origin:'programacion'
  }));
}
export function moveBlock(block,targetDate,today=dateISO(new Date())){
  if(!canEditBlock(block,today))throw Error('Los bloques del pasado no se pueden modificar.');
  if(targetDate && targetDate<today)throw Error('No se pueden programar tareas en fechas pasadas.');
  return {...block,date:targetDate||'',status:targetDate?'planificado':'backlog'};
}
export function splitPartial(block,doneHours,today=dateISO(new Date())){
  if(!canEditBlock(block,today)||block.date!==today)throw Error('Solo se puede registrar una ejecución parcial en el día actual.');
  const completed=Number(doneHours),total=Number(block.personHours);
  if(!(completed>0 && completed<total))throw Error('La ejecución debe ser mayor que cero y menor al total.');
  const remaining={...block,id:newBlockId(),date:'',status:'backlog',personHours:Number((total-completed).toFixed(3)),workers:[],parentId:block.id,reason:'Trabajo pendiente de finalización'};
  return {completed:{...block,personHours:completed,status:'realizado',completedAt:new Date().toISOString()},remaining};
}
export function canScheduleOn(date,projectId,week,holidays=[],recesses=[]){return !date||countDailyHours(date,week,holidays,recesses,projectId)>0;}
export function memberTeamOn(member,date){
  if(member.teamHistory?.length){const period=member.teamHistory.find(h=>(!h.start||date>=h.start)&&(!h.end||date<=h.end));return period?.teamId||'';}
  return member.teamId||'';
}
export function changeMemberTeam(member,teamId,effectiveDate=dateISO(new Date())){
  const previous=member.teamHistory?.length?member.teamHistory:[{teamId:member.teamId||'',start:member.start||'2020-01-01',end:member.end||''}];
  const closed=previous.map(x=>x.end&&x.end<effectiveDate?x:({...x,end:addDays(effectiveDate,-1)}));
  return {...member,teamId,teamHistory:[...closed,{teamId,start:effectiveDate,end:''}]};
}
export function archiveMember(member,effectiveDate=dateISO(new Date())){
  const end=addDays(effectiveDate,-1);
  return {...member,end,archivedAt:effectiveDate,active:true}; // No elimina su capacidad histórica.
}
export function taskStatus(block){return ({planificado:'Programada',backlog:'En backlog',realizado:'Realizada',sin_confirmar:'Pasada · sin confirmar'})[block.status]||'Pendiente';}
