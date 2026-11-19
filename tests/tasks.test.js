import test from 'node:test';
import assert from 'node:assert/strict';
import {WEEK} from '../src/lib/domain.js';
import {activePeople,buildMonthPlan} from '../src/lib/planner.js';
import {isPickupProject,generateBlocks,moveBlock,splitPartial,changeMemberTeam,archiveMember} from '../src/lib/workBlocks.js';

const projects=[
 {id:'A',numero:'A',proyecto:'Obra con colocación',grupo:'Colocación'},
 {id:'R',numero:'R',proyecto:'Retiro',grupo:'RETIRO EN ABALUM'}
];
const estimates=[{projectId:'A',value:12,unit:'horas',crewReference:2},{projectId:'R',value:30,unit:'horas',crewReference:2}];
const teams=[{id:'T',name:'Colocación'}];
const members=[{id:'f1',name:'Fijo',teamId:'T',kind:'fijo',start:'2026-01-01',end:'',active:true},
 {id:'aux',name:'Auxiliar',teamId:'',kind:'auxiliar',start:'2026-01-01',end:'',active:true}];
const assignments=[{id:'p1',projectId:'A',teamId:'T',start:'2026-11-20',crew:2},{id:'p2',projectId:'R',teamId:'T',start:'2026-11-20',crew:2}];
test('Retiro en ABALUM se reconoce sin importar mayúsculas',()=>{assert.equal(isPickupProject(projects[1]),true);assert.equal(isPickupProject(projects[0]),false);});
test('Cubitos independientes y carga excluyendo retiro',()=>{
 const blocks=generateBlocks(assignments[0],estimates[0],WEEK,[],[],'2026-11-19');
 assert.deepEqual(blocks.map(x=>x.personHours),[10,12,2]);
 const m=buildMonthPlan({month:'2026-11',projects,estimates,teams,members,assignments,blocks,week:WEEK,today:'2026-11-19'});
 assert.equal(m.teamDays[0].dates.find(x=>x.date==='2026-11-20').load,10);
 assert.equal(m.totalInternalEffort,24);
});
test('El backlog elimina la carga del día; mover un cubito la cambia',()=>{
 const blocks=generateBlocks(assignments[0],estimates[0],WEEK,[],[],'2026-11-19');
 const backlog=moveBlock(blocks[0],'','2026-11-19');
 const m=buildMonthPlan({month:'2026-11',projects:projects.slice(0,1),estimates:estimates.slice(0,1),teams,members,assignments:assignments.slice(0,1),blocks:[backlog,...blocks.slice(1)],week:WEEK,today:'2026-11-19'});
 assert.equal(m.daily.find(x=>x.date==='2026-11-20').load,0);
 assert.throws(()=>moveBlock({...blocks[0],date:'2026-11-18'},'2026-11-24','2026-11-19'),/pasado/);
});
test('Una ejecución parcial conserva lo ejecutado y genera pendiente sin fecha',()=>{
 const block={id:'b1',date:'2026-11-19',personHours:12,status:'planificado',workers:['f1']};
 const {completed,remaining}=splitPartial(block,5,'2026-11-19');
 assert.equal(completed.personHours,5);assert.equal(completed.status,'realizado');
 assert.equal(remaining.personHours,7);assert.equal(remaining.status,'backlog');assert.equal(remaining.date,'');
 assert.equal(completed.personHours+remaining.personHours,12);
});
test('Auxiliar solamente aporta capacidad los días solicitados',()=>{
 const supportShifts=[{memberId:'aux',teamId:'T',date:'2026-11-20'}];
 assert.equal(activePeople('T','2026-11-19',members,[],supportShifts).length,1);
 assert.equal(activePeople('T','2026-11-20',members,[],supportShifts).length,2);
});
test('Cambios y bajas del equipo conservan historia previa',()=>{
 const m=changeMemberTeam(members[0],'OTRO','2026-11-19');
 assert.equal(activePeople('T','2026-11-18',[m]).length,1);
 assert.equal(activePeople('T','2026-11-19',[m]).length,0);
 assert.equal(activePeople('OTRO','2026-11-19',[m]).length,1);
 const archived=archiveMember(m,'2026-11-20');
 assert.equal(activePeople('OTRO','2026-11-19',[archived]).length,1);
 assert.equal(activePeople('OTRO','2026-11-20',[archived]).length,0);
});
