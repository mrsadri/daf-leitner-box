import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
import type {LeitnerCard} from '../src/core/types.ts';
const modulePromise=(async()=>{
 const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'src/core/cloudSync.ts',formats:['es']}}});
 const bundle=Array.isArray(result)?result[0]:result;assert.ok('output'in bundle);
 const chunk=bundle.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
 return import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
})();
const card=(id:string,box=0):LeitnerCard=>({id,type:'vocab',box,nextReviewDate:'2026-11-18',lastReviewedAt:null,createdAt:'2026-11-18T00:00:00Z',reviewCount:0,correctCount:0,wrongCount:0});
type Row={id:string;box:number;updated_at:string;[key:string]:unknown};
function fixture(){
 const storage=new Map<string,string>();const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const fetchBefore=globalThis.fetch;
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);},removeItem:(k:string)=>{storage.delete(k);}}});
 globalThis.fetch=async()=>new Response('Lektion,Nr,Wort\n');
 const server={revision:0,rows:new Map<string,Row>(),settings:{soundEnabled:true,autoSpeak:true},lostResponse:false,requests:[]as string[]};
 const receipts=new Map<string,unknown>();
 const db={async rpc(name:string,args:Record<string,unknown>={}){
  if(name==='get_sync_revision')return{data:server.revision,error:null};
  if(name!=='apply_sync_batch')return{data:false,error:null};
  const operation=String(args.p_operation);server.requests.push(operation);
  if(receipts.has(operation))return{data:receipts.get(operation),error:null};
  if(args.p_revision!==server.revision)return{data:{conflict:true,revision:server.revision},error:null};
  server.revision++;const stamps:Record<string,string>={};
  for(const row of args.p_upserts as Row[]){const stamp=`stamp-${server.revision}`;server.rows.set(row.id,{...row,updated_at:stamp});stamps[row.id]=stamp;}
  for(const id of args.p_deletes as string[])server.rows.delete(id);
  Object.assign(server.settings,args.p_settings??{});
  const result={conflict:false,revision:server.revision,stamps,personal:[]};receipts.set(operation,result);
  if(server.lostResponse){server.lostResponse=false;return{data:null,error:{code:'08006',message:'lost response after commit'}};}
  return{data:result,error:null};
 },from(table:string){const response=()=>({data:{display_name:'Test',show_on_leaderboard:true,onboarded:true,settings:server.settings},error:null});
  const q={select(){return q;},eq(){return q;},order(){return q;},async range(){return{data:[...server.rows.values()],error:null};},async maybeSingle(){return response();},async single(){return response();}};
  assert.ok(table==='cards'||table==='profiles');return q;
 }};
 return{server,storage,db,restore(){globalThis.fetch=fetchBefore;if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}};
}
const user={id:'test-user',email:'test@example.test',user_metadata:{}};
test('lost response replays the same receipt and keeps a newer edit',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});t.mock.method(console,'error',()=>{});
 const f=fixture();const {CloudSync}=await modulePromise;const sync=new CloudSync(()=>f.db);
 try{
  await sync.start(user);sync.queueUpserts([card('one',1)]);f.server.lostResponse=true;await sync.flush();
  const saved=JSON.parse(f.storage.get('daf_sync_queue_test-user')!);assert.ok(saved.inflight.operation);
  sync.queueUpserts([card('one',2)]);await sync.flush();
  assert.equal(f.server.rows.get('one')?.box,2);
  assert.equal(f.server.requests[0],f.server.requests[1],'receipt identity must survive a lost response');
  assert.notEqual(f.server.requests[1],f.server.requests[2],'newer mutation needs its own receipt');
  assert.equal(f.storage.get('daf_sync_queue_test-user'),undefined);
 }finally{sync.detach();f.restore();}
});
test('a stale card is quarantined rather than overwriting another device',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();const {CloudSync}=await modulePromise;const sync=new CloudSync(()=>f.db);
 f.server.rows.set('one',{id:'one',type:'vocab',box:0,next_review_date:'2026-11-18',last_reviewed_at:null,review_count:0,correct_count:0,wrong_count:0,data:{},created_at:'2026-11-18T00:00:00Z',updated_at:'base'});
 try{
  await sync.start(user);sync.queueUpserts([card('one',1)]);
  f.server.rows.set('one',{...f.server.rows.get('one')!,box:3,updated_at:'other-device'});f.server.revision++;
  await sync.flush();assert.equal(f.server.rows.get('one')?.box,3);
  const conflicts=JSON.parse(f.storage.get('daf_sync_conflicts_test-user')!);
  assert.equal(conflicts[0].card.box,1,'local proposal must remain recoverable');
  assert.equal(conflicts[0].server.box,3);
 }finally{sync.detach();f.restore();}
});
test('independent settings fields merge after a revision conflict',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=fixture();const {CloudSync}=await modulePromise;const sync=new CloudSync(()=>f.db);
 try{
  await sync.start(user);sync.queueSettings({soundEnabled:false,autoSpeak:true,speechRate:.9,hapticFeedback:true,nounsOnlyMode:false,newWordsFlipCard:false});
  f.server.settings.autoSpeak=false;f.server.revision++;
  await sync.flush();assert.equal(f.server.settings.autoSpeak,false);assert.equal(f.server.settings.soundEnabled,false);
  assert.equal(f.storage.get('daf_sync_conflicts_test-user'),undefined);
 }finally{sync.detach();f.restore();}
});


