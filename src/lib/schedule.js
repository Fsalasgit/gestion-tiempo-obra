// Todas las fechas se calculan en horario local, sin interpretar YYYY-MM-DD como UTC.
export const HRS_PER_DAY = 8;
export const STATUS_OPTIONS = ['Solicitado','Aprobado','Técnica','Planificación','Ejecución','Terminado','Cancelado'];

export function toISO(date) {
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}
export function fromISO(value) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [yy,mm,dd] = value.split('-').map(Number);
  const date = new Date(yy,mm - 1,dd);
  if (date.getFullYear() !== yy || date.getMonth() + 1 !== mm || date.getDate() !== dd) return null;
  return date;
}
export function addMonths(date, number) {return new Date(date.getFullYear(), date.getMonth() + number, 1);}
export function monthStart(date) {return new Date(date.getFullYear(),date.getMonth(),1);}
export function monthEnd(date) {return new Date(date.getFullYear(),date.getMonth()+1,0);}
export function daysBetweenInclusive(start, end) {
  const result = [];
  const a = typeof start === 'string' ? fromISO(start) : start;
  const b = typeof end === 'string' ? fromISO(end) : end;
  if (!a || !b || a > b) return result;
  for (let d = new Date(a.getFullYear(),a.getMonth(),a.getDate()); d <= b; d.setDate(d.getDate()+1)) result.push(new Date(d));
  return result;
}
export function isWorkday(date, excludedDates = []) {
  return date.getDay() !== 0 && date.getDay() !== 6 && !excludedDates.includes(toISO(date));
}
export function businessDays(start,end,excludedDates=[]) {
  return daysBetweenInclusive(start,end).filter(d => isWorkday(d,excludedDates));
}
export function dateInRange(date,start,end) {
  const iso = typeof date === 'string' ? date : toISO(date);
  return Boolean(start && end && iso >= start && iso <= end);
}
export function dateOverlaps(aStart,aEnd,bStart,bEnd) {
  return Boolean(aStart && aEnd && bStart && bEnd && aStart <= bEnd && bStart <= aEnd);
}
export function employeeAvailableOn(employee,date,absences=[]) {
  const iso = typeof date === 'string' ? date : toISO(date);
  if (employee.activeFrom && iso < employee.activeFrom) return false;
  if (employee.activeUntil && iso > employee.activeUntil) return false;
  return !absences.some(a => a.employeeId===employee.id && dateInRange(iso,a.start,a.end));
}
export function projectEffectiveStart(project) {return project.inicio || project.inicioP || '';}
export function sortProjects(projects) {
  return [...projects].sort((a,b)=> {
    const dateA = projectEffectiveStart(a) || '9999-12-31';
    const dateB = projectEffectiveStart(b) || '9999-12-31';
    return dateA.localeCompare(dateB) || String(a.id).localeCompare(String(b.id));
  });
}
export function demandForDay(assignment, iso) {
  return !assignment.outsourced && dateInRange(iso,assignment.start,assignment.end)
    ? Number(assignment.people || 0) * Number(assignment.hoursPerDay || 0)
    : 0;
}
export function teamStats(team,month,assignments,employees,absences,excludedDates=[], rangeEnd=null, today=null) {
  const start = monthStart(month);
  const end = rangeEnd || monthEnd(month);
  const days = businessDays(start,end,excludedDates);
  const teamAssignments = assignments.filter(a=>!a.outsourced && a.teamId===team.id);
  const teamMembers = employees.filter(e=>e.teamId===team.id);
  let availableHours=0, assignedHours=0, overloadedDays=0, maxDayUtilization=0, peakExcessHours=0;
  const daily=[];
  for(const d of days) {
    const iso=toISO(d);
    const available=teamMembers.filter(e=>employeeAvailableOn(e,iso,absences)).length * HRS_PER_DAY;
    const assigned=teamAssignments.reduce((s,a)=>s + demandForDay(a,iso),0);
    const ratio= available > 0 ? (assigned / available * 100) : assigned > 0 ? Infinity : 0;
    availableHours+=available;
    assignedHours+=assigned;
    if(assigned>available) {overloadedDays++; peakExcessHours=Math.max(peakExcessHours, assigned-available);}
    maxDayUtilization=Math.max(maxDayUtilization,ratio);
    daily.push({date:iso,available,assigned,ratio,excess:Math.max(0,assigned-available)});
  }
  const utilization=availableHours ? assignedHours/availableHours*100 : (assignedHours ? Infinity : 0);
  const remainingDays= days.filter(d=>!today || toISO(d)>=toISO(today)).length;
  return {teamId:team.id,availableHours,assignedHours,utilization,availableBalance:availableHours-assignedHours,
    overloadedDays,maxDayUtilization,peakExcessHours,remainingDays,daily,
    members:teamMembers.length, jobs:teamAssignments.filter(a=>dateOverlaps(a.start,a.end,toISO(start),toISO(end))).length};
}
export function allTeamStats(teams,month,assignments,employees,absences,excludedDates=[],end=null,today=null) {
  return teams.map(t=>teamStats(t,month,assignments,employees,absences,excludedDates,end,today));
}
export function summaryStats(teams,month,assignments,employees,absences,excludedDates=[],today=new Date()) {
  const perTeam=allTeamStats(teams,month,assignments,employees,absences,excludedDates,null,today);
  const availableHours=perTeam.reduce((s,x)=>s+x.availableHours,0);
  const assignedHours=perTeam.reduce((s,x)=>s+x.assignedHours,0);
  const start=toISO(monthStart(month)),end=toISO(monthEnd(month));
  const outsourcedJobs=assignments.filter(a=>a.outsourced && dateOverlaps(a.start,a.end,start,end)).length;
  return {
    perTeam, availableHours, assignedHours, outsourcedJobs,
    occupancy:availableHours ? assignedHours/availableHours*100 : (assignedHours ? Infinity : 0),
    overloadedTeams:perTeam.filter(x=>x.overloadedDays>0).length,
    calendarDaysRemaining: today > monthEnd(month) ? 0 : daysBetweenInclusive(today < monthStart(month) ? monthStart(month) : today, monthEnd(month)).length,
    remainingBusinessDays:businessDays(Math.max(today.getTime(),monthStart(month).getTime()) > monthEnd(month).getTime()
       ? new Date(monthEnd(month).getFullYear(),monthEnd(month).getMonth()+1,1)
       : new Date(Math.max(today.getTime(),monthStart(month).getTime())),monthEnd(month),excludedDates).length,
    workingDays:businessDays(monthStart(month),monthEnd(month),excludedDates).length,
    netHours:availableHours-assignedHours,
  };
}
export function canAddAssignmentWithoutOverbooking(candidate,assignments,teams,employees,absences,excludedDates=[]) {
  if (candidate.outsourced) return {ok:true};
  const team=teams.find(t=>t.id===candidate.teamId);
  if(!team) return {ok:false,reason:'Seleccioná un equipo válido.'};
  const relevant=assignments.filter(a=>a.id!==candidate.id).concat(candidate);
  for(const day of businessDays(candidate.start,candidate.end,excludedDates)) {
    const iso=toISO(day);
    const capacity=employees.filter(e=>e.teamId===team.id && employeeAvailableOn(e,iso,absences)).length*HRS_PER_DAY;
    const demand=relevant.filter(a=>a.teamId===team.id).reduce((s,a)=>s+demandForDay(a,iso),0);
    if(demand>capacity) return {ok:false,reason:`El ${iso} se necesitan ${demand} h y solo hay ${capacity} h disponibles. Activá «Permitir sobreocupación» para guardar.`};
  }
  return {ok:true};
}
export function formatHours(n) {return `${Math.round(n).toLocaleString('es-AR')} h`;}
export function formatPercent(n) {return Number.isFinite(n) ? `${Math.round(n)} %`:'Sin capacidad';}
export function fmtDate(value) {
  const d=typeof value==='string' ? fromISO(value):value;
  return d ? new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d):'Sin fecha';
}
export function formatMonth(date) {return new Intl.DateTimeFormat('es-AR',{month:'long',year:'numeric'}).format(date);}
