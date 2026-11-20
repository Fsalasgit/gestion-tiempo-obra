/**
 * Planificación lineal no invasiva: reserva una sola obra por equipo y día.
 * La demanda se expresa SIEMPRE en horas-persona. No confirma ejecución.
 * Utiliza el mismo calendario laboral/feriados/recesos del resto de ObraTiempo.
 */
import {countDailyHours} from './domain.js';
import {activePeople,addDays,dateISO,effort,isOutsourced} from './planner.js';
import {isPickupProject} from './workBlocks.js';

export function blockedTeamDates(blocks=[],teamId,ignoreIds=new Set()) {
  return new Set(blocks.filter(b => b.teamId===teamId && b.date && b.status!=='backlog' && !ignoreIds.has(b.id)).map(b=>b.date));
}

/** Solo el trabajo restante. Los días históricos nunca se borran. */
export function scheduleLinear({assignment,estimate,projects=[],members=[],absences=[],supportShifts=[],blocks=[],week,holidays=[],recesses=[],specialDays=[],today=dateISO(new Date()),maxDays=730,remainingEffort=null}) {
  const project=projects.find(p=>String(p.id)===String(assignment?.projectId));
  if(!assignment?.teamId || !assignment?.start || !project)throw Error('Elegí una obra, un equipo y una fecha de inicio.');
  if(isPickupProject(project))throw Error('Las obras del grupo Retiro en ABALUM no requieren colocación.');
  if(isOutsourced(estimate))throw Error('La obra está tercerizada: no consume capacidad interna.');
  if(!estimate)throw Error('La obra no tiene una estimación de colocación.');
  const total=remainingEffort===null?effort(estimate):Number(remainingEffort);
  if(!Number.isFinite(total) || total<=0)throw Error('El tiempo de colocación debe ser válido.');
  const start=assignment.start<today?today:assignment.start;
  const crewLimit=Math.max(1,Math.floor(Number(assignment.crew)||999));
  let pending=total;const scheduled=[];let date=start;let inspected=0;
  const busy=blockedTeamDates(blocks,assignment.teamId);
  while(pending>0.00001 && inspected<maxDays){
    inspected++;
    if(!busy.has(date)){
      const dailyHours=countDailyHours(date,week,holidays,recesses,assignment.projectId,specialDays,assignment.teamId);
      if(dailyHours>0){
        const usedWorkers=new Set(blocks.filter(b=>b.date===date && b.status!=='backlog').flatMap(b=>b.workers||[]));
        const available=activePeople(assignment.teamId,date,members,absences,supportShifts)
          .filter(p=>!usedWorkers.has(p.id)).sort((a,b)=>(a.kind==='auxiliar')-(b.kind==='auxiliar'));
        const selected=available.slice(0,crewLimit);
        if(selected.length){
          const allocated=Number(Math.min(pending, selected.length*dailyHours).toFixed(4));
          const perPerson=Number((allocated/selected.length).toFixed(4));
          const workerHours=Object.fromEntries(selected.map(p=>[p.id,perPerson]));
          const index=scheduled.length;
          scheduled.push({id:`${assignment.id}-AUTO-${index+1}-${date}`,assignmentId:assignment.id,projectId:assignment.projectId,
            teamId:assignment.teamId,date,personHours:allocated,crew:selected.length,title:'Colocación',workers:selected.map(p=>p.id),workerHours,
            status:'planificado',origin:'lineal',reprogramHistory:[],splitHistory:[],reason:'',createdAt:assignment.createdAt||new Date().toISOString()});
          pending=Number((pending-allocated).toFixed(4));
        }
      }
    }
    if(pending>0.00001)date=addDays(date,1);
  }
  return {blocks:scheduled,start:scheduled[0]?.date||'',end:scheduled.at(-1)?.date||'',days:scheduled.length,planned:Number((total-pending).toFixed(4)),remaining:pending,total,
    monthOverflow:Boolean(scheduled.some(b=>b.date.slice(0,7)!==assignment.start.slice(0,7)))};
}

/**
 * Recalcula solamente TP automáticas del presente/futuro. Las históricas y
 * todas las TP editadas manualmente permanecen intactas.
 * Devuelve el nuevo conjunto o lanza sin mutar el estado recibido.
 */
export function replanFutureLinear({assignments=[],blocks=[],projects=[],estimates=[],today=dateISO(new Date()),...calendar}) {
  const automatic=assignments.filter(a=>a.mode==='automatic').sort((a,b)=>String(a.createdAt||a.start).localeCompare(String(b.createdAt||b.start)));
  const ids=new Set(automatic.map(a=>a.id));
  let kept=blocks.filter(b=> !(ids.has(b.assignmentId) && b.origin==='lineal' && b.date>=today && b.status!=='realizado'));
  const results=[];
  for(const a of automatic){
    const estimate=estimates.find(e=>String(e.projectId)===String(a.projectId));
    const project=projects.find(p=>String(p.id)===String(a.projectId));
    if(!estimate||!project||isOutsourced(estimate)||isPickupProject(project))continue;
    const past=kept.filter(b=>b.assignmentId===a.id && b.date && b.date<today).reduce((s,b)=>s+Number(b.personHours||0),0);
    const other=kept.filter(b=>b.assignmentId===a.id && (b.origin!=='lineal'||b.status==='backlog'||b.status==='realizado')).reduce((s,b)=>s+Number(b.personHours||0),0);
    const rest=Math.max(0,Number((effort(estimate)-past-other).toFixed(4)));
    const plan=scheduleLinear({assignment:a,estimate,projects,blocks:kept,today,remainingEffort:rest,...calendar});
    if(plan.remaining>0.00001)throw Error(`No hay capacidad suficiente para la obra ${project.numero||project.proyecto} en los próximos dos años.`);
    kept=[...kept,...plan.blocks];results.push({assignmentId:a.id,...plan});
  }
  return {blocks:kept,results};
}
