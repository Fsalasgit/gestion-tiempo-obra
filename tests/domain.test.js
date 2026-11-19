import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK,toISODate,effectiveStart,sortProjects,getPersonHours,estimateCrewHours,dailyCapacity,weeklyCapacity,countDailyHours,validProjectStatus,projectSummary} from '../src/lib/domain.js';
test('1 día de 2 personas equivale a 12 horas-persona; 3 personas tardan 4 horas',()=>{
 assert.equal(getPersonHours(1,'dias'),12);
 assert.equal(estimateCrewHours(1,'dias',3),4);
 assert.equal(estimateCrewHours(12,'horas',1),24);
});
test('capacidad estándar: 29 horas por persona y 87 con 3',()=>{
 assert.equal(weeklyCapacity(WEEK,1),29);assert.equal(weeklyCapacity(WEEK,3),87);
});
test('receso descuenta horas y nunca permite negativo',()=>{
 assert.equal(dailyCapacity({...WEEK[0],end:'15:00',breakStart:'11:00',breakEnd:'12:00'}),6);
 assert.equal(dailyCapacity({...WEEK[0],end:'12:00',breakStart:'09:00',breakEnd:'11:00'}),2);
});
test('Inicio reemplaza Inicio P; orden próximo primero',()=>{
 const a={numero:'a',inicio:'',inicioP:'2026-11-20'};const b={numero:'b',inicio:'2026-11-18',inicioP:'2026-11-01'};
 assert.equal(effectiveStart(b),'2026-11-18');assert.equal(sortProjects([a,b])[0],b);
});
test('feriados, recesos y viernes descontados',()=>{
 const fri='2026-11-20';assert.equal(countDailyHours(fri),5);
 assert.equal(countDailyHours(fri,WEEK,[{date:fri,active:true}]),0);
 assert.equal(countDailyHours('2026-11-23',WEEK,[],[{start:'2026-11-20',end:'2026-11-24',projectId:'p1'}],'p1'),0);
 assert.equal(countDailyHours('2026-11-23',WEEK,[],[{start:'2026-11-20',end:'2026-11-24',projectId:'p1'}],'p2'),6);
});
test('Excel fechas y terminados',()=>{
 assert.equal(toISODate('18/11/2026'),'2026-11-18');assert.equal(toISODate(46000).length,10);
 assert.equal(validProjectStatus('Terminado'),false);assert.equal(validProjectStatus('Ejecucion'),true);
});
test('una obra que desaparece del origen no aumenta la demanda y una tercerizada no consume capacidad',()=>{
 const projects=[{id:'A',numero:'PR-A'}];
 const estimates=[
   {projectId:'A',value:10,unit:'horas',outsourced:false},
   {projectId:'B',value:90,unit:'horas',outsourced:false},
   {projectId:'C',value:30,unit:'horas',outsourced:true}
 ];
 assert.equal(projectSummary(projects,estimates).personHours,20);
});
