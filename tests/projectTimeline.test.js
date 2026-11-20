import test from 'node:test';import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {taskWindow,intervalCapacity,progressOverview,validateTaskDates} from '../src/lib/projectTimeline.js';
const ms=[{id:'1',teamId:'T',start:'2026-01-01',active:true},{id:'2',teamId:'T',start:'2026-01-01',active:true}];
test('Gantt del proyecto usa jornadas de 5h viernes y salta fin de semana',()=>{
 const task=taskWindow({start:'2026-11-20',personHours:22,teamId:'T',members:ms,week:WEEK});
 assert.equal(task.end,'2026-11-23');assert.equal(task.days,2);
});
test('La ventana utiliza feriados y bajas, sin inventar gente',()=>{
 const task=taskWindow({start:'2026-11-20',personHours:18,teamId:'T',members:ms,week:WEEK,holidays:[{date:'2026-11-20',active:true}],absences:[{memberId:'2',start:'2026-11-23',end:'2026-11-23'}]});
 assert.equal(task.end,'2026-11-24');
});
test('El cálculo entre fechas sirve para advertencia de sobrecarga sin consumir capacidad',()=>{
 assert.equal(intervalCapacity({start:'2026-11-20',end:'2026-11-23',teamId:'T',members:ms,week:WEEK}),22);
});
test('El progreso se pondera por horas-persona, no por cantidad de tareas',()=>{
 const p=progressOverview([{personHours:10,progress:100,status:'finalizada'},{personHours:30,progress:20,status:'en_curso'}]);
 assert.equal(p.percent,40);assert.equal(p.finished,1);
});
test('No permite mover fechas ni equipo histórico; sí progreso',()=>{
 const old={name:'Tarea',component:'Panel',teamId:'T',start:'2026-11-19',end:'2026-11-19',personHours:6,progress:0};
 assert.equal(validateTaskDates(old,{...old,progress:40},'2026-11-20'),true);
 assert.throws(()=>validateTaskDates(old,{...old,end:'2026-11-21'},'2026-11-20'),/histórica/);
});

test('Una tarea puede existir sin clasificador de componente',()=>{
 assert.equal(validateTaskDates(null,{name:'Descarga de vidrios',teamId:'T',start:'2026-11-24',end:'2026-11-24',personHours:4,progress:0},'2026-11-20'),true);
});
