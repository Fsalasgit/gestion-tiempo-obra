export const WEEK = [
  {day:1,name:'Lunes',enabled:true,start:'08:00',end:'14:00',breakStart:'',breakEnd:'',target:6},
  {day:2,name:'Martes',enabled:true,start:'08:00',end:'14:00',breakStart:'',breakEnd:'',target:6},
  {day:3,name:'Miércoles',enabled:true,start:'08:00',end:'14:00',breakStart:'',breakEnd:'',target:6},
  {day:4,name:'Jueves',enabled:true,start:'08:00',end:'14:00',breakStart:'',breakEnd:'',target:6},
  {day:5,name:'Viernes',enabled:true,start:'08:00',end:'13:00',breakStart:'',breakEnd:'',target:5},
  {day:6,name:'Sábado',enabled:false,start:'08:00',end:'08:00',breakStart:'',breakEnd:'',target:0},
  {day:0,name:'Domingo',enabled:false,start:'08:00',end:'08:00',breakStart:'',breakEnd:'',target:0}
];
export const CLOSED_STATUSES = /^(terminad[oa]|finalizad[oa]|completad[oa]|cerrad[oa]|anulad[oa]|cancelad[oa])$/i;
export const ACTIVE_STATUSES = ['Ejecucion','Aprobado','Solicitado','Planificacion','Tecnica'];
export const normalizeText = value => String(value ?? '').trim();
export const normalizeKey = value => normalizeText(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
export const validProjectStatus = s => !CLOSED_STATUSES.test(normalizeText(s));
export function toISODate(input) {
  if (input == null || input === '') return '';
  if (input instanceof Date && !Number.isNaN(+input)) {
    return `${input.getFullYear()}-${String(input.getMonth()+1).padStart(2,'0')}-${String(input.getDate()).padStart(2,'0')}`;
  }
  if (typeof input === 'number' && input > 20000 && input < 90000) {
    const d = new Date(Math.round((input-25569)*86400*1000)); return d.toISOString().slice(0,10);
  }
  const str = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) return str.slice(0,10);
  const m = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`;
  return '';
}
export const effectiveStart = p => toISODate(p?.inicio) || toISODate(p?.inicioP);
export const sortProjects = projects => [...projects].sort((a,b) =>
  (effectiveStart(a) || '9999-12-31').localeCompare(effectiveStart(b) || '9999-12-31') || String(a.numero).localeCompare(String(b.numero))
);
export function getPersonHours(value, unit = 'horas', baseCrew = 2, referenceDayHours = 6) {
  const n=Number(value); if (!Number.isFinite(n) || n<0) return 0;
  return n * (unit === 'dias' ? referenceDayHours : 1) * baseCrew;
}
export function estimateCrewHours(value, unit, crew, baseCrew=2) {
  const people=Number(crew);
  return people>0 ? getPersonHours(value,unit,baseCrew)/people : 0;
}
const toMinutes = time => { const m=/^(\d{2}):(\d{2})$/.exec(time || '');return m?Number(m[1])*60+Number(m[2]):0; };
export function dailyCapacity(day) {
  if (!day?.enabled) return 0;
  const total = Math.max(0,toMinutes(day.end)-toMinutes(day.start));
  const breakMinutes = day.breakStart && day.breakEnd ? Math.max(0,toMinutes(day.breakEnd)-toMinutes(day.breakStart)) : 0;
  return Math.max(0,Math.min(Number(day.target)||0,(total-breakMinutes)/60));
}
export const weeklyCapacity = (days=WEEK, persons=1) => days.reduce((sum,day)=>sum+dailyCapacity(day),0)*Math.max(0,Number(persons)||0);
export function isDateBlocked(date, holidays=[], recesses=[], projectId='') {
  const d=toISODate(date);
  return holidays.some(h=>h.date===d && h.active!==false) || recesses.some(r=>r.start<=d && d<=r.end && (!r.projectId || String(r.projectId)===String(projectId)));
}
export function countDailyHours(date,week=WEEK,holidays=[],recesses=[],projectId='',specialDays=[],teamId='') {
  const d=toISODate(date); if(!d || isDateBlocked(d,holidays,recesses,projectId)) return 0;
  const dow = new Date(`${d}T12:00:00`).getDay();
  // Excepción puntual del sábado para UN equipo; no habilita sábados futuros.
  if(dow===6 && teamId){
    const special=(specialDays||[]).find(item=>item.date===d && item.teamId===teamId);
    if(special)return special.enabled===false?0:Math.max(0,Math.min(12,Number(special.hours)||0));
  }
  return dailyCapacity((week||WEEK).find(w=>Number(w.day)===dow));
}

export function projectSummary(projects,estimates) {
  const eligible=projects.filter(p=>!(/retiro\s+en\s+abalum/i).test(String(p.grupo||'')));
  const assigned = eligible.filter(p=>estimates.some(e=>String(e.projectId)===String(p.id)));
  const activeIds = new Set(projects.map(p=>String(p.id)));
  const total = estimates.filter(e=>activeIds.has(String(e.projectId)) && e.outsourced!==true && String(e.outsourced)!=='true' && !(/retiro\s+en\s+abalum/i).test(String(projects.find(p=>String(p.id)===String(e.projectId))?.grupo||''))).reduce((s,e)=>s+getPersonHours(e.value,e.unit),0);
  return {projects:projects.length,estimated:assigned.length,pending:eligible.length-assigned.length,personHours:total};
}
export function formatNumber(value,digits=1) {return new Intl.NumberFormat('es-AR',{maximumFractionDigits:digits}).format(Number(value)||0);}
