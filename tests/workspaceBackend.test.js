import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

function sandboxBackend(){
 class Sheet{
  constructor(name,rows=[]){this.name=name;this.rows=rows;this.maxRows=1000;}
  getLastRow(){for(let i=this.rows.length-1;i>=0;i--)if(this.rows[i]?.some(x=>x!==''&&x!==undefined))return i+1;return 0;}
  getMaxRows(){return this.maxRows;}
  insertRowsAfter(_,count){this.maxRows+=count;}
  getRange(row,col,count=1,width=1){const api={
   getValues:()=>Array.from({length:count},(_,i)=>Array.from({length:width},(_,j)=>this.rows[row+i-1]?.[col+j-1]??'')),
   setValues:values=>{values.forEach((r,i)=>{const pos=row+i-1;this.rows[pos] ||= [];r.forEach((v,j)=>{this.rows[pos][col+j-1]=v;});});return this;},
   clearContent:()=>{for(let i=0;i<count;i++)for(let j=0;j<width;j++)if(this.rows[row+i-1])this.rows[row+i-1][col+j-1]='';return this;},
   setFontWeight:()=>api,setBackground:()=>api,setFontColor:()=>api,setNumberFormat:()=>api,setValue:v=>{this.rows[row-1] ||= [];this.rows[row-1][col-1]=v;return api;}
  };return api;}
  appendRow(row){this.rows[this.getLastRow()]=row;}
  setFrozenRows(){}
  deleteRow(row){this.rows.splice(row-1,1);}
 }
 const sheets=new Map();
 const ss={setSpreadsheetTimeZone(){},getSheetByName(name){return sheets.get(name)||null;},insertSheet(name){const s=new Sheet(name);sheets.set(name,s);return s;},getUrl(){return 'test://sheet'}};
 const props=new Map([['SPREADSHEET_ID','spreadsheet-test'],['SUPERADMIN_USERNAME','admin'],['SUPERADMIN_PASSWORD','demo-secure-password']]);
 const cacheMap=new Map();
 let routeCalls=0;
 const routeLeg={distance:{value:21375},duration:{value:1970},start_address:'Avenida Siria 1633',end_address:'Destino corroborado por Google'};
 const directionFinder={setOrigin(){return this;},setDestination(){return this;},setMode(){return this;},setRegion(){return this;},setLanguage(){return this;},getDirections(){routeCalls++;return {routes:[{legs:[routeLeg]}]};}};
 const context=vm.createContext({console,Date,JSON,Map,Set,Error,Logger:{log(){}},
  ContentService:{MimeType:{JSON:'json'},createTextOutput:txt=>({setMimeType(){return this;},getContent(){return txt;}})},
  Maps:{DirectionFinder:{Mode:{DRIVING:'driving'}},newDirectionFinder:()=>directionFinder},
  CacheService:{getScriptCache:()=>({get:key=>cacheMap.get(key)||null,put:(key,value)=>cacheMap.set(key,value),remove:key=>cacheMap.delete(key)})},
  PropertiesService:{getScriptProperties:()=>({getProperty:key=>props.get(key)||null,deleteProperty:key=>props.delete(key)})},
  SpreadsheetApp:{openById:()=>ss,flush(){}},
  LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
  Utilities:{newBlob:bytes=>({getBytes:()=>[...Buffer.from(bytes)],getDataAsString:()=>Buffer.from(bytes).toString('utf8')}),formatDate:date=>new Date(date).toISOString().slice(0,19),DigestAlgorithm:{SHA_256:'SHA_256'},computeDigest:(_name,value)=>[...crypto.createHash('sha256').update(Buffer.from(typeof value==='string'?value:value)).digest()],base64EncodeWebSafe:bytes=>Buffer.from(bytes).toString('base64url'),base64DecodeWebSafe:encoded=>[...Buffer.from(encoded,'base64url')],getUuid:()=>crypto.randomUUID()},
 });
 const source=fs.readFileSync(new URL('../backend/apps-script/Code.gs',import.meta.url),'utf8');
 vm.runInContext(source,context);
 vm.runInContext('setup()',context);
 return {context,sheets,getRouteCalls:()=>routeCalls,run:expression=>vm.runInContext(expression,context)};
}
function sampleCapacity(){return {teams:[{id:'T1',name:'EQUIPO A'}],members:[],absences:[],supportShifts:[],specialDays:[],assignments:[],blocks:[],month:'2026-11',uxVersion:6};}
function sampleGantt(){return {tasks:[{id:'T-1',projectId:'P1',name:'Colocación de soportes',start:'2026-11-23',durationDays:2,teamId:'T1',incidents:[{date:'2026-11-24',reason:'clima'}]}],sectors:[{id:'S1',name:'Sector 1',projectId:'P1'}],projectMeta:{}};}
test('backend crea pestañas separadas sin reemplazar proyecto',()=>{
 const env=sandboxBackend();
 assert.ok(env.sheets.has('workspace_meta'));
 assert.ok(env.sheets.has('workspace_chunks'));
 const projectSheet=env.sheets.get('proyecto');const before=JSON.stringify(projectSheet.rows);
 env.context.dataForTest=sampleGantt();
 const result=env.run("saveWorkspace_('projectGantt',dataForTest,0,{username:'admin'})");
 assert.equal(result.revision,1);
 assert.equal(JSON.stringify(projectSheet.rows),before);
});
test('guarda y recupera sectores, tareas, dependencias e incidencias',()=>{
 const env=sandboxBackend();env.context.draft=sampleGantt();
 env.run("saveWorkspace_('projectGantt',draft,0,{username:'admin'})");
 const saved=env.run("loadWorkspace_('projectGantt')");
 assert.equal(saved.revision,1);
 assert.equal(saved.value.tasks[0].incidents[0].reason,'clima');
 assert.equal(saved.value.sectors[0].name,'Sector 1');
});
test('rechaza una edición concurrente sin pisar la versión actual',()=>{
 const env=sandboxBackend();env.context.draft=sampleGantt();
 env.run("saveWorkspace_('projectGantt',draft,0,{username:'admin'})");
 env.context.draft=sampleGantt();env.context.draft.tasks[0].name='Editado en navegador B';
 assert.throws(()=>env.run("saveWorkspace_('projectGantt',draft,0,{username:'admin'})"),e=>e.code==='STALE_REVISION');
 assert.equal(env.run("loadWorkspace_('projectGantt')").value.tasks[0].name,'Colocación de soportes');
});
test('planificación mensual y Gantt evolucionan en versiones independientes',()=>{
 const env=sandboxBackend();env.context.gantt=sampleGantt();env.context.capacity=sampleCapacity();
 env.run("saveWorkspace_('projectGantt',gantt,0,{username:'admin'})");
 env.run("saveWorkspace_('capacity',capacity,0,{username:'admin'})");
 env.run("saveWorkspace_('capacity',capacity,1,{username:'planificador'})");
 assert.equal(env.run("loadWorkspace_('capacity')").revision,2);
 assert.equal(env.run("loadWorkspace_('projectGantt')").revision,1);
});
test('fragmenta un documento de más de 50.000 caracteres y verifica integridad',()=>{
 const env=sandboxBackend();env.context.capacity=sampleCapacity();
 env.context.capacity.blocks=Array.from({length:700},(_,i)=>({id:'B'+i,name:'Trabajo '+i,notes:'Información del cliente · x'.repeat(4)}));
 const out=env.run("saveWorkspace_('capacity',capacity,0,{username:'admin'})");
 assert.ok(env.sheets.get('workspace_chunks').getLastRow()>3);
 assert.equal(env.run("loadWorkspace_('capacity')").value.blocks.length,700);
 assert.equal(out.revision,1);
});
test('no admite documentos que intenten editar el catálogo o excedan el límite',()=>{
 const env=sandboxBackend();env.context.value=sampleCapacity();
 env.context.value.projects=[{id:'nueva-obra'}];
 // Un campo inesperado no modifica catálogo; el contrato explícito solo deja guardar workspaces.
 env.run("saveWorkspace_('capacity',value,0,{username:'admin'})");
 assert.equal(env.sheets.get('proyecto').getLastRow(),1);
 assert.throws(()=>env.run("saveWorkspace_('proyecto',value,0,{username:'admin'})"));
 env.context.value=sampleCapacity();env.context.value.blocks=[{id:'oversize',notes:'x'.repeat(1000001)}];
 assert.throws(()=>env.run("saveWorkspace_('capacity',value,1,{username:'admin'})"),/1.000.000/);
});

