import {countDailyHours} from './domain.js';
import {activePeople} from './planner.js';
import {canEditBlock,moveBlock} from './workBlocks.js';

export const DEFAULT_TEAM_COLORS=['rgba(201,35,59,1)','rgba(27,127,141,1)','rgba(91,77,159,1)','rgba(212,123,37,1)','rgba(46,129,86,1)','rgba(129,71,105,1)'];
export const teamColor=(team,index=0)=>/^rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s*\)$/i.test(team?.color||'')?team.color:DEFAULT_TEAM_COLORS[index%DEFAULT_TEAM_COLORS.length];
export function rgbaColor(red,green,blue,alpha=1){
 const clamp=(v,max)=>Math.min(max,Math.max(0,Number(v)||0));
 return `rgba(${Math.round(clamp(red,255))},${Math.round(clamp(green,255))},${Math.round(clamp(blue,255))},${Number(clamp(alpha,1).toFixed(2))})`;
}

export const getAvailableWorkers=(teamId,date,members=[],absences=[],supportShifts=[])=>activePeople(teamId,date,members,absences,supportShifts);
export const defaultWorkerIds=(teamId,date,members=[],absences=[],supportShifts=[])=>getAvailableWorkers(teamId,date,members,absences,supportShifts).map(p=>p.id);