test('a delayed old save and sign-out cannot block or clear a new account',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const f=fixture();const {CloudSync}=await modulePromise;
 let release!:()=>void;let started!:()=>void;
 const began=new Promise<void>(resolve=>{started=resolve;});
 const original=f.db.rpc.bind(f.db);
 let delay=true;
 const db={...f.db,async rpc(name:string,args:Record<string,unknown>={}){
  if(name==='apply_sync_batch'&&delay){assert.equal(args.p_expected_user,user.id);delay=false;started();await new Promise<void>(resolve=>{release=resolve;});}
  return original(name,args);
 }};
 const sync=new CloudSync(()=>db);
 let second:Promise<unknown>|undefined;
 try{
  await sync.start(user);sync.queueUpserts([card('old-private')]);
  const first=sync.flush();await began;
  const stopping=sync.stop();
  let ready=false;
  second=sync.start({...user,id:'second-user'}).then(()=>{ready=true;});
  for(let i=0;i<30;i++){if(ready)break;await new Promise<void>(resolve=>setImmediate(resolve));}
  assert.equal(ready,true,'a new account must not wait for the old transport');
  sync.queueUpserts([card('new-private')]);await sync.flush();
  release();await first;await stopping;await second;
  sync.queueUpserts([card('after-old-signout')]);await sync.flush();
  assert.equal(f.server.rows.has('after-old-signout'),true,'old stop must not detach the new account');
  assert.ok(f.storage.get('daf_sync_queue_test-user')?.includes('old-private'));
  assert.equal(f.storage.get('daf_sync_queue_second-user'),undefined);
 }finally{release?.();await second;sync.detach();f.restore();}
});


test('storage failure is visible and prevents sending a non-durable batch until retry',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});t.mock.method(console,'error',()=>{});
 const f=fixture();const {CloudSync}=await modulePromise;const sync=new CloudSync(()=>f.db);
 const original=globalThis.localStorage.setItem;
 try{
  await sync.start(user);
  globalThis.localStorage.setItem=(key:string,value:string)=>{if(key.startsWith('daf_sync_queue_'))throw new Error('quota');original(key,value);};
  sync.queueUpserts([card('unsaved')]);
  assert.equal(sync.getSyncInfo().storageError,true);
  await sync.flush();await sync.flush();assert.equal(f.server.requests.length,0);
  assert.equal(sync.getSyncInfo().pending,1);
  globalThis.localStorage.setItem=original;
  await sync.flush();assert.equal(sync.getSyncInfo().storageError,false);
  assert.equal(f.server.rows.has('unsaved'),true);
 }finally{globalThis.localStorage.setItem=original;sync.detach();f.restore();}
});

test('an expired authentication response retains the exact batch for a refreshed retry',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});t.mock.method(console,'error',()=>{});
 const f=fixture();const {CloudSync}=await modulePromise;let expired=true;const operations:string[]=[];
 const rpc=f.db.rpc.bind(f.db);
 const db={...f.db,async rpc(name:string,args:Record<string,unknown>={}){
  if(name==='apply_sync_batch'){
   operations.push(String(args.p_operation));
   if(expired){expired=false;return {data:null,error:{code:'PGRST301',message:'JWT expired'},status:401};}
  }
  return rpc(name,args);
 }};
 const sync=new CloudSync(()=>db);
 try{
  await sync.start(user);sync.queueUpserts([card('after-refresh')]);await sync.flush();
  assert.equal(sync.getSyncInfo().pending,1);assert.ok(f.storage.get('daf_sync_queue_test-user'));
  await sync.flush();assert.equal(operations[0],operations[1]);
  assert.equal(f.server.rows.has('after-refresh'),true);assert.equal(sync.getSyncInfo().pending,0);
 }finally{sync.detach();f.restore();}
});
