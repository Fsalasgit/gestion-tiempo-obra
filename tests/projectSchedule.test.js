import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {buildProjectSchedule,addTaskIncident,validateDependency,summarizeProjectSchedule,firstProjectActivityDate,groupBySector,sectorSpan,taskDuration} from '../src/lib/projectSchedule.js';
const cfg={week:WEEK};
const task=(id,start,durationDays=3,other={})=>({id,name:id,start,teamId:'T',durationDays,personHours:12,progress:0,status:'pendiente',...other});
test('Una tarea genera un cuadrado por jornada, sin sábados, domingos ni feriados',()=>{
 const [a]=buildProjectSchedule([task('A','2026-11-20',3)],cfg,'PR');
 assert.deepEqual(a.days,['2026-11-20','2026-11-23','2026-11-24']);
 const [b]=buildProjectSchedule([task('B','2026-11-20',3)],{...cfg,holidays:[{date:'2026-11-23',active:true}]},'PR');
 assert.deepEqual(b.days,['2026-11-20','2026-11-24','2026-11-25']);
});
test('Sábado extra habilitado para el equipo adelanta fin sin pintar domingos',()=>{
 const input=[task('A','2026-11-20',3)];
 const [initial]=buildProjectSchedule(input,cfg,'PR');
 const [extra]=buildProjectSchedule(input,{...cfg,specialDays:[{date:'2026-11-21',teamId:'T',hours:6,enabled:true}]},'PR');
 assert.equal(initial.end,'2026-11-24');assert.equal(extra.end,'2026-11-23');
 assert.deepEqual(extra.days,['2026-11-20','2026-11-21','2026-11-23']);
});
test('Un bloqueante desplaza la tarea dependiente y una lluvia desplaza ambas',()=>{
 const tasks=[task('A','2026-11-20',2),task('B','2026-11-20',2,{dependsOn:'A'})];
 const base=buildProjectSchedule(tasks,cfg,'PR');
 assert.deepEqual(base.map(t=>t.days),[['2026-11-20','2026-11-23'],['2026-11-24','2026-11-25']]);
 const changed=addTaskIncident(tasks,'A',{date:'2026-11-20',reason:'clima'},cfg,'PR','2026-11-20');
 const shifted=buildProjectSchedule(changed,cfg,'PR');
 assert.deepEqual(shifted[0].days,['2026-11-23','2026-11-24']);
 assert.deepEqual(shifted[1].days,['2026-11-25','2026-11-26']);
 assert.deepEqual(shifted[0].incidents.map(i=>i.date),['2026-11-20']);
});
test('No permite registrar lluvia en una fecha histórica ni en un día no asignado',()=>{
 const tasks=[task('A','2026-11-20')];
 assert.throws(()=>addTaskIncident(tasks,'A',{date:'2026-11-20',reason:'clima'},cfg,'PR','2026-11-21'),/histórica/);
 assert.throws(()=>addTaskIncident(tasks,'A',{date:'2026-11-22',reason:'clima'},cfg,'PR','2026-11-20'),/jornada planificada/);
});
test('Evita dependencias circulares y autoreferencias',()=>{
 assert.throws(()=>validateDependency([task('A','2026-11-20',1,{dependsOn:'B'}),task('B','2026-11-20',1,{dependsOn:'A'})],'A','B'),/ciclo/);
 assert.throws(()=>buildProjectSchedule([task('A','2026-11-20',1,{dependsOn:'A'})],cfg,'PR'),/circular|sí misma/);
});
test('Agrupación opcional por sector y alcance de obra completa',()=>{
 const result=buildProjectSchedule([task('A','2026-11-20',2,{sectorId:'s1'}),task('B','2026-11-24',2)],cfg,'PR');
 const groups=groupBySector(result,[{id:'s1',name:'Sector 1'}]);
 assert.equal(groups.sectors[0].tasks.length,1);assert.equal(groups.general.length,1);
 assert.deepEqual(sectorSpan(groups.sectors[0].tasks),{start:'2026-11-20',end:'2026-11-23'});
 assert.deepEqual(summarizeProjectSchedule(result),{start:'2026-11-20',end:'2026-11-25',tasks:2,workDays:4,incidents:0});
});
test('Migración de fechas de v0.9: toma días hábiles y conserva horas-persona',()=>{
 assert.equal(taskDuration({start:'2026-11-20',end:'2026-11-24',personHours:20,teamId:'T'},cfg,'PR'),3);
});
test('Nunca pinta domingos aunque se intente habilitar una excepción, y el feriado prevalece sobre sábado extra',()=>{
 const holidays=[{date:'2026-11-21',active:true}];
 const [a]=buildProjectSchedule([task('A','2026-11-20',3)],{...cfg,holidays,specialDays:[{date:'2026-11-21',teamId:'T',hours:6,enabled:true},{date:'2026-11-22',teamId:'T',hours:6,enabled:true}]},'PR');
 assert.deepEqual(a.days,['2026-11-20','2026-11-23','2026-11-24']);
});
test('Lluvia en segunda jornada deja constancia gris y corre una tercera jornada',()=>{
 const input=[task('A','2026-11-20',3)];
 const edited=addTaskIncident(input,'A',{date:'2026-11-23',reason:'clima',note:'Llueve'},cfg,'PR','2026-11-20');
 const [a]=buildProjectSchedule(edited,cfg,'PR');
 assert.deepEqual(a.days,['2026-11-20','2026-11-24','2026-11-25']);
 assert.equal(a.incidents[0].note,'Llueve');
});