test('preserva Unicode y evita contenido interpretado como fórmula en fragmentos',()=>{
 const env=sandboxBackend();env.context.draft=sampleGantt();
 env.context.draft.tasks[0].notes='=IMPORTXML(A1) · instalación 🏗️ / edificio';
 env.run("saveWorkspace_('projectGantt',draft,0,{username:'admin'})");
 const chunks=env.sheets.get('workspace_chunks').rows.slice(1).filter(Boolean);
 assert.ok(chunks.every(row=>/^[a-zA-Z0-9_-]+$/.test(row[3])));
 assert.equal(env.run("loadWorkspace_('projectGantt')").value.tasks[0].notes,'=IMPORTXML(A1) · instalación 🏗️ / edificio');
});

test('rutas ida toma dirección de tiempo_obra y no altera catálogo',()=>{
 const env=sandboxBackend();
 const before=JSON.stringify(env.sheets.get('proyecto').rows);
 env.run("append_('proyecto',{id:'P1',numero:'PR-1',proyecto:'Obra test',localidad:'Yerba Buena, Tucumán'})");
 env.run("append_('tiempo_obra',{projectId:'P1',address:'Av. Aconquija 1200'})");
 const result=env.run("logisticsRoute_('P1',{username:'admin'})");
 assert.equal(result.distanceMeters,21375);
 assert.equal(result.drivingDurationSeconds,1970);
 assert.equal(result.destinationResolved,'Destino corroborado por Google');
 assert.equal(env.getRouteCalls(),1);
 assert.equal(env.sheets.get('proyecto').getLastRow(),2);
 assert.notEqual(JSON.stringify(env.sheets.get('proyecto').rows),before);
});
test('cache de rutas evita repetir solicitudes al mapa',()=>{
 const env=sandboxBackend();
 env.run("append_('proyecto',{id:'P1',numero:'PR-1',localidad:'Tucumán'})");
 env.run("append_('tiempo_obra',{projectId:'P1',address:'Av. Aconquija 1200'})");
 env.run("logisticsRoute_('P1',{username:'admin'})");
 const next=env.run("logisticsRoute_('P1',{username:'admin'})");
 assert.equal(next.cached,true);assert.equal(env.getRouteCalls(),1);
});
test('consulta de rutas exige obra y dirección existentes',()=>{
 const env=sandboxBackend();
 assert.throws(()=>env.run("logisticsRoute_('P-desconocido',{username:'admin'})"),/proyecto ya no figura/);
 env.run("append_('proyecto',{id:'P1',numero:'PR-1'})");
 assert.throws(()=>env.run("logisticsRoute_('P1',{username:'admin'})"),/no tiene dirección/);
});

