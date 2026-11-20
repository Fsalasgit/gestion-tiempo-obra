import {countDailyHours} from './domain.js';
import {dateISO,addDays,scheduleAssignment,isOutsourced} from './planner.js';

export const isPickupProject = p => /retiro\s+en\s+abalum/i.test(String(p?.grupo||p?.group||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''));
export const isPast = (day, today=dateISO(new Date())) => Boolean(day && day<today);
export const canEditBlock = (block,today=dateISO(new Date())) => !isPast(block.date,today);
export const newBlockId = () => `B-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
export const PENDING_REASONS=['Falta de personal','Condiciones de obra','Lluvia / clima','Falta de materiales','Cambio solicitado por el cliente','Otros'];
export function generateBlocks(assignment,estimate,week,holidays=[],recesses=[],today=dateISO(new Date())) {
  const sch=scheduleAssignment(assignment,estimate,week,holidays,recesses);
  return Object.entries(sch.days).map(([date,personHours],index)=>({
    id:`${assignment.id}-D${index+1}-${date}`,assignmentId:assignment.id,projectId:assignment.projectId,teamId:assignment.teamId,
    date,personHours,crew:Number(assignment.crew)||2,title:'Colocación',workers:[],
    status:date<today?'sin_confirmar':'planificado',reason:'',reprogramHistory:[],createdAt:new Date().toISOString(),origin:'programacion'
  }));
}
export function moveBlock(block,targetDate,today=dateISO(new Date())){
  if(!canEditBlock(block,today))throw Error('Los bloques del pasado no se pueden modificar.');
  if(targetDate && targetDate<today)throw Error('No se pueden programar tareas en fechas pasadas.');
  return {...block,date:targetDate||'',status:targetDate?'planificado':'backlog'};
}
export function splitPartial(block,doneHours,today=dateISO(new Date()),reason='Ejecución parcial',note=''){
  if(!canEditBlock(block,today)||block.date!==today)throw Error('Solo se puede registrar una ejecución parcial en el día actual.');
  const completed=Number(doneHours),total=Number(block.personHours);
  if(!(completed>0 && completed<total))throw Error('La ejecución debe ser mayor que cero y menor al total.');
  if(!String(reason||'').trim())throw Error('Seleccioná el motivo del trabajo que quedó pendiente.');
  if(reason==='Otros'&&!String(note).trim())throw Error('Describí el motivo cuando seleccionás Otros.');
  const remaining={...block,id:newBlockId(),date:'',status:'backlog',personHours:Number((total-completed).toFixed(3)),workers:[],workerHours:{},parentId:block.id,origin:'pendiente',pendingReason:reason,pendingNote:String(note||'').trim(),reason,title:`Pendiente · ${block.title||'Colocación'}`,reprogramHistory:[],splitHistory:[],completedAt:null,workerNames:[],createdAt:new Date().toISOString()};
  return {completed:{...block,personHours:completed,status:'realizado',completedAt:new Date().toISOString()},remaining};
}
/**
 * Divide una TP *planificada* sin dar por ejecutada ninguna hora.
 * La TP original conserva fecha/equipo/personal y su esfuerzo se reduce;
 * el saldo se convierte en una TP pendiente en backlog (sin carga diaria).
 * Esta operación NO registra una reprogramación ni confirma ejecución.
 */
export function derivePendingTask(block,pendingHours,reason,note='',today=dateISO(new Date())){
  if(!block||!canEditBlock(block,today)||block.status==='realizado'||!block.date||block.status==='backlog'){
    throw Error('Solo podés desprender horas de una TP programada para hoy o una fecha futura.');
  }
  const total=Number(block.personHours);
  const pending=Number(pendingHours);
  if(!Number.isFinite(total)||!Number.isFinite(pending)||!(pending>0&&pending<total)){
    throw Error('Las horas pendientes deben ser mayores que cero y menores al total de la TP.');
  }
  if(!PENDING_REASONS.includes(reason))throw Error('Seleccioná un motivo válido para el trabajo pendiente.');
  if(reason==='Otros'&&!String(note).trim())throw Error('Describí el motivo cuando seleccionás Otros.');
  const now=new Date().toISOString();
  const childId=newBlockId();
  const kept=Number((total-pending).toFixed(3));
  const pendingRounded=Number(pending.toFixed(3));
  const event={at:now,childId,originalHours:total,keptHours:kept,pendingHours:pendingRounded,reason,note:String(note||'').trim()};
  const original={...block,personHours:kept,splitHistory:[...(block.splitHistory||[]),event]};
  const pendingTask={...block,id:childId,date:'',personHours:pendingRounded,status:'backlog',
    title:`Pendiente · ${block.title||'Colocación'}`,origin:'pendiente',parentId:block.id,
    workers:[],workerHours:{},workerNames:[],reason,pendingReason:reason,pendingNote:event.note,
    reprogramHistory:[],splitHistory:[],createdAt:now,completedAt:null};
  return {original,pendingTask,event};
}
export function canScheduleOn(date,projectId,week,holidays=[],recesses=[],specialDays=[],teamId=''){return !date||countDailyHours(date,week,holidays,recesses,projectId,specialDays,teamId)>0;}
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