test('Ver desde inicio utiliza la primera jornada programada, no Inicio de la hoja proyecto',()=>{
 const catalogProject={inicio:'2026-06-01',inicioP:'2026-05-25'};
 const scheduled=buildProjectSchedule([task('A','2026-11-22',2),task('B','2026-11-26',1)],cfg,'PR');
 assert.equal(catalogProject.inicio,'2026-06-01');
 assert.equal(firstProjectActivityDate(scheduled),'2026-11-23'); // 22/11 es domingo
});
test('Una incidencia gris inicial se conserva al mostrar desde inicio',()=>{
 const scheduled=buildProjectSchedule([task('A','2026-11-20',2,{incidents:[{date:'2026-11-20',reason:'clima'}]})],cfg,'PR');
 assert.equal(scheduled[0].days[0],'2026-11-23');
 assert.equal(firstProjectActivityDate(scheduled),'2026-11-20');
 assert.equal(firstProjectActivityDate([]),'');
});

test('Un equipo puede hacer varias tareas en el mismo día en el Gantt de obra',()=>{
 const input=[task('soportes','2026-11-23',2,{teamId:'T'}),task('descarga','2026-11-23',1,{teamId:'T'})];
 const result=buildProjectSchedule(input,cfg,'PR');
 assert.equal(result[0].days[0],'2026-11-23');
 assert.equal(result[1].days[0],'2026-11-23');
});

test('Mover un cuadrado sin motivo desplaza solo jornadas restantes, no registra incidencia',async()=>{
 const {skipTaskDay,undoSkippedDay}=await import('../src/lib/projectSchedule.js');
 const input=[task('A','2026-11-23',3),task('B','2026-11-23',2,{dependsOn:'A'})];
 const changed=skipTaskDay(input,'A','2026-11-24',cfg,'PR','2026-11-20');
 const recalculated=buildProjectSchedule(changed,cfg,'PR');
 assert.deepEqual(recalculated[0].days,['2026-11-23','2026-11-25','2026-11-26']);
 assert.equal(recalculated[0].incidents.length,0);
 assert.equal(recalculated[1].start,'2026-11-27');
 const restored=undoSkippedDay(changed,'A','2026-11-24',cfg,'PR','2026-11-20');
 assert.equal(buildProjectSchedule(restored,cfg,'PR')[0].end,'2026-11-25');
});

test('Reubicar jornadas a una fecha elegida desplaza dependientes sin motivo registrado',async()=>{
 const {deferTaskDays}=await import('../src/lib/projectSchedule.js');
 const input=[task('A','2026-11-23',2),task('B','2026-11-23',1,{dependsOn:'A'})];
 const edited=deferTaskDays(input,'A','2026-11-23','2026-11-27',cfg,'PR','2026-11-20');
 const scheduled=buildProjectSchedule(edited,cfg,'PR');
 assert.deepEqual(scheduled[0].days,['2026-11-27','2026-11-30']);
 assert.equal(scheduled[1].start,'2026-12-01');
 assert.equal(scheduled[0].incidents.length,0);
 assert.throws(()=>deferTaskDays(input,'A','2026-11-23','2026-11-23',cfg,'PR','2026-11-20'),/posterior/);
});
