import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {defaultWorkerIds,dailyBlockCoverage,monthlyBlockCoverage,rescheduleBlock,reprogramStats,rgbaColor,teamColor} from '../src/lib/taskPlanning.js';
const members=[{id:'m1',name:'Uno',teamId:'T',kind:'fijo',start:'2026-01-01',active:true},{id:'m2',name:'Dos',teamId:'T',kind:'fijo',start:'2026-01-01',active:true},{id:'ax',name:'Auxiliar',kind:'auxiliar',start:'2026-01-01',active:true}];
const base={date:'2026-11-23',members,absences:[],week:WEEK,holidays:[],recesses:[],projects:[{id:'A',grupo:'Colocación'}],estimates:[]};
const b=(id,effort,workers=['m1','m2'])=>({id,teamId:'T',projectId:'A',date:'2026-11-23',status:'planificado',workers,personHours:effort});
test('Cobertura completa con dos operarios de 6 horas, sin duplicar sus horas',()=>{
 const blocks=[b('A',12),b('B',12)];
 const r=dailyBlockCoverage({...base,blocks});
 assert.equal(r.A.covered,12);assert.equal(r.A.coverage,100);
 assert.equal(r.B.covered,0);assert.equal(r.B.missing,12);
 assert.deepEqual(monthlyBlockCoverage({...base,month:'2026-11',blocks}),{planned:24,covered:12,missing:12});
});
test('Quitar un operario libera 6 horas que se deben reasignar',()=>{
 const r=dailyBlockCoverage({...base,blocks:[b('A',12,['m1'])]});
 assert.equal(r.A.coverage,50);assert.equal(r.A.missing,6);
});
test('La reserva parcial por trabajador reduce la cobertura',()=>{
 const r=dailyBlockCoverage({...base,blocks:[{...b('A',12),workerHours:{m1:3,m2:6}}]});
 assert.equal(r.A.covered,9);assert.equal(r.A.missing,3);
});
test('La baja y el auxiliar solicitado afectan las horas disponibles ese día',()=>{
 const absences=[{memberId:'m1',start:'2026-11-23',end:'2026-11-23'}];
 assert.deepEqual(defaultWorkerIds('T','2026-11-23',members,absences),['m2']);
 const supportShifts=[{memberId:'ax',teamId:'T',date:'2026-11-23'}];
 const r=dailyBlockCoverage({...base,absences,supportShifts,blocks:[b('A',12,['m2','ax'])]});
 assert.equal(r.A.covered,12);
});
test('Reprogramar obliga a indicar motivo y conserva cada evento histórico',()=>{
 const src={...b('A',12),reprogramHistory:[]};
 assert.throws(()=>rescheduleBlock(src,{date:'2026-11-24'},'', '2026-11-19'),/motivo/);
 const moved=rescheduleBlock(src,{date:'2026-11-24'},'Lluvia / mal tiempo','2026-11-19');
 assert.equal(moved.status,'planificado');assert.equal(moved.reprogramHistory.length,1);
 const back=rescheduleBlock(moved,{date:''},'Falta de material','2026-11-19');
 assert.equal(back.status,'backlog');assert.equal(back.reprogramHistory.length,2);
 const stats=reprogramStats([back]);assert.equal(stats.total,1);assert.equal(stats.reprograms,2);assert.equal(stats.backlog,1);
 assert.throws(()=>rescheduleBlock({...src,date:'2026-11-18'}, {date:'2026-11-25'},'Lluvia','2026-11-19'),/pasada/);
});
test('El selector conserva rgba y asigna un color estándar',()=>{
 assert.equal(rgbaColor(300,-2,31,.55),'rgba(255,0,31,0.55)');
 assert.equal(teamColor({color:'rgba(12,34,56,0.65)'}),'rgba(12,34,56,0.65)');
 assert.match(teamColor({},1),/^rgba\(/);
});

test('El cubito de 6 horas utiliza 3 horas de cada operario y deja el resto libre',()=>{
 const r=dailyBlockCoverage({...base,blocks:[b('A',6),b('B',12)]});
 assert.equal(r.A.workers.find(w=>w.id==='m1').hours,3);
 assert.equal(r.A.workers.find(w=>w.id==='m2').hours,3);
 assert.equal(r.B.covered,6);assert.equal(r.B.missing,6);
});
