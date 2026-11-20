/** Rangos compartidos por el Gantt operativo y el Gantt por proyecto. Sin UTC. */
import {addDays,firstDay,lastDay,monthDates,monthKey,buildMonthPlan} from './planner.js';

export const RANGE_OPTIONS=[
  {value:'today',label:'Ver desde hoy'},
  {value:'start',label:'Ver desde inicio'},
  {value:'15',label:'Próximos 15 días'},
  {value:'30',label:'Próximos 30 días'},
  {value:'month',label:'Mes elegido'}
];
export const PROJECT_RANGE_OPTIONS=[{value:'full',label:'Obra completa'},...RANGE_OPTIONS];
export function datesBetween(start,end){
  if(!start||!end||end<start)return [];
  const out=[];
  for(let d=start;d<=end;d=addDays(d,1))out.push(d);
  return out;
}
export function ganttDates(mode,{month,today,start,end}={}){
  if(mode==='full')return datesBetween(start,end); // Solo actividad real de la obra; no prolongar hasta hoy.
  if(mode==='15'||mode==='30')return datesBetween(today,addDays(today,Number(mode)-1));
  if(mode==='today')return datesBetween(today,lastDay(monthKey(today)));
  if(mode==='start'){
    const beginning=start||firstDay(month||monthKey(today));
    const finish=[end||beginning,today].filter(Boolean).sort().at(-1);
    return datesBetween(beginning,finish);
  }
  return monthDates(month||monthKey(today));
}
export function sumDays(teamDays=[]){
  const load=teamDays.reduce((s,d)=>s+Number(d.load||0),0);
  const capacity=teamDays.reduce((s,d)=>s+Number(d.capacity||0),0);
  return {load,capacity,occupancy:capacity?load/capacity*100:load?Infinity:0,over:Math.max(0,load-capacity)};
}
export function periodCapacity(config,dates=[]){
  if(!dates.length)return {teamDays:[],daily:[],...sumDays([]),dates};
  const monthly=new Map([...new Set(dates.map(monthKey))].map(month=>[month,buildMonthPlan({...config,month})]));
  const teams=config.teams||[];
  const teamDays=teams.map(team=>{
    const dayRows=dates.map(date=>monthly.get(monthKey(date))?.teamDays.find(t=>t.id===team.id)?.dates.find(d=>d.date===date)||{date,capacity:0,load:0,people:0});
    return {...team,dates:dayRows,...sumDays(dayRows)};
  });
  const daily=dates.map((date,index)=>({date,...sumDays(teamDays.map(t=>t.dates[index]))}));
  return {...sumDays(teamDays),teamDays,daily,dates};
}
