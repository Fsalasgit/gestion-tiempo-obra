import test from 'node:test';import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {scheduleLinear,replanFutureLinear} from '../src/lib/linearCapacity.js';
import {buildMonthPlan} from '../src/lib/planner.js';
const projects=[{id:'p1',numero:'PR1',proyecto:'A',grupo:'Colocacion'},{id:'p2',numero:'PR2',proyecto:'B'},{id:'p3',numero:'PR3',proyecto:'Retiro',grupo:'Retiro en abalum'}];
const estimates=[{projectId:'p1',value:12,unit:'horas',crewReference:2},{projectId:'p2',value:6,unit:'horas',crewReference:2}];
const members=[{id:'u1',teamId:'T1',start:'2026-01-01',active:true},{id:'u2',teamId:'T1',start:'2026-01-01',active:true}];
const context={projects,members,week:WEEK,today:'2026-11-20'};
const a={id:'A',projectId:'p1',teamId:'T1',start:'2026-11-20',crew:2,mode:'automatic'};
const b={id:'B',projectId:'p2',teamId:'T1',start:'2026-11-20',crew:2,mode:'automatic'};
test('Respeta viernes de 5 h y pasa al lunes sin ocupar sábado ni domingo',()=>{
 const p=scheduleLinear({...context,assignment:a,estimate:estimates[0]});
 assert.equal(p.blocks[0].date,'2026-11-20');assert.equal(p.blocks[0].personHours,10);
 assert.equal(p.blocks[1].date,'2026-11-23');assert.equal(p.blocks[1].personHours,12);
 assert.equal(p.blocks[2].date,'2026-11-24');assert.equal(p.blocks[2].personHours,2);
});
test('No superpone otra obra del mismo equipo: la segunda empieza al día libre',()=>{
 const p1=scheduleLinear({...context,assignment:a,estimate:estimates[0]});
 const p2=scheduleLinear({...context,assignment:b,estimate:estimates[1],blocks:p1.blocks});
 assert.equal(p2.start,'2026-11-25');
 assert.equal(new Set([...p1.blocks,...p2.blocks].map(b=>b.date)).size,4);
 const result=buildMonthPlan({month:'2026-11',projects,estimates,teams:[{id:'T1',name:'Equipo'}],members,week:WEEK,
 assignments:[a,b],blocks:[...p1.blocks,...p2.blocks],today:'2026-11-20'});
 assert.equal(result.load,36);
 assert.equal(Math.max(...result.teamDays[0].dates.map(d=>d.load-d.capacity)),0);
});
test('Baja un operario, amplía fechas, nunca inventa 2 personas',()=>{
 const absences=[{memberId:'u2',start:'2026-11-20',end:'2026-11-27'}];
 const p=scheduleLinear({...context,assignment:a,estimate:estimates[0],absences});
 assert.equal(p.blocks[0].crew,1);assert.equal(p.blocks[0].personHours,5);
 assert.equal(p.blocks[1].personHours,6);
});
test('Feriados y recesos se saltan',()=>{
 const p=scheduleLinear({...context,assignment:a,estimate:estimates[0],holidays:[{date:'2026-11-20',active:true}],recesses:[{start:'2026-11-23',end:'2026-11-24',projectId:'p1'}]});
 assert.equal(p.start,'2026-11-25');
});
test('Auxiliar asignado al día suma capacidad en esa fecha',()=>{
 const ms=[...members,{id:'aux',kind:'auxiliar',teamId:'',start:'2026-01-01',active:true}];
 const plan=scheduleLinear({...context,assignment:{...a,crew:3},estimate:estimates[0],members:ms,supportShifts:[{memberId:'aux',teamId:'T1',date:'2026-11-23'}]});
 assert.equal(plan.blocks[1].crew,3);
});
test('No permite planificar Retiro en ABALUM ni tercerizadas',()=>{
 assert.throws(()=>scheduleLinear({...context,assignment:{...a,projectId:'p3'},estimate:{value:6,unit:'horas'}}),/Retiro/);
 assert.throws(()=>scheduleLinear({...context,assignment:a,estimate:{...estimates[0],outsourced:true}}),/tercerizada/);
});
test('Recalcular conserva pasado e incluso TP manual, mueve futuras según capacidad',()=>{
 const past={id:'hist',assignmentId:'A',teamId:'T1',projectId:'p1',date:'2026-11-19',origin:'lineal',personHours:12,status:'sin_confirmar'};
 const manual={id:'manual',assignmentId:'C',teamId:'T1',projectId:'p2',date:'2026-11-20',personHours:12,status:'planificado',workers:['u1','u2']};
 const stale={id:'old',assignmentId:'A',teamId:'T1',projectId:'p1',date:'2026-11-20',origin:'lineal',personHours:12,status:'planificado'};
 const res=replanFutureLinear({...context,assignments:[a],estimates,blocks:[past,manual,stale]});
 assert.equal(res.blocks.find(b=>b.id==='hist'),past);
 assert.equal(res.blocks.find(b=>b.id==='manual'),manual);
 assert.equal(res.blocks.some(b=>b.id==='old'),false);
 assert.equal(res.results[0].start,'2026-11-23');
 assert.equal(res.results[0].total,12);
});
test('Cruza mes sin sobrecarga ni cortar obra',()=>{
 const result=scheduleLinear({...context,assignment:{...a,start:'2026-11-30'},estimate:estimates[0]});
 assert.equal(result.monthOverflow,true);assert.equal(result.end.slice(0,7),'2026-12');
});
test('Recalcular no borra una TP automática confirmada hoy ni una editada manualmente',()=>{
 const confirmed={id:'done',assignmentId:'A',teamId:'T1',projectId:'p1',date:'2026-11-20',origin:'lineal',personHours:5,status:'realizado',workers:['u1']};
 const edited={id:'edited',assignmentId:'A',teamId:'T1',projectId:'p1',date:'2026-11-23',origin:'manual',personHours:6,status:'planificado',workers:['u1']};
 const result=replanFutureLinear({...context,assignments:[a],estimates,blocks:[confirmed,edited]});
 assert.equal(result.blocks.find(b=>b.id==='done'),confirmed);
 assert.equal(result.blocks.find(b=>b.id==='edited'),edited);
 assert.equal(result.results[0].total,13);
});
