import {test} from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';

test('speech settles on cancel, error, throw and timeout, and stale voice loads never speak',async(t)=>{
 t.mock.timers.enable({apis:['setTimeout']});
 const descriptors=new Map(['window','SpeechSynthesisUtterance'].map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const spoken: {text:string;onend?:()=>void;onerror?:()=>void}[]=[];
 let voices: unknown[]=[{lang:'de-DE',name:'German',voiceURI:'de',localService:true,default:true}];
 let throwOnSpeak=false,cancels=0;
 const synth={getVoices:()=>voices,addEventListener:()=>{},cancel:()=>{cancels++;},speak:(u:typeof spoken[number])=>{if(throwOnSpeak)throw Error('device');spoken.push(u);}};
 Object.defineProperty(globalThis,'window',{configurable:true,value:{speechSynthesis:synth}});
 Object.defineProperty(globalThis,'SpeechSynthesisUtterance',{configurable:true,value:class {text:string;constructor(text:string){this.text=text;}}});
 try {
  const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'src/shared/lib/speechService.ts',formats:['es']}}});
  const bundle=Array.isArray(result)?result[0]:result;assert.ok('output'in bundle);
  const chunk=bundle.output.find(x=>x.type==='chunk');assert.ok(chunk&&chunk.type==='chunk');
  const {SpeechService}=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
  const service=new SpeechService();
  let firstSettled=false;
  const first=service.speak('eins/zwei/drei').then(()=>{firstSettled=true;});await Promise.resolve();
  assert.equal(spoken.at(-1)!.text,'eins, zwei, drei');
  const second=service.speak('Hallo (Anna), Ben');await Promise.resolve();await first;
  assert.equal(firstSettled,true,'replacement settles the canceled utterance even without browser events');
  spoken.at(-1)!.onerror!();await second;
  const canceled=service.speak('cancel');await Promise.resolve();service.cancel();await canceled;
  throwOnSpeak=true;await service.speak('throw');throwOnSpeak=false;
  const stalled=service.speak('stalled');await Promise.resolve();t.mock.timers.tick(15001);await stalled;
  assert.ok(cancels>0);
  voices=[];const loading=new SpeechService();const before=spoken.length;
  const pending=loading.speak('obsolete');loading.cancel();t.mock.timers.tick(1501);await pending;
  assert.equal(spoken.length,before,'cancel invalidates a request waiting for voices');
 }finally{
  for(const [key,descriptor] of descriptors){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else Reflect.deleteProperty(globalThis,key);}
 }
});
