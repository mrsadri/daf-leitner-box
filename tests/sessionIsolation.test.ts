import { test } from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'vite';

test('a delayed previous-account startup cannot hydrate or enqueue into the next account', async (t) => {
  t.mock.timers.enable({apis:['setTimeout']});
  const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  const previousFetch=globalThis.fetch;
  const storage=new Map<string,string>();
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{
    getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);},removeItem:(k:string)=>{storage.delete(k);},
  }});
  globalThis.fetch=async()=>new Response('Lektion,Nr,Wort\n');
  let releaseA!: ()=>void, beganA!: ()=>void;
  const waitingA=new Promise<void>(resolve=>{beganA=resolve;});
  try {
    const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,
      lib:{entry:'src/core/cloudSync.ts',formats:['es']}}});
    const bundle=Array.isArray(result)?result[0]:result;
    assert.ok('output' in bundle);
    const chunk=bundle.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
    const {CloudSync}=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
    const fakeDb={
      async rpc(){return {data:false,error:null};},
      from(table:string){
        let uid='';
        const query={select(){return query;},eq(_key:string,value:string){uid=value;return query;},order(){return query;},
          async range(){return {data:[],error:null};},
          async maybeSingle(){
            const response={data:{display_name:uid,show_on_leaderboard:true,onboarded:true,settings:{}},error:null};
            if(table==='profiles'&&uid==='A'){beganA();await new Promise<void>(resolve=>{releaseA=resolve;});}
            return response;
          },
        };return query;
      },
    };
    const sync=new CloudSync(()=>fakeDb);
    const user=(id:string)=>({id,user_metadata:{},email:`${id}@example.test`});
    const old=sync.start(user('A'));
    const rejected=assert.rejects(old,/Session changed/);
    await waitingA;
    sync.queueEvent({cardId:'A-private',cardType:'vocab',correct:true,fromBox:0,toBox:1,reviewDay:'2026-11-18'});
    const next=await sync.start(user('B'));
    releaseA();await rejected;
    assert.equal(next.profile.id,'B');
    assert.ok(storage.get('daf_sync_queue_A')?.includes('A-private'),'A keeps its own recoverable pending work');
    assert.equal(storage.get('daf_sync_queue_B'),undefined,'B must not inherit A queue');
    assert.ok(storage.has('daf_cards_cache_B'));
    sync.detach();
  } finally {
    globalThis.fetch=previousFetch;
    if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);
    else Reflect.deleteProperty(globalThis,'localStorage');
  }
});
