import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
const apiPromise=(async()=>{
 const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'src/features/adjective/drillSync.ts',formats:['es']}}});
 const bundle=Array.isArray(result)?result[0]:result;assert.ok('output'in bundle);
 const chunk=bundle.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
})();
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
function fixture(){
 const before=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const data=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(key:string)=>data.get(key)??null,setItem:(key:string,value:string)=>{data.set(key,value);},removeItem:(key:string)=>{data.delete(key);}}});
 return {data,restore(){if(before)Object.defineProperty(globalThis,'localStorage',before);else Reflect.deleteProperty(globalThis,'localStorage');}};
}
const result=(id:string)=>({id,score:1,answered:2});
test('a finish queued during an offline response survives the current flush',async()=>{
 const f=fixture();const api=await apiPromise;const uid='during-flush';let release!: (value:unknown)=>void;
 const db={rpc:()=>new Promise(r=>{release=r;})};
 try{
  api.queueFinish(uid,result('first'));const flushing=api.flushQueue(uid,db);
  assert.equal(api.flushQueue(uid,db),flushing);await settle();
  api.queueFinish(uid,result('second'));release({error:{message:'offline'},status:0});await flushing;
  assert.deepEqual(JSON.parse(f.data.get(`daf_adjective_queue_${uid}`)!).map((r:{id:string})=>r.id),['first','second']);
  assert.equal(api.drillSyncInfo(uid).error,true);
 }finally{api.clearQueue(uid);f.restore();}
});
test('a cleared session cannot resurrect finishes or interfere with a later flush',async()=>{
 const f=fixture();const api=await apiPromise;const uid='switched';const key=`daf_adjective_queue_${uid}`;
 const replies:((value:unknown)=>void)[]=[];
 const db={rpc:()=>new Promise(r=>replies.push(r))};
 try{
  f.data.set(key,JSON.stringify([{...result('old'),protocol:'verified',queuedAt:Date.now()}]));
  const old=api.flushQueue(uid,db);await settle();api.clearQueue(uid);
  f.data.set(key,JSON.stringify([{...result('new'),protocol:'verified',queuedAt:Date.now()}]));
  const current=api.flushQueue(uid,db);await settle();assert.equal(replies.length,2);
  replies[0]({data:[{score:150,answered:150}],error:null,status:200});await old;
  assert.equal(api.flushQueue(uid,db),current,'old completion must not release the new session lock');
  assert.equal(api.drillSyncInfo(uid).lastResult,null,'old score must not appear in the new session');
  replies[1]({data:[{score:1,answered:2}],error:null,status:200});await current;
  assert.equal(api.drillSyncInfo(uid).lastResult.id,'new');assert.equal(f.data.has(key),false);
 }finally{api.clearQueue(uid);f.restore();}
});
test('drill storage failure is reported; mixed server outcomes retain only retryable entries',async()=>{
 const f=fixture();const api=await apiPromise;const uid='failure-matrix';
 try{
  const original=globalThis.localStorage.setItem;
  globalThis.localStorage.setItem=()=>{throw new Error('full');};
  assert.throws(()=>api.queueFinish(uid,result('not-durable')),/could not be saved/);
  assert.equal(api.drillSyncInfo(uid).error,true);
  globalThis.localStorage.setItem=original;
  for(const id of ['accepted','rejected','retry'])api.queueFinish(uid,result(id));
  const db={rpc:(_name:string,args:{p_id:string})=>Promise.resolve(args.p_id==='accepted'?{error:null,status:200}:args.p_id==='rejected'?{error:{message:'rejected'},status:403}:{error:{message:'offline'},status:0})};
  await api.flushQueue(uid,db);
  assert.deepEqual(JSON.parse(f.data.get(`daf_adjective_queue_${uid}`)!).map((r:{id:string})=>r.id),['retry']);
  assert.equal(api.drillSyncInfo(uid).error,true);
 }finally{api.clearQueue(uid);f.restore();}
});
