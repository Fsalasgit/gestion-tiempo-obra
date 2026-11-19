/**
 * ObraTiempo · Apps Script API (v0.5)
 * Desplegar como Web App "Ejecutar como yo", acceso "Cualquier usuario".
 * Inicio de sesión propio: usuario + contraseña, token aleatorio en sesiones.
 * Cada acción valida token y rol desde Google Sheets, sin Google Login.
 * Propiedades: SPREADSHEET_ID, SUPERADMIN_USERNAME (opcional: admin),
 * SUPERADMIN_PASSWORD (solo para setup inicial) y CALENDAR_ID (opcional).
 */
const HEADERS_ = {
  proyecto:['id','numero','cliente','proyecto','estado','produccion','entrega','lider','inicio','inicioP','fechaEntrega','items','actualizado','localidad','grupo'],
  tiempo_obra:['projectId','value','unit','crewReference','outsourced','notes','updatedAt','updatedBy','address'],
  usuarios:['email','name','role','active','createdAt','username','passwordSalt','passwordHash'],
  sesiones:['tokenHash','username','expiresAt','createdAt'],
  calendario_laboral:['day','name','enabled','start','end','breakStart','breakEnd','target'],
  feriados:['date','label','kind','active','source'],
  recesos:['id','start','end','projectId','note'],
  eventos_calendar:['id','projectId','date','start','end','people','title','calendarId','actor','createdAt'],
  importaciones:['id','sourceSpreadsheetId','sheetName','importedAt','projects','items','actor'],
  configuracion:['key','value']
};
const DEFAULT_WEEK_ = [
  [1,'Lunes',true,'08:00','14:00','','',6],
  [2,'Martes',true,'08:00','14:00','','',6],
  [3,'Miércoles',true,'08:00','14:00','','',6],
  [4,'Jueves',true,'08:00','14:00','','',6],
  [5,'Viernes',true,'08:00','13:00','','',5],
  [6,'Sábado',false,'08:00','08:00','','',0],
  [0,'Domingo',false,'08:00','08:00','','',0]
];
const TZ_='America/Argentina/Tucuman';

