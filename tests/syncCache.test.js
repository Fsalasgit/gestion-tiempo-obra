import test from 'node:test';
import assert from 'node:assert/strict';
import {readSyncCache,writeSyncCache,clearSyncCache,readSessionActor,writeSessionActor,clearSessionActor} from '../src/lib/syncCache.js';
function storage(){const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}}
test('Un token conserva el perfil para navegar inmediatamente; no inventa datos remotos',()=>{
 const mem=storage(),actor={username:'admin',name:'Admin',role:'SUPERADMIN'};
 writeSessionActor(actor,mem,1000);assert.deepEqual(readSessionActor(mem,1001),actor);
 assert.equal(readSyncCache(mem,1001),null);
 writeSyncCache(actor,{projects:[],estimates:[],users:[]},mem,1001);
 assert.equal(readSyncCache(mem,1002).actor.username,'admin');
 clearSessionActor(mem);clearSyncCache(mem);
 assert.equal(readSessionActor(mem,1003),null);assert.equal(readSyncCache(mem,1003),null);
});
test('El caché desactualizado no se muestra como dato vigente',()=>{
 const mem=storage(),actor={username:'admin',name:'Admin',role:'SUPERADMIN'};
 writeSyncCache(actor,{projects:[],estimates:[]},mem,1000);
 assert.equal(readSyncCache(mem,1000+31*24*60*60*1000),null);
});
