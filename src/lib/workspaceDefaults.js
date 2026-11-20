import {dateISO} from './planner.js';
import {DEMO_SEED_ASSIGNMENTS} from '../data/scenario.js';

export const CAPACITY_STORAGE='obras-capacidad-ux-v6';
export const PROJECT_GANTT_STORAGE='obras-gantt-proyectos-ux-v1';

export const blankCapacity=()=>({teams:[],members:[],absences:[],supportShifts:[],specialDays:[],assignments:[],blocks:[],month:dateISO(new Date()).slice(0,7),uxVersion:6});
export const demoCapacity=()=>({
  ...blankCapacity(),
  teams:[{id:'T1',name:'Equipo A · colocación',color:'rgba(201,35,59,1)'},{id:'T2',name:'Equipo B · colocación',color:'rgba(27,127,141,1)'}],
  members:[
    {id:'M1',name:'Colaborador 01',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
    {id:'M2',name:'Colaborador 02',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
    {id:'M3',name:'Colaborador 03',teamId:'T1',kind:'fijo',start:'2026-01-01',end:'',active:true},
    {id:'M4',name:'Colaborador 04',teamId:'T2',kind:'fijo',start:'2026-01-01',end:'',active:true},
    {id:'M5',name:'Colaborador 05',teamId:'T2',kind:'fijo',start:'2026-01-01',end:'',active:true}
  ],
  assignments:DEMO_SEED_ASSIGNMENTS,
  blocks:null,
  uxVersion:0
});
export const emptyProjectGantt=()=>({tasks:[],sectors:[],projectMeta:{}});

function parseLocal(key){try{return JSON.parse(localStorage.getItem(key)||'null');}catch{return null;}}
export function readLegacyCapacity(){
  const saved=parseLocal(CAPACITY_STORAGE)||parseLocal('obras-capacidad-ux-v5')||parseLocal('obras-capacidad-ux-v3');
  if(saved&&Array.isArray(saved.teams)&&Array.isArray(saved.members)&&Array.isArray(saved.assignments))return {...blankCapacity(),...saved};
  return null;
}
export function readLegacyProjectGantt(){
  const old=parseLocal(PROJECT_GANTT_STORAGE);
  if(!Array.isArray(old?.tasks))return null;
  const next={...emptyProjectGantt(),...old,sectors:Array.isArray(old.sectors)?[...old.sectors]:[]};
  const components=new Map();
  next.tasks=old.tasks.map(t=>{
    if(t.sectorId||!t.component||/^(colocaci[oó]n|general)$/i.test(String(t.component).trim()))return t;
    const label=String(t.component).trim();
    const key=`${t.projectId}::${label.toLowerCase()}`;
    if(!components.has(key)){
      const found=next.sectors.find(s=>String(s.projectId)===String(t.projectId)&&s.name.toLowerCase()===label.toLowerCase());
      const sector=found||{id:`import-${t.projectId}-${components.size+1}`,projectId:t.projectId,name:label,createdAt:t.createdAt||''};
      if(!found)next.sectors.push(sector);
      components.set(key,sector.id);
    }
    return {...t,sectorId:components.get(key)};
  });
  return next;
}
