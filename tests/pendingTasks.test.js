import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {derivePendingTask, splitPartial, PENDING_REASONS} from '../src/lib/workBlocks.js';
import {dailyBlockCoverage,reprogramStats} from '../src/lib/taskPlanning.js';
import {buildMonthPlan} from '../src/lib/planner.js';

const today='2026-11-20';
const day='2026-11-25';
const task={id:'TP-1',projectId:'OBRA-1',assignmentId:'PLAN-1',teamId:'EQ-1',date:day,
 personHours:12,crew:2,title:'Colocación',status:'planificado',origin:'programacion',
 workers:['P1','P2'],workerHours:{P1:2,P2:2},reprogramHistory:[]};
const projects=[{id:'OBRA-1',numero:'OBRA-1',grupo:'Colocación'}];
const estimates=[{projectId:'OBRA-1',value:6,unit:'horas',crewReference:2}];
const teams=[{id:'EQ-1',name:'Equipo 1'}];
const members=['P1','P2'].map(id=>({id,name:id,kind:'fijo',teamId:'EQ-1',start:'2026-01-01',active:true}));
const model=blocks=>buildMonthPlan({month:'2026-11',projects,estimates,teams,members,
 assignments:[{id:'PLAN-1',projectId:'OBRA-1',teamId:'EQ-1',start:day,crew:2}],blocks,week:WEEK,today});

test('Se pueden desprender 8h de una TP de 12h manteniendo 4h, personal y fecha',()=>{
 const before=dailyBlockCoverage({date:day,blocks:[task],members,projects,estimates,week:WEEK});
 assert.equal(before[task.id].covered,4);
 assert.equal(before[task.id].missing,8);
 const {original,pendingTask,event}=derivePendingTask(task,before[task.id].missing,'Falta de personal','',today);
 assert.equal(original.personHours,4);
 assert.equal(pendingTask.personHours,8);
 assert.equal(original.personHours+pendingTask.personHours,12);
 assert.equal(original.date,day);assert.equal(original.teamId,task.teamId);
 assert.deepEqual(original.workers,['P1','P2']);
 assert.equal(original.status,'planificado');
 assert.equal(pendingTask.date,'');assert.equal(pendingTask.status,'backlog');
 assert.equal(pendingTask.origin,'pendiente');assert.equal(pendingTask.parentId,task.id);
 assert.equal(pendingTask.teamId,task.teamId);assert.deepEqual(pendingTask.workers,[]);
 assert.equal(pendingTask.pendingReason,'Falta de personal');
 assert.equal(original.splitHistory[0].childId,pendingTask.id);
 assert.equal(event.pendingHours,8);
 const after=dailyBlockCoverage({date:day,blocks:[original,pendingTask],members,projects,estimates,week:WEEK});
 assert.equal(after[task.id].covered,4);assert.equal(after[task.id].missing,0);
 assert.equal(after[pendingTask.id],undefined);
 assert.equal(model([task]).daily.find(d=>d.date===day).load,12);
 assert.equal(model([original,pendingTask]).daily.find(d=>d.date===day).load,4);
 assert.equal(original.completedAt,undefined);
 assert.equal(reprogramStats([original,pendingTask]).reprograms,0);
});

test('No se pierden horas tras una segunda TP desprendida',()=>{
 const {original,pendingTask:first}=derivePendingTask(task,8,'Condiciones de obra','Sin acceso','2026-11-20');
 const {original:again,pendingTask:second}=derivePendingTask(original,2,'Otros','Falta autorización','2026-11-20');
 assert.equal(again.personHours+first.personHours+second.personHours,12);
 assert.equal(again.splitHistory.length,2);
 assert.equal(new Set([again.id,first.id,second.id]).size,3);
 const stats=reprogramStats([again,first,second]);
 assert.equal(stats.total,3);assert.equal(stats.pending,2);assert.equal(stats.additional,0);
 assert.equal(stats.pendingHours,10);assert.equal(stats.splits,2);assert.equal(stats.reprograms,0);
 assert.equal(stats.byProject[0].pending,2);
});

test('Una TP adicional no se confunde con una TP pendiente',()=>{
 const {original,pendingTask}=derivePendingTask(task,8,'Lluvia / clima','',today);
 const extra={...task,id:'extra-1',origin:'extra',personHours:3};
 const stats=reprogramStats([original,pendingTask,extra]);
 assert.equal(stats.pending,1);assert.equal(stats.additional,1);
});

test('Se exige un motivo válido y detalle si corresponde a Otros',()=>{
 assert.ok(PENDING_REASONS.includes('Falta de personal'));
 assert.ok(PENDING_REASONS.includes('Condiciones de obra'));
 assert.throws(()=>derivePendingTask(task,8,'','',today),/motivo/);
 assert.throws(()=>derivePendingTask(task,8,'Motivo desconocido','',today),/motivo/);
 assert.throws(()=>derivePendingTask(task,8,'Otros','',today),/Describí/);
 assert.equal(derivePendingTask(task,8,'Otros','Obra cerrada',today).pendingTask.pendingNote,'Obra cerrada');
});

test('No se permite desprender horas cero, el total, de una TP pasada, cerrada o backlog',()=>{
 assert.throws(()=>derivePendingTask(task,0,'Falta de personal','',today),/horas pendientes/);
 assert.throws(()=>derivePendingTask(task,12,'Falta de personal','',today),/horas pendientes/);
 assert.throws(()=>derivePendingTask(task,-2,'Falta de personal','',today),/horas pendientes/);
 assert.throws(()=>derivePendingTask({...task,date:'2026-11-19'},8,'Falta de personal','',today),/programada/);
 assert.throws(()=>derivePendingTask({...task,status:'realizado'},8,'Falta de personal','',today),/programada/);
 assert.throws(()=>derivePendingTask({...task,date:'',status:'backlog'},8,'Falta de personal','',today),/programada/);
});


test('Una ejecución parcial del día de hoy deja su saldo pendiente con motivo y sin duplicar historial',()=>{
 const current={...task,date:today,reprogramHistory:[{reason:'Lluvia'}]};
 const {completed,remaining}=splitPartial(current,4,today,'Condiciones de obra','Acceso bloqueado');
 assert.equal(completed.personHours,4);assert.equal(completed.status,'realizado');
 assert.equal(remaining.personHours,8);assert.equal(remaining.status,'backlog');
 assert.equal(remaining.pendingReason,'Condiciones de obra');
 assert.equal(remaining.pendingNote,'Acceso bloqueado');
 assert.equal(remaining.origin,'pendiente');
 assert.equal(remaining.reprogramHistory.length,0);
 assert.equal(reprogramStats([completed,remaining]).reprograms,1);
 assert.throws(()=>splitPartial(current,4,today,'Otros',''),/Describí/);
});
