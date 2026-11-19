import {countDailyHours, getPersonHours} from './domain.js';


// Fechas como YYYY-MM-DD para evitar desplazamientos UTC en Argentina.
export const dateISO = value => {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = value instanceof Date ? value : new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
export const addDays = (date, n=1) => { const d = new Date(`${date}T12:00:00`); d.setDate(d.getDate()+n); return dateISO(d); };
export const monthKey = date => String(date).slice(0,7);
export const firstDay = month => `${month}-01`;
export const lastDay = month => {const [y,m]=month.split('-').map(Number); return dateISO(new Date(y,m,0,12));};
export function monthDates(month) { const days=[];for(let d=firstDay(month);d<=lastDay(month);d=addDays(d))days.push(d);return days; }
export function shiftMonth(month,shift){const [y,m]=month.split('-').map(Number);return dateISO(new Date(y,m-1+shift,1,12)).slice(0,7);}
export const dateInRange = (date,start,end) => (!start || date>=start) && (!end || date<=end);
export const isOutsourced = estimate => estimate?.outsourced===true || String(estimate?.outsourced)==='true';
export const effort = estimate => getPersonHours(estimate?.value||0,estimate?.unit||'horas',Number(estimate?.crewReference)||2);

export function activePeople(teamId,date,members=[],absences=[],supportShifts=[]) {
  return members.filter(p=>{
    if(!dateInRange(date,p.start,p.end))return false;
    if(p.active===false && !p.archivedAt)return false;
    if(absences.some(a=>a.memberId===p.id&&dateInRange(date,a.start,a.end)))return false;
    if(p.kind==='auxiliar')return supportShifts.some(sh=>sh.memberId===p.id&&sh.teamId===teamId&&sh.date===date);
    const periods=p.teamHistory;
    return periods?.length?periods.some(h=>h.teamId===teamId&&dateInRange(date,h.start,h.end)):p.teamId===teamId;
  });
}
export function teamCapacity(teamId,date,members,absences,week,holidays,recesses=[],supportShifts=[]) {
  const h=countDailyHours(date,week,holidays,recesses);
  return activePeople(teamId,date,members,absences,supportShifts).length*h;
}

/**
 * Cada asignación distribuye SU esfuerzo con su equipo estimado, sin reservar/capar
 * capacidad por otras asignaciones. Esa decisión permite revelar sobreocupación >100%.
 * Las ausencias bajan la capacidad REAL sin borrar el trabajo prometido.
 */
export function scheduleAssignment(assignment,estimate,week,holidays,recesses,limitDays=520) {
  const start=assignment.start;
  const hours=effort(estimate);
  if (!start || !hours || isOutsourced(estimate)) return {days:{},end:'',total:0,outsourced:isOutsourced(estimate)};
  let remaining=hours;const days={};let end='';
  for(let n=0,date=start;n<limitDays && remaining>0.00001;n++,date=addDays(date)){
    const h=countDailyHours(date,week,holidays,recesses,assignment.projectId);
    if(h<=0)continue;
    const load=Math.min(remaining,h*Math.max(1,Number(assignment.crew)||2));
    days[date]=load;remaining-=load;end=date;
  }
  return {days,end,total:hours,unplanned:Math.max(0,remaining),outsourced:false};
}

export function buildMonthPlan({month,projects=[],estimates=[],teams=[],members=[],absences=[],assignments=[],blocks=null,supportShifts=[],week,holidays=[],recesses=[],today=dateISO(new Date())}){
  const dates=monthDates(month), estimateById=new Map(estimates.map(e=>[String(e.projectId),e])), projectById=new Map(projects.map(p=>[String(p.id),p]));
  const scheduled=assignments.map(a=>({...a,project:projectById.get(String(a.projectId)),estimate:estimateById.get(String(a.projectId))})).filter(a=>a.project&&a.estimate);
  const computed=scheduled.filter(a=>!(/retiro\s+en\s+abalum/i).test(String(a.project?.grupo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''))).map(a=>{
    const validBlocks=Array.isArray(blocks)?blocks.filter(b=>b.assignmentId===a.id&&b.date&&b.status!=='backlog'):null;
    const days=validBlocks?.reduce((acc,b)=>{acc[b.date]=(acc[b.date]||0)+Number(b.personHours||0);return acc;},{});
    return {...a,schedule:days?{days,total:Object.values(days).reduce((x,y)=>x+y,0),outsourced:isOutsourced(a.estimate)}:scheduleAssignment(a,a.estimate,week,holidays,recesses)};
  });
  const teamDays=teams.map(team=>({
    ...team,
    dates:dates.map(date=>{
      const capacity=teamCapacity(team.id,date,members,absences,week,holidays,recesses,supportShifts);
      const load=Array.isArray(blocks)?blocks.filter(b=>b.teamId===team.id&&b.date===date&&b.status!=='backlog'&&scheduled.some(a=>a.id===b.assignmentId&&!isOutsourced(a.estimate)&&!(/retiro\s+en\s+abalum/i).test(String(a.project?.grupo||'')))).reduce((acc,b)=>acc+Number(b.personHours||0),0):computed.filter(a=>a.teamId===team.id).reduce((acc,a)=>acc+(a.schedule.days[date]||0),0);
      return {date,capacity,load,over:Math.max(0,load-capacity),people:activePeople(team.id,date,members,absences,supportShifts).length};
    })
  })).map(team=>({...team,capacity:team.dates.reduce((s,d)=>s+d.capacity,0),load:team.dates.reduce((s,d)=>s+d.load,0)}));
  const capacity=teamDays.reduce((s,t)=>s+t.capacity,0),load=teamDays.reduce((s,t)=>s+t.load,0);
  const workdaysRemaining=dates.filter(date=>date>=today && teamDays.some(t=>t.dates.some(d=>d.date===date && d.capacity>0))).length;
  const calendarDaysRemaining = month<monthKey(today) ? 0 : month>monthKey(today) ? dates.length : dates.filter(d=>d>today).length;
  const fullyOutsourced=estimates.filter(e=>isOutsourced(e)&&projectById.has(String(e.projectId))).length;
  const totalInternalEffort=estimates.filter(e=>!isOutsourced(e)&&projectById.has(String(e.projectId))&&!(/retiro\s+en\s+abalum/i).test(String(projectById.get(String(e.projectId))?.grupo||''))).reduce((s,e)=>s+effort(e),0);
  return {month,dates,teamDays,computed,capacity,load,over:Math.max(0,load-capacity),occupancy:capacity>0?load/capacity*100:load>0?Infinity:0,workdaysRemaining,calendarDaysRemaining,fullyOutsourced,totalInternalEffort,
    unassigned:projects.filter(p=>{const e=estimateById.get(String(p.id));return e&&!isOutsourced(e)&&!(/retiro\s+en\s+abalum/i).test(String(p.grupo||''))&&!assignments.some(a=>String(a.projectId)===String(p.id));}).length,
    daily:dates.map((date,index)=>({date,capacity:teamDays.reduce((s,t)=>s+t.dates[index].capacity,0),load:teamDays.reduce((s,t)=>s+t.dates[index].load,0)}))
  };
}

export const percent = (load,capacity) => capacity>0?Math.round(100*load/capacity):load>0?Infinity:0;
export const hours = val => new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(Number(val)||0);