function setup() {
  const prop=PropertiesService.getScriptProperties();
  if (!prop.getProperty('SPREADSHEET_ID')) throw Error('Definir SPREADSHEET_ID en las propiedades del script.');
  const ss=ss_();
  ss.setSpreadsheetTimeZone(TZ_);
  Object.keys(HEADERS_).forEach(name=>ensureSheet_(ss,name,HEADERS_[name]));
  ss.getSheetByName('calendario_laboral').getRange('D:G').setNumberFormat('@');
  const username=String(prop.getProperty('SUPERADMIN_USERNAME')||'admin').trim().toLowerCase();
  if(!validUsername_(username))throw Error('SUPERADMIN_USERNAME inválido: usá entre 3 y 32 letras, números, puntos, guiones o guiones bajos.');
  if(!all_('usuarios').some(u=>u.username===username)) {
    const password=String(prop.getProperty('SUPERADMIN_PASSWORD')||'');
    if(password.length<1 || password.length>200)throw Error('Definir SUPERADMIN_PASSWORD de 1 a 200 caracteres en propiedades, solo para setup().');
    const salt=Utilities.getUuid()+'-'+Utilities.getUuid();
    append_('usuarios',{email:'',username,name:'Superadministrador',role:'SUPERADMIN',active:true,createdAt:now_(),passwordSalt:salt,passwordHash:hashPassword_(password,salt)});
    prop.deleteProperty('SUPERADMIN_PASSWORD'); // No conservar la clave inicial en propiedades.
  }
  if (!all_('calendario_laboral').length) ss.getSheetByName('calendario_laboral').getRange(2,1,7,8).setValues(DEFAULT_WEEK_);
  if (!all_('configuracion').some(r=>r.key==='teamSize')) append_('configuracion',{key:'teamSize',value:'3'});
  Logger.log('Configurado: '+ss.getUrl());
}
function doGet() {return json_({ok:true, data:{app:'ObraTiempo API',status:'online',version:'0.5'}});}
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents || e.postData.contents.length>11000000) throw Error('Solicitud inválida o demasiado grande.');
    const a=JSON.parse(e.postData.contents);
    const action=String(a.action || '');
    if(action==='auth.login')return json_({ok:true,data:login_(a.username,a.password)});
    const actor=authenticate_(a.token);
    if(action==='auth.logout')return json_({ok:true,data:logout_(a.token)});
    let data;
    switch(action) {
      case 'bootstrap': data=bootstrap_(actor);break;
      case 'estimate.save': permit_(actor,['SUPERADMIN','ADMIN','PLANIFICADOR']);data=saveEstimate_(a,actor);break;
      case 'calendar.save': permit_(actor,['SUPERADMIN','ADMIN']);data=saveWeek_(a.week);break;
      case 'team.save': permit_(actor,['SUPERADMIN','ADMIN']);data=saveTeam_(a.teamSize);break;
      case 'holiday.sync': permit_(actor,['SUPERADMIN','ADMIN']);data=syncHolidays_(a.year);break;
      case 'holiday.save': permit_(actor,['SUPERADMIN','ADMIN']);data=saveHoliday_(a.holiday);break;
      case 'recess.save': permit_(actor,['SUPERADMIN','ADMIN','PLANIFICADOR']);data=saveRecess_(a.recess);break;
      case 'recess.delete': permit_(actor,['SUPERADMIN','ADMIN','PLANIFICADOR']);data=deleteBy_('recesos','id',a.id);break;
      case 'user.save': permit_(actor,['SUPERADMIN']);data=saveUser_(a.user,actor);break;
      case 'project.importSheet': permit_(actor,['SUPERADMIN','ADMIN']);data=importSheet_(a.spreadsheetId,a.sheetName,actor);break;
      case 'project.uploadExcel': permit_(actor,['SUPERADMIN','ADMIN']);data=uploadExcel_(a.filename,a.base64,actor);break;
      case 'project.refresh': permit_(actor,['SUPERADMIN','ADMIN']);data=refreshProjects_(actor);break;
      case 'event.create': permit_(actor,['SUPERADMIN','ADMIN','PLANIFICADOR']);data=createCalendarEvent_(a.event,actor);break;
      default: throw Error('Acción desconocida: '+action);
    }
    return json_({ok:true,data});
  } catch(err) {
    console.error(err && err.stack || err);
    return json_({ok:false,error:err.message || String(err),code:err.code||'ERROR'});
  }
}
function json_(payload) {return ContentService.createTextOutput(JSON.stringify(payload)).setMimeType(ContentService.MimeType.JSON);}
function ss_() {const id=PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID'); if(!id)throw Error('Falta SPREADSHEET_ID');return SpreadsheetApp.openById(id);}
function now_() {return Utilities.formatDate(new Date(),TZ_,"yyyy-MM-dd'T'HH:mm:ss");}
function ensureSheet_(ss,name,headers) {
  let sheet=ss.getSheetByName(name);if(!sheet)sheet=ss.insertSheet(name);
  const first=sheet.getRange(1,1,1,headers.length).getValues()[0];
  if (first.every(v=>v==='' || v===null)) {
    sheet.getRange(1,1,1,headers.length).setValues([headers]);
    sheet.getRange(1,1,1,headers.length).setFontWeight('bold').setBackground('#172841').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
  } else if (['proyecto','tiempo_obra'].includes(name) &&
    headers.slice(0,-1).every((h,i)=>String(first[i])===h) && !String(first[headers.length-1]||'').trim()) {
    // Migración aditiva de v0.2, sin borrar ni reordenar registros existentes.
    sheet.getRange(1,headers.length).setValue(headers[headers.length-1]);
  } else if (name==='usuarios' &&
    HEADERS_.usuarios.slice(0,5).every((h,i)=>String(first[i])===h) &&
    HEADERS_.usuarios.slice(5).every((h,i)=>!first[i+5])) {
    // Actualización transparente de v0.1: conservar usuarios anteriores,
    // aunque deberán recibir username y contraseña antes de iniciar sesión.
    sheet.getRange(1,6,1,3).setValues([HEADERS_.usuarios.slice(5)]);
  } else if (headers.some((h,i)=>String(first[i])!==h)) throw Error('Encabezados de '+name+' no coinciden. No se modificó la hoja.');
  return sheet;
}
function value_(x,key) {if(x instanceof Date)return Utilities.formatDate(x,TZ_,['start','end','breakStart','breakEnd'].includes(key)?'HH:mm':'yyyy-MM-dd');return x;}
function all_(name) {
  const sheet=ss_().getSheetByName(name);if(!sheet)throw Error('Ejecutar setup() antes de usar la app.');
  const last=sheet.getLastRow();if(last<2)return [];
  const headers=HEADERS_[name];
  return sheet.getRange(2,1,last-1,headers.length).getValues().map(row=>Object.fromEntries(headers.map((h,i)=>[h,value_(row[i],h)]))).filter(r=>Object.values(r).some(v=>v!=='' && v!==null));
}
function safeCell_(v) {return typeof v==='string' && /^[\s]*[=+@]/.test(v)?'\''+v:v;}
function append_(name,obj) {ss_().getSheetByName(name).appendRow(HEADERS_[name].map(k=>safeCell_(obj[k] ?? '')));}
function replaceAll_(name,objects) {
  const sh=ss_().getSheetByName(name);const headers=HEADERS_[name];
  const count=sh.getLastRow()-1;if(count>0)sh.getRange(2,1,count,headers.length).clearContent();
  if(objects.length) sh.getRange(2,1,objects.length,headers.length).setValues(objects.map(o=>headers.map(k=>safeCell_(o[k] ?? ''))));
}
function upsert_(name,key,obj) {
  const rows=all_(name);const pos=rows.findIndex(r=>String(r[key])===String(obj[key]));
  if(pos<0)append_(name,obj);
  else {const next={...rows[pos],...obj};ss_().getSheetByName(name).getRange(pos+2,1,1,HEADERS_[name].length).setValues([HEADERS_[name].map(k=>safeCell_(next[k] ?? ''))]);}
  return obj;
}
function deleteBy_(name,key,id) {
  const rows=all_(name);const index=rows.findIndex(r=>String(r[key])===String(id));
  if(index<0)throw Error('Registro inexistente');
  ss_().getSheetByName(name).deleteRow(index+2);return {deleted:true};
}
// El backend nunca confía en un rol enviado por el navegador.
const SESSION_DAYS_=30;
function authError_(message) {const e=Error(message);e.code='AUTH_REQUIRED';return e;}
function validUsername_(u) {return /^[a-z0-9._-]{3,32}$/.test(String(u||''));}
function digest_(s) {return Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s)).replace(/=+$/,'');}
function hashPassword_(password,salt) {
  // SHA-256 con sal y múltiples iteraciones. Nunca guardar claves en texto plano.
  let bytes=Utilities.newBlob(salt+':'+password).getBytes();
  for(let i=0;i<3000;i++)bytes=Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,bytes);
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/,'');
}
function publicUser_(u) {return {username:u.username,name:u.name,role:u.role,active:u.active,createdAt:u.createdAt};}
function active_(u) {return u.active===true || String(u.active).toLowerCase()==='true';}
function login_(username,password) {
  username=String(username||'').trim().toLowerCase();
  if(!validUsername_(username) || typeof password!=='string' || password.length>200)throw Error('Usuario o contraseña incorrectos.');
  const cache=CacheService.getScriptCache(),key='attempts:'+digest_(username),attempts=Number(cache.get(key)||0);
  if(attempts>=5)throw Error('Demasiados intentos. Volvé a intentar en 15 minutos.');
  const u=all_('usuarios').find(r=>r.username===username);
  if(!u || !active_(u) || !u.passwordSalt || !u.passwordHash || hashPassword_(password,String(u.passwordSalt))!==String(u.passwordHash)) {
    cache.put(key,String(attempts+1),900);
    throw Error('Usuario o contraseña incorrectos.');
  }
  cache.remove(key);
  const token=Utilities.getUuid().replace(/-/g,'')+Utilities.getUuid().replace(/-/g,'');
  append_('sesiones',{tokenHash:digest_(token),username,expiresAt:new Date(Date.now()+SESSION_DAYS_*86400000).toISOString(),createdAt:new Date().toISOString()});
  return {token,actor:publicUser_(u),expiresInDays:SESSION_DAYS_};
}
function authenticate_(token) {
  if(typeof token!=='string'|| !/^[a-f0-9]{64}$/.test(token))throw authError_('Sesión inválida. Iniciá sesión nuevamente.');
  const record=all_('sesiones').find(s=>s.tokenHash===digest_(token));
  const expiry=record?Date.parse(String(record.expiresAt)):NaN;
  if(!record || !Number.isFinite(expiry) || expiry<=Date.now())throw authError_('Sesión vencida o cerrada. Volvé a iniciar sesión.');
  const u=all_('usuarios').find(r=>r.username===record.username && active_(r));
  if(!u)throw authError_('Usuario deshabilitado. Volvé a iniciar sesión.');
  return publicUser_(u);
}
function logout_(token) {
  const hash=digest_(token);
  const session=all_('sesiones').find(s=>s.tokenHash===hash);
  if(session)deleteBy_('sesiones','tokenHash',hash);
  return {closed:true};
}
function permit_(actor,roles) {if(!roles.includes(actor.role))throw Error('No tenés permisos para esta acción.');}
function bootstrap_(actor) {
  const users=all_('usuarios');
  return {
    actor,projects:all_('proyecto'),estimates:all_('tiempo_obra'),week:all_('calendario_laboral'),
    holidays:all_('feriados'),recesses:all_('recesos'),events:all_('eventos_calendar'),
    users:['SUPERADMIN','ADMIN'].includes(actor.role)?users.map(publicUser_):[],
    teamSize:Number((all_('configuracion').find(x=>x.key==='teamSize') || {}).value)||3,
    sourceSheetId:(all_('configuracion').find(x=>x.key==='sourceSheetId')||{}).value||''
  };
}
function saveEstimate_(a,actor) {
  const e=a.estimate || {};const projectId=String(e.projectId || '');
  if(!all_('proyecto').some(p=>String(p.id)===projectId))throw Error('Proyecto no encontrado.');
  const value=Number(e.value);if(!Number.isFinite(value) || value<=0 || value>100000)throw Error('Ingresá una cantidad de tiempo mayor a cero.');
  const unit=String(e.unit);if(!['horas','dias'].includes(unit))throw Error('Unidad inválida.');
  return upsert_('tiempo_obra','projectId',{projectId,value,unit,crewReference:2,outsourced:!!e.outsourced,notes:String(e.notes||'').slice(0,3000),updatedAt:now_(),updatedBy:actor.username,address:String(e.address||'').slice(0,400)});
}
function timeMinute_(time) {if(!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(time)))throw Error('Horario HH:mm inválido');return Number(time.slice(0,2))*60+Number(time.slice(3));}
function saveWeek_(days) {
  if(!Array.isArray(days) || days.length!==7 || new Set(days.map(x=>Number(x.day))).size!==7)throw Error('Cargar exactamente siete días de la semana.');
  const cleaned=days.map(w=>{
    const day=Number(w.day);if(day<0||day>6)throw Error('Día inválido');
    const start=String(w.start);const end=String(w.end);const total=timeMinute_(end)-timeMinute_(start);
    let pause=0;
    if(!!w.breakStart!==!!w.breakEnd)throw Error('Completá inicio y fin del receso');
    if(w.breakStart) {
      const a=timeMinute_(w.breakStart),b=timeMinute_(w.breakEnd);
      if(a<timeMinute_(start)||b>timeMinute_(end)||b<=a)throw Error('Receso fuera de la jornada');pause=b-a;
    }
    const target=Number(w.target);
    if(!Number.isFinite(target)||target<0||target>24|| (!!w.enabled && (total-pause<target*60 || total<0)))throw Error('Las horas puras superan el horario disponible.');
    return {day,name:String(w.name).slice(0,30),enabled:!!w.enabled,start,end,breakStart:w.breakStart||'',breakEnd:w.breakEnd||'',target};
  });
  replaceAll_('calendario_laboral',cleaned);return cleaned;
}
function saveTeam_(value) {const v=Number(value);if(!Number.isInteger(v)||v<1||v>1000)throw Error('El equipo debe tener entre 1 y 1000 personas.');return upsert_('configuracion','key',{key:'teamSize',value:String(v)});}
function isISO_(date) {return /^\d{4}-\d{2}-\d{2}$/.test(String(date||'')) && !Number.isNaN(Date.parse(date+'T12:00:00Z'));}
function syncHolidays_(year) {
  const y=Number(year);if(!Number.isInteger(y)||y<2016||y>2026)throw Error('La fuente pública consultada solo cubre 2016–2026. Podés cargar otros años manualmente.');
  const response=UrlFetchApp.fetch('https://api.argentinadatos.com/v1/feriados/'+y,{muteHttpExceptions:true});
  if(response.getResponseCode()!==200)throw Error('No fue posible consultar ArgentinaDatos; cargalos manualmente o reintentá.');
  const list=JSON.parse(response.getContentText());if(!Array.isArray(list))throw Error('Respuesta de feriados inválida.');
  const existing=all_('feriados');const byDate=new Map(existing.map(h=>[h.date,h]));let count=0;
  list.forEach(x=>{
    const date=toISO_(x.fecha);if(!isISO_(date))return;
    const old=byDate.get(date);if(old && old.source==='manual')return;
    byDate.set(date,{date,label:String(x.nombre||'Feriado').slice(0,120),kind:String(x.tipo||''),active:old?old.active:true,source:'ArgentinaDatos (no oficial)'});
    count++;
  });
  replaceAll_('feriados',[...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)));
  return {year:y,count,source:'https://api.argentinadatos.com/v1/feriados/'+y};
}
function toISO_(v) {
  if(v instanceof Date)return Utilities.formatDate(v,TZ_,'yyyy-MM-dd');
  if(typeof v==='number' && v>20000 && v<90000)return Utilities.formatDate(new Date(Math.round((v-25569)*86400000)),'UTC','yyyy-MM-dd');
  const s=String(v||'').trim();if(/^\d{4}-\d\d-\d\d/.test(s))return s.slice(0,10);
  const m=s.match(/^(\d\d?)[/-](\d\d?)[/-](\d{4})/);return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):'';
}
function saveHoliday_(h) {
  if(!h || !isISO_(h.date))throw Error('Fecha de feriado inválida');
  return upsert_('feriados','date',{date:h.date,label:String(h.label||'Día no laborable').slice(0,120),kind:String(h.kind||'manual'),active:!!h.active,source:'manual'});
}
function saveRecess_(r) {
  if(!r || !isISO_(r.start) || !isISO_(r.end) || r.end<r.start)throw Error('Fechas de receso inválidas.');
  if(r.projectId && !all_('proyecto').some(p=>String(p.id)===String(r.projectId)))throw Error('Proyecto de receso inexistente.');
  return upsert_('recesos','id',{id:r.id||Utilities.getUuid(),start:r.start,end:r.end,projectId:String(r.projectId||''),note:String(r.note||'').slice(0,200)});
}
function saveUser_(u,actor) {
  if(!u)throw Error('Faltan datos de usuario');
  const username=String(u.username||'').trim().toLowerCase();
  if(!validUsername_(username))throw Error('Usuario inválido. Usá entre 3 y 32 letras, números, puntos, guiones o guiones bajos.');
  if(!['SUPERADMIN','ADMIN','PLANIFICADOR','LECTOR'].includes(u.role))throw Error('Rol inválido.');
  const users=all_('usuarios');
  const old=users.find(x=>x.username===username);
  if(old && old.role==='SUPERADMIN' && (u.role!=='SUPERADMIN'||!u.active) && users.filter(x=>x.role==='SUPERADMIN'&&active_(x)).length===1)throw Error('No se puede desactivar el último superadministrador.');
  const mainAdmin=String(PropertiesService.getScriptProperties().getProperty('SUPERADMIN_USERNAME')||'admin').trim().toLowerCase();
  if(u.role==='SUPERADMIN' && actor.username!==mainAdmin)throw Error('Solo el titular puede conceder SUPERADMIN.');
  const pass=String(u.password||'');
  if((!old || pass) && (pass.length<1 || pass.length>200))throw Error('La contraseña debe tener entre 1 y 200 caracteres.');
  const passwordSalt=pass?Utilities.getUuid()+'-'+Utilities.getUuid():(old?.passwordSalt||'');
  const passwordHash=pass?hashPassword_(pass,passwordSalt):(old?.passwordHash||'');
  upsert_('usuarios','username',{email:old?.email||'',username,name:String(u.name||username).slice(0,120),role:u.role,active:!!u.active,createdAt:old?.createdAt||now_(),passwordSalt,passwordHash});
  // Cambiar clave o desactivar usuario invalida sus sesiones anteriores.
  if(old && (pass || !u.active))replaceAll_('sesiones',all_('sesiones').filter(s=>s.username!==username));
  return publicUser_({username,name:String(u.name||username).slice(0,120),role:u.role,active:!!u.active,createdAt:old?.createdAt||now_()});
}
function getConfig_(key) {const found=all_('configuracion').find(x=>x.key===key);return found?found.value:'';}
function importSheet_(id,name,actor) {
  const sourceId=String(id||'').match(/\/spreadsheets\/d\/([\w-]+)/)?.[1] || String(id||'').trim();
  if(!/^[\w-]{20,}$/.test(sourceId))throw Error('Ingresá el ID o la URL de una hoja de Google válida.');
  if(sourceId===String(PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID')))throw Error('No se puede importar la propia base como origen.');
  const source=SpreadsheetApp.openById(sourceId),sheet=name?source.getSheetByName(name):source.getSheets()[0];
  if(!sheet)throw Error('No se encontró la pestaña de origen.');
  const values=sheet.getDataRange().getValues();if(values.length<2)throw Error('La hoja de origen no tiene datos.');
  const headers=values[0].map(x=>norm_(x));const idx={};headers.forEach((h,i)=>{idx[h]=i;});
  if(idx.numero===undefined || (idx.proyecto===undefined && idx.nombre===undefined))throw Error('El origen necesita columnas Numero y Nombre (o Proyecto).');
  const get=(r,key)=>idx[key]===undefined?'':r[idx[key]];
  const projects=new Map();let items=0;
  for(let i=1;i<values.length;i++) {
    const row=values[i];const numero=String(get(row,'numero')||'').trim();
    const nombre=String(get(row,idx.nombre!==undefined?'nombre':'proyecto')||'').trim();
    if(!numero || !nombre)continue; // Se excluyen filas de totales y subtotales.
    const estado=String(get(row,idx.prestado!==undefined?'prestado':'estado')||'').trim();
    // Encabezado real "PR - Estado" -> "prestado" al normalizar.
    if(/^(terminado|terminada|finalizado|finalizada|completado|completada|cerrado|cerrada|anulado|anulada|cancelado|cancelada)$/i.test(estado))continue;
    const rawId=get(row,'projectid');const id=String(rawId||numero).trim();
    if(!projects.has(id)) projects.set(id,{
      id,numero,cliente:String(get(row,'cliente')||'').trim(),proyecto:nombre,
      estado,produccion:String(get(row,idx.producido!==undefined?'producido':'produccion')||'').trim(),entrega:String(get(row,'entrega')||'').trim(),
      lider:String(get(row,idx.liderproyecto!==undefined?'liderproyecto':'liderdeproyecto')||'').trim(),inicio:toISO_(get(row,'inicio')),inicioP:toISO_(get(row,'iniciop')),
      localidad:String(get(row,'localidadproyecto')||'').trim(),grupo:String(get(row,idx.grupo!==undefined?'grupo':'grupoproyecto')||'').trim(),
      fechaEntrega:toISO_(get(row,idx.finp!==undefined?'finp':'fecentrega')),items:0,actualizado:now_()
    });
    const p=projects.get(id);p.items++;items++;
    // El estado de artículos no se transforma arbitrariamente en "obra terminada".
    if(p.produccion!==String(get(row,idx.producido!==undefined?'producido':'produccion')||''))p.produccion='Mixta';
    if(p.entrega!==String(get(row,'entrega')||''))p.entrega='Mixta';
  }
  const records=[...projects.values()];if(!records.length)throw Error('No se hallaron proyectos para importar; la base no fue modificada.');records.sort((a,b)=>(a.inicio||a.inicioP||'9999').localeCompare(b.inicio||b.inicioP||'9999'));
  const lock=LockService.getScriptLock();if(!lock.tryLock(30000))throw Error('Importación en curso.');
  try {
    replaceAll_('proyecto',records);
    upsert_('configuracion','key',{key:'sourceSheetId',value:sourceId});
    upsert_('configuracion','key',{key:'sourceTabName',value:sheet.getName()});
    append_('importaciones',{id:Utilities.getUuid(),sourceSpreadsheetId:sourceId,sheetName:sheet.getName(),importedAt:now_(),projects:records.length,items,actor:actor.username});
  } finally {lock.releaseLock();}
  return {projects:records.length,items,sourceSheetId:sourceId,sourceSheetName:sheet.getName()};
}
function norm_(value) {return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');}
function uploadExcel_(filename,base64,actor) {
  if(!/\.(xls|xlsx)$/i.test(String(filename||'')))throw Error('Solo archivos Excel .xls o .xlsx');
  if(!base64 || base64.length>10000000)throw Error('Archivo vacío o superior a 8 MB');
  const blob=Utilities.newBlob(Utilities.base64Decode(base64),/\.xlsx$/i.test(filename)?'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':'application/vnd.ms-excel',filename);
  // Requiere habilitar Servicios avanzados > Drive API v3 en Apps Script.
  if(typeof Drive==='undefined')throw Error('Activá el servicio avanzado Drive API v3 en Apps Script.');
  const copy=Drive.Files.create({name:'ObraTiempo_fuente_'+now_()+'_'+filename,mimeType:'application/vnd.google-apps.spreadsheet'},blob,{fields:'id,name'});
  try {return importSheet_(copy.id,'',actor);}
  catch(err){Drive.Files.remove(copy.id);throw err;}
}
function refreshProjects_(actor) {
  const id=getConfig_('sourceSheetId');if(!id)throw Error('Primero importá un Excel o vinculá una hoja.');
  return importSheet_(id,getConfig_('sourceTabName'),actor);
}
function createCalendarEvent_(e,actor) {
  if(!e || !e.projectId || !isISO_(e.date))throw Error('Seleccioná obra y fecha.');
  const project=all_('proyecto').find(p=>String(p.id)===String(e.projectId));if(!project)throw Error('Proyecto inexistente.');
  const start=timeMinute_(String(e.start||'')),end=timeMinute_(String(e.end||''));if(start>=end)throw Error('Hora final debe ser posterior al inicio.');
  if(all_('feriados').some(h=>h.date===e.date && (h.active===true||String(h.active)==='true')))throw Error('La fecha es feriado o día bloqueado.');
  if(all_('recesos').some(r=>r.start<=e.date && e.date<=r.end && (!r.projectId || String(r.projectId)===String(e.projectId))))throw Error('La obra tiene un receso programado en esa fecha.');
  const dow=new Date(e.date+'T12:00:00Z').getUTCDay();const rule=all_('calendario_laboral').find(w=>Number(w.day)===dow);
  if(!rule || !(rule.enabled===true||String(rule.enabled)==='true'))throw Error('Ese día no es laboral.');
  const ws=timeMinute_(String(rule.start)),we=timeMinute_(String(rule.end));if(start<ws || end>we)throw Error('El evento está fuera del horario laboral.');
  if(rule.breakStart && rule.breakEnd && start<timeMinute_(String(rule.breakEnd)) && end>timeMinute_(String(rule.breakStart)))throw Error('El evento se superpone con el receso diario.');
  const id=PropertiesService.getScriptProperties().getProperty('CALENDAR_ID');
  const cal=id ? CalendarApp.getCalendarById(id) : CalendarApp.getDefaultCalendar();if(!cal)throw Error('Calendario no disponible. Revisá CALENDAR_ID.');
  const beginning=new Date(e.date+'T'+e.start+':00-03:00');const finish=new Date(e.date+'T'+e.end+':00-03:00');
  const title='Obra '+project.numero+' · '+project.proyecto;
  const event=cal.createEvent(title,beginning,finish,{description:'Proyecto '+project.numero+'\nEquipo asignado: '+(Number(e.people)||1)+'\nCreado por: '+actor.username});
  const row={id:event.getId(),projectId:String(e.projectId),date:e.date,start:e.start,end:e.end,people:Number(e.people)||1,title,calendarId:cal.getId(),actor:actor.username,createdAt:now_()};
  append_('eventos_calendar',row);return row;
}
