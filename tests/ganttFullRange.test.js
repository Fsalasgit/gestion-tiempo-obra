import test from 'node:test';
import assert from 'node:assert/strict';
import {ganttDates,PROJECT_RANGE_OPTIONS,RANGE_OPTIONS} from '../src/lib/ganttRange.js';
import {buildProjectSchedule,firstProjectActivityDate,summarizeProjectSchedule} from '../src/lib/projectSchedule.js';
import {WEEK} from '../src/lib/domain.js';
const calendar={week:WEEK,holidays:[],recesses:[],specialDays:[]};
test('Obra completa incluye exactamente el primer y último día de tareas y no prolonga hasta hoy',()=>{
 const tasks=[{id:'1',name:'Soportes',teamId:'T1',projectId:'P1',start:'2026-11-23',durationDays:2,incidents:[]},
 {id:'2',name:'Vidrios',teamId:'T1',projectId:'P1',start:'2026-12-01',durationDays:2,incidents:[]}];
 const scheduled=buildProjectSchedule(tasks,calendar,'P1');
 const days=ganttDates('full',{start:firstProjectActivityDate(scheduled),end:summarizeProjectSchedule(scheduled).end,today:'2027-01-15',month:'2026-11'});
 assert.equal(days[0],'2026-11-23');
 assert.equal(days.at(-1),'2026-12-02');
 assert.equal(days.length,10);
});
test('Obra completa comienza con una incidencia previa a la primera jornada efectiva',()=>{
 const tasks=[{id:'1',name:'Vidrios',teamId:'T1',projectId:'P1',start:'2026-11-23',durationDays:1,incidents:[{date:'2026-11-23',reason:'clima'}]}];
 const scheduled=buildProjectSchedule(tasks,calendar,'P1');
 const dates=ganttDates('full',{start:firstProjectActivityDate(scheduled),end:summarizeProjectSchedule(scheduled).end,today:'2026-11-20'});
 assert.deepEqual(dates,['2026-11-23','2026-11-24']);
});
test('El botón Obra completa aparece solo en el Gantt por proyecto',()=>{
 assert.equal(PROJECT_RANGE_OPTIONS[0].value,'full');
 assert.ok(!RANGE_OPTIONS.some(o=>o.value==='full'));
 assert.deepEqual(ganttDates('full',{start:'',end:''}),[]);
});