test('cuenta CLIENTE solo consulta proyectos asignados y no recibe planillas internas',()=>{
 const env=sandboxBackend();
 env.run("append_('proyecto',{id:'P1',numero:'PR1',cliente:'Cliente A',proyecto:'Fachada A'})");
 env.run("append_('proyecto',{id:'P2',numero:'PR2',cliente:'Cliente B',proyecto:'Fachada B'})");
 env.context.gantt={tasks:[
  {id:'a',projectId:'P1',name:'Colocación',teamId:'T1',start:'2026-11-23',durationDays:2,notes:'COSTO INTERNO: 999',incidents:[]},
  {id:'b',projectId:'P2',name:'Otro cliente',teamId:'T2',start:'2026-11-23',durationDays:1,incidents:[]}
 ],sectors:[],projectMeta:{}};
 env.context.capacity=sampleCapacity();
 env.run("saveWorkspace_('projectGantt',gantt,0,{username:'admin'})");
 env.run("saveWorkspace_('capacity',capacity,0,{username:'admin'})");
 env.context.admin={username:'admin'};
 env.context.clientUser={username:'cliente1',name:'Cliente Uno',role:'CLIENTE',active:true,password:'1',projectIds:'P1'};
 env.run('saveUser_(clientUser,admin)');
 const actor=env.run("publicUser_(all_('usuarios').find(u=>u.username==='cliente1'))");
 env.context.clientActor=actor;
 const list=env.run('clientList_(clientActor)');
 assert.equal(list.length,1);assert.equal(list[0].id,'P1');
 const view=env.run("clientProject_(clientActor,'P1')");
 assert.equal(view.tasks.length,1);assert.equal(view.tasks[0].name,'Colocación');
 assert.equal(view.tasks[0].notes,undefined);
 assert.equal(JSON.stringify(view).includes('Otro cliente'),false);
 assert.equal(JSON.stringify(view).includes('COSTO INTERNO'),false);
 assert.equal(JSON.stringify(view).includes('members'),false);
 assert.throws(()=>env.run("clientProject_(clientActor,'P2')"),/autorización/);
});