// Una hora de un operario se asigna a un solo cubito del día. El orden visible
// de los cubitos establece su prioridad de reserva. Esto NO mide productividad real.
export function dailyBlockCoverage({date,blocks=[],members=[],absences=[],supportShifts=[],specialDays=[],week=[],holidays=[],recesses=[],projects=[],estimates=[]}) {
 const budget=new Map();
 const availableByTeam=new Map();
 const outsourced=new Set(estimates.filter(e=>e?.outsourced===true||String(e?.outsourced)==='true').map(e=>String(e.projectId)));
 const excluded=new Set(projects.filter(p=>/retiro\s+en\s+abalum/i.test(String(p.grupo||'').normalize('NFD').replace(/[\u0300-\u036f]/g,''))).map(p=>String(p.id)));
 const output={};
 for(const b of blocks){
  if(b.date!==date || b.status==='backlog'||outsourced.has(String(b.projectId))||excluded.has(String(b.projectId)))continue;
  const need=Math.max(0,Number(b.personHours)||0);
  const all=availableByTeam.get(b.teamId)||getAvailableWorkers(b.teamId,date,members,absences,supportShifts);
  availableByTeam.set(b.teamId,all);
  const available=new Set(all.map(p=>p.id));
  const dailyHours=countDailyHours(date,week,holidays,recesses,b.projectId,specialDays,b.teamId);
  const ids=[...new Set(b.workers||[])];
  const entries=[];
  let requested=0;
  const limits=new Map();
  for(const id of ids){
   if(!available.has(id)) {entries.push({id,hours:0,requested:0,available:false});continue;}
   if(!budget.has(id))budget.set(id,dailyHours);
   const specified=b.workerHours&&Object.prototype.hasOwnProperty.call(b.workerHours,id)?Number(b.workerHours[id]):dailyHours;
   const requestedHours=Math.max(0,Math.min(dailyHours,Number.isFinite(specified)?specified:0));
   requested+=requestedHours;
   limits.set(id,Math.min(requestedHours,budget.get(id)));
  }
  // Reparto equitativo, sin superar la jornada individual ni el esfuerzo del cubito.
  const allocated=new Map([...limits.keys()].map(id=>[id,0]));
  let remaining=Math.min(need,[...limits.values()].reduce((s,v)=>s+v,0));
  for(let round=0;round<=ids.length && remaining>0.000001;round++){
   const usable=[...limits.keys()].filter(id=>limits.get(id)-allocated.get(id)>0.000001);
   if(!usable.length)break;
   const share=remaining/usable.length;
   let taken=0;
   for(const id of usable){
    const amount=Math.min(share,limits.get(id)-allocated.get(id));
    allocated.set(id,allocated.get(id)+amount);taken+=amount;
   }
   remaining-=taken;
  }
  const covered=[...allocated.values()].reduce((sum,h)=>sum+h,0);
  for(const id of ids){
   if(!available.has(id))continue;
   const actual=allocated.get(id)||0;
   budget.set(id,Number((budget.get(id)-actual).toFixed(5)));
   entries.push({id,hours:Number(actual.toFixed(3)),requested:b.workerHours?.[id]??dailyHours,available:true});
  }
  output[b.id]={need,covered:Number(covered.toFixed(3)),missing:Number(Math.max(0,need-covered).toFixed(3)),coverage:need?Math.round(100*covered/need):100,workers:entries,requested,teamId:b.teamId};
 }
 return output;
}
export function monthlyBlockCoverage({month,blocks=[],...config}) {
 const days=[...new Set(blocks.filter(b=>b.date?.slice(0,7)===month).map(b=>b.date))];
 const allocations=days.flatMap(date=>Object.values(dailyBlockCoverage({date,blocks,...config})));
 return {planned:allocations.reduce((s,b)=>s+b.need,0),covered:allocations.reduce((s,b)=>s+b.covered,0),missing:allocations.reduce((s,b)=>s+b.missing,0)};
}
export function rescheduleBlock(block,changes,reason,today){
 if(!canEditBlock(block,today)||block.status==='realizado')throw Error('Una tarea pasada o realizada no puede modificarse.');
 const targetDate=changes.date??block.date;
 const targetTeam=changes.teamId??block.teamId;
 const changed=targetDate!==block.date||targetTeam!==block.teamId;
 if(changed&&!String(reason||'').trim())throw Error('Indicá el motivo para reprogramar o cambiar de equipo.');
 const merged={...block,...changes,date:targetDate,teamId:targetTeam};
 const updated=changed?moveBlock(merged,targetDate,today):merged;
 return {...updated,
  reason:changed?String(reason).trim():updated.reason,
  reprogramHistory:changed?[...(block.reprogramHistory||[]),{at:new Date().toISOString(),fromDate:block.date||'',toDate:targetDate||'',fromTeamId:block.teamId,toTeamId:targetTeam,reason:String(reason).trim()}]:[...(block.reprogramHistory||[])]};
}
export function reprogramStats(blocks=[]){
 const totals={total:blocks.length,planned:0,backlog:0,done:0,unverified:0,reprogrammed:0,reprograms:0,pending:0,additional:0,pendingHours:0,splits:0,byProject:[]};
 const projects=new Map();
 for(const b of blocks){
  const count=b.reprogramHistory?.length||0;
  const pending=b.origin==='pendiente';
  const additional=b.origin==='extra';
  totals.pending+=Number(pending);totals.additional+=Number(additional);
  totals.pendingHours+=pending?Number(b.personHours)||0:0;totals.splits+=(b.splitHistory||[]).length;
  if(count)totals.reprogrammed++;totals.reprograms+=count;
  if(b.status==='backlog')totals.backlog++;
  else if(b.status==='realizado')totals.done++;
  else if(b.status==='sin_confirmar')totals.unverified++;
  else totals.planned++;
  const projectId=String(b.projectId||'');
  const p=projects.get(projectId)||{projectId,cubitos:0,reprograms:0,backlog:0,done:0,pending:0,additional:0,pendingHours:0,splits:0};
  p.cubitos++;p.reprograms+=count;p.backlog+=Number(b.status==='backlog');p.done+=Number(b.status==='realizado');p.pending+=Number(pending);p.additional+=Number(additional);p.pendingHours+=pending?Number(b.personHours)||0:0;p.splits+=(b.splitHistory||[]).length;
  projects.set(projectId,p);
 }
 totals.byProject=[...projects.values()].sort((a,b)=>b.reprograms-a.reprograms||b.cubitos-a.cubitos);
 return totals;
}
