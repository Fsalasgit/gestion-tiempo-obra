import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';

const code=readFileSync(new URL('../backend/apps-script/Code.gs', import.meta.url),'utf8');
function makeBackend(){
  const db={usuarios:[],sesiones:[]}, cache=new Map();
  const toBytes=x=>Buffer.isBuffer(x)?x:typeof x==='string'?Buffer.from(x):Buffer.from(x.map(y=>y&255));
  const context=vm.createContext({
    console, Date, Map, JSON,
    Utilities:{
      DigestAlgorithm:{SHA_256:'sha256'},
      computeDigest:(_algorithm,input)=>[...createHash('sha256').update(toBytes(input)).digest()],
      base64EncodeWebSafe:input=>toBytes(input).toString('base64url'),
      newBlob:input=>({getBytes:()=>[...Buffer.from(input)]}),
      getUuid:randomUUID
    },
    CacheService:{getScriptCache:()=>({get:key=>cache.get(key),put:(key,val)=>cache.set(key,val),remove:key=>cache.delete(key)})},
    PropertiesService:{getScriptProperties:()=>({getProperty:name=>name==='SUPERADMIN_USERNAME'?'admin':null})}
  });
  vm.runInContext(code+`\nfunction all_(name){return __db[name]||[];}\nfunction append_(name,obj){__db[name].push({...obj});}\nfunction replaceAll_(name,rows){__db[name]=rows;}\nfunction deleteBy_(name,key,id){__db[name]=__db[name].filter(r=>r[key]!==id);return {deleted:true};}`,context);
  context.__db=db;
  const call=(expression)=>vm.runInContext(expression,context);
  return {db,call,context};
}

test('usuario/contraseña crean una sesión token; bootstrap nunca expone hashes',()=>{
  const {db,call}=makeBackend();
  const salt='salt-a';
  const pass='contraseña-segura-123';
  const hash=call(`hashPassword_(${JSON.stringify(pass)},${JSON.stringify(salt)})`);
  db.usuarios.push({username:'admin',name:'Administrador',role:'SUPERADMIN',active:true,passwordSalt:salt,passwordHash:hash,createdAt:'2026-11-19'});
  const result=call(`login_('admin',${JSON.stringify(pass)})`);
  assert.match(result.token,/^[a-f0-9]{64}$/);
  assert.equal(db.sesiones[0].username,'admin');
  assert.notEqual(db.sesiones[0].tokenHash,result.token);
  assert.equal(call(`authenticate_('${result.token}').role`),'SUPERADMIN');
  const safe=call(`bootstrap_(authenticate_('${result.token}'))`);
  assert.equal(safe.users[0].username,'admin');
  assert.equal(Object.hasOwn(safe.users[0],'passwordHash'),false);
  call(`logout_('${result.token}')`);
  assert.throws(()=>call(`authenticate_('${result.token}')`),/Sesión vencida o cerrada/);
});

test('contraseña errónea y usuario desactivado no pueden operar',()=>{
  const {db,call}=makeBackend();
  db.usuarios.push({username:'admin',name:'Administrador',role:'SUPERADMIN',active:true,passwordSalt:'x',passwordHash:call("hashPassword_('clave-correcta-123','x')")});
  assert.throws(()=>call("login_('admin','clave-incorrecta')"),/Usuario o contraseña incorrectos/);
  const token=call("login_('admin','clave-correcta-123')").token;
  db.usuarios[0].active=false;
  assert.throws(()=>call(`authenticate_('${token}')`),/Usuario deshabilitado/);
});
