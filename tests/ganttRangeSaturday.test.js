import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK,countDailyHours} from '../src/lib/domain.js';
import {ganttDates,periodCapacity} from '../src/lib/ganttRange.js';
import {buildMonthPlan} from '../src/lib/planner.js';
import {canScheduleOn} from '../src/lib/workBlocks.js';
import {dailyBlockCoverage} from '../src/lib/taskPlanning.js';
import {scheduleLinear} from '../src/lib/linearCapacity.js';
import {taskWindow} from '../src/lib/projectTimeline.js';

const members=[{id:'M1',name:'1',teamId:'T1',start:'2026-01-01',active:true},{id:'M2',name:'2',teamId:'T1',start:'2026-01-01',active:true},{id:'M3',name:'3',teamId:'T2',start:'2026-01-01',active:true}];
const saturday={date:'2026-11-21',teamId:'T1',hours:6,enabled:true};
const projects=[{id:'P1',numero:'P1',grupo:'Colocación'}],estimates=[{projectId:'P1',value:6,unit:'horas',crewReference:2}];

test('Controles compartidos: hoy, inicio, quince y treinta días exactos',()=>{
 const p={today:'2026-11-20',month:'2026-10',start:'2026-11-18',end:'2026-12-05'};
 const today=ganttDates('today',p);assert.equal(today[0],'2026-11-20');assert.equal(today.at(-1),'2026-11-30');
 const d15=ganttDates('15',p);assert.equal(d15.length,15);assert.equal(d15.at(-1),'2026-12-04');
 const d30=ganttDates('30',p);assert.equal(d30.length,30);assert.equal(d30.at(-1),'2026-12-19');
 const beginning=ganttDates('start',p);assert.equal(beginning[0],'2026-11-18');assert.equal(beginning.at(-1),'2026-12-05');
 assert.equal(ganttDates('month',p).length,31);
});

test('Un sábado habilitado suma horas solo al equipo elegido y fecha exacta',()=>{
 assert.equal(countDailyHours('2026-11-21',WEEK,[],[],'P1'),0);
 assert.equal(countDailyHours('2026-11-21',WEEK,[],[],'P1',[saturday],'T1'),6);
 assert.equal(countDailyHours('2026-11-21',WEEK,[],[],'P1',[saturday],'T2'),0);
 assert.equal(countDailyHours('2026-11-28',WEEK,[],[],'P1',[saturday],'T1'),0);
 assert.equal(countDailyHours('2026-11-21',WEEK,[{date:'2026-11-21',active:true}],[],'P1',[saturday],'T1'),0);
 assert.equal(canScheduleOn('2026-11-21','P1',WEEK,[],[],[saturday],'T1'),true);
 assert.equal(canScheduleOn('2026-11-21','P1',WEEK,[],[],[saturday],'T2'),false);
});

test('Sábado especial modifica capacidad y cobertura sin duplicar horas',()=>{
 const blocks=[{id:'B1',assignmentId:'A1',projectId:'P1',teamId:'T1',date:'2026-11-21',status:'planificado',personHours:12,workers:['M1','M2']}];
 const assignment=[{id:'A1',projectId:'P1',teamId:'T1',start:'2026-11-21',crew:2}];
 const base={month:'2026-11',projects,estimates,teams:[{id:'T1',name:'A'},{id:'T2',name:'B'}],members,assignments:assignment,blocks,week:WEEK,holidays:[],recesses:[]};
 const no=buildMonthPlan(base),yes=buildMonthPlan({...base,specialDays:[saturday]});
 const absent=no.teamDays[0].dates.find(d=>d.date==='2026-11-21');
 const active=yes.teamDays[0].dates.find(d=>d.date==='2026-11-21');
 assert.deepEqual([absent.capacity,absent.load],[0,12]);
 assert.deepEqual([active.capacity,active.load],[12,12]);
 assert.equal(yes.teamDays[1].dates.find(d=>d.date==='2026-11-21').capacity,0);
 const cfg={date:'2026-11-21',blocks,members,week:WEEK,projects,estimates};
 assert.equal(dailyBlockCoverage(cfg).B1.covered,0);
 assert.equal(dailyBlockCoverage({...cfg,specialDays:[saturday]}).B1.covered,12);
 const view=periodCapacity({...base,specialDays:[saturday]},ganttDates('15',{today:'2026-11-20',month:'2026-11'}));
 const sat=view.daily.find(d=>d.date==='2026-11-21');
 assert.equal(sat.capacity,12);assert.equal(sat.load,12);
 assert.equal(view.dates.length,15);
 assert.equal(view.teamDays.find(t=>t.id==='T2').dates.find(d=>d.date==='2026-11-21').capacity,0);
});

test('Planificación lineal toma sábado habilitado y la de proyecto también',()=>{
 const args={assignment:{id:'A1',projectId:'P1',teamId:'T1',start:'2026-11-21',crew:2},estimate:estimates[0],projects,members,blocks:[],week:WEEK,today:'2026-11-20'};
 assert.equal(scheduleLinear(args).start,'2026-11-23');
 assert.equal(scheduleLinear({...args,specialDays:[saturday]}).start,'2026-11-21');
 assert.equal(taskWindow({start:'2026-11-21',personHours:12,projectId:'P1',teamId:'T1',members,week:WEEK,specialDays:[saturday]}).end,'2026-11-21');
});

test('Ocupación de próximos 15 días agrega TP de noviembre y diciembre',()=>{
 const blocks=[
  {id:'B1',assignmentId:'A1',projectId:'P1',teamId:'T1',date:'2026-11-30',status:'planificado',personHours:6,workers:['M1']},
  {id:'B2',assignmentId:'A1',projectId:'P1',teamId:'T1',date:'2026-12-01',status:'planificado',personHours:6,workers:['M1']}
 ];
 const dates=ganttDates('15',{today:'2026-11-25',month:'2026-11'});
 const p=periodCapacity({projects,estimates,teams:[{id:'T1'}],members,blocks,week:WEEK,
  assignments:[{id:'A1',projectId:'P1',teamId:'T1',start:'2026-11-25',crew:2}]},dates);
 assert.equal(p.load,12);
 assert.equal(p.daily.find(d=>d.date==='2026-11-30').load,6);
 assert.equal(p.daily.find(d=>d.date==='2026-12-01').load,6);
 assert.equal(p.dates.at(-1),'2026-12-09');
});