test('cliente autenticado no puede ejecutar bootstrap ni workspace.load',()=>{
 const env=sandboxBackend();
 env.run("append_('proyecto',{id:'P1',numero:'PR1',proyecto:'A'})");
 env.context.actor={username:'admin'};
 env.context.u={username:'cliente2',name:'Consulta',role:'CLIENTE',active:true,projectIds:'P1',password:'clave'};
 env.run('saveUser_(u,actor)');
 const access=env.run("login_('cliente2','clave')");
 function post(action,other={}){
  env.context.payload={postData:{contents:JSON.stringify({action,token:access.token,...other})}};
  return JSON.parse(env.run('doPost(payload)').getContent());
 }
 const first=post('client.list');
 assert.equal(first.ok,true);assert.equal(first.data.length,1);
 for(const name of ['bootstrap','workspace.load','logistics.route','workspace.save']){
  const out=post(name,{workspace:'projectGantt',projectId:'P1'});
  assert.equal(out.ok,false);
  assert.match(out.error,/solo puede acceder|permisos/i);
 }
 const denied=post('client.project',{projectId:'P2'});
 assert.equal(denied.ok,false);
 assert.match(denied.error,/autorización/);
});

test('incidencia interna no publica notas pero conserva jornada gris en Gantt del cliente',()=>{
 const env=sandboxBackend();
 env.run("append_('proyecto',{id:'P1',numero:'PR1',proyecto:'Colocación'})");
 env.context.gantt={tasks:[{id:'T1',projectId:'P1',name:'Vidrios',start:'2026-11-23',teamId:'T1',durationDays:2,
  incidents:[{date:'2026-11-23',reason:'personal',note:'Empleado enfermo',published:false},{date:'2026-11-24',reason:'clima',note:'Lluvia',published:true}]}],sectors:[],projectMeta:{}};
 env.context.capacity=sampleCapacity();
 env.run("saveWorkspace_('projectGantt',gantt,0,{username:'admin'})");
 env.run("saveWorkspace_('capacity',capacity,0,{username:'admin'})");
 env.context.clientActor={username:'cliente',role:'CLIENTE',projectIds:'P1'};
 const view=env.run("clientProject_(clientActor,'P1')");
 assert.equal(view.tasks[0].incidents.length,2);
 assert.equal(view.tasks[0].incidents[0].date,'2026-11-23');
 assert.equal(view.tasks[0].incidents[0].published,false);
 assert.equal(view.tasks[0].incidents[0].note,'');
 assert.equal(view.tasks[0].incidents[1].note,'Lluvia');
 assert.equal(JSON.stringify(view).includes('Empleado enfermo'),false);
});

test('setup migra encabezado de usuarios v1.2 sin eliminar cuentas',()=>{
 const env=sandboxBackend();
 const sh=env.sheets.get('usuarios');
 env.run("append_('usuarios',{username:'juan',name:'Juan',role:'PLANIFICADOR',active:true})");
 const before=sh.rows[1][5];
 sh.rows[0]=sh.rows[0].slice(0,8);
 env.run('setup()');
 assert.equal(sh.rows[0][8],'projectIds');
 assert.equal(sh.rows[1][5],before);
});
