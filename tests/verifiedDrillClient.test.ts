import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';
test('verified drill sends issued answers and adopts the server score rather than its local claim',async()=>{
 const storageDescriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');const storage=new Map<string,string>();
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>{storage.set(k,v);},removeItem:(k:string)=>{storage.delete(k);}}});
 try{
  const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'src/features/adjective/drillSync.ts',formats:['es']}}});
  const bundle=Array.isArray(result)?result[0]:result;assert.ok('output'in bundle);const chunk=bundle.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
  const api=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  const id='70000000-0000-0000-0000-000000000001';
  const params={noun:{id:'tisch',gender:'m',singular:'Tisch',plural:'Tische'},adjective:'alt',articleType:'definite',case:'nom',gender:'m',number:'sg'};
  const calls:{name:string;args:Record<string,unknown>}[]=[];let lost=true;
  const db={rpc(name:string,args:Record<string,unknown>={}){
    calls.push({name,args});let data:unknown=null,error:unknown=null,status=200;
    if(name==='start_verified_adjective_run')data={id,durationMs:300000,questions:Array.from({length:150},(_,ordinal)=>({ordinal,params}))};
    if(name==='answer_verified_adjective'){
      if(lost){lost=false;error={message:'response lost'};status=0;}else data={accepted:true,correct:true};
    }
    if(name==='finish_verified_adjective_run')data=[{score:1,answered:1}];
    const response={data,error,status};return Object.assign(Promise.resolve(response),{abortSignal:()=>Promise.resolve(response)});
  }};
  assert.equal(await api.startRun('owner',db),id);
  assert.equal(api.issuedRound(id,0).phrase.article.full,'der');
  assert.equal(await api.submitRunAnswer(id,0,{article:'er',adjective:'e',noun:''}),true);
  const answers=calls.filter(c=>c.name==='answer_verified_adjective');assert.equal(answers.length,2);assert.deepEqual(answers[0].args,answers[1].args);
  api.queueFinish('owner',{id,score:150,answered:150});
  assert.equal(JSON.parse(storage.get('daf_adjective_queue_owner')!)[0].protocol,'verified');
  const receipts=await api.flushQueue('owner',db);assert.deepEqual(receipts,[{id,score:1,answered:1}]);
  assert.deepEqual(calls.find(c=>c.name==='finish_verified_adjective_run')?.args,{p_id:id});
  assert.equal(api.drillSyncInfo('owner').lastResult.score,1);
  assert.equal(storage.get('daf_adjective_queue_owner'),undefined);
 }finally{if(storageDescriptor)Object.defineProperty(globalThis,'localStorage',storageDescriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
});
