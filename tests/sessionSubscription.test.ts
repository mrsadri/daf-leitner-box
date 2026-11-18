import {test} from 'node:test';
import assert from 'node:assert/strict';
import {subscribeSession} from '../src/core/sessionSubscription.ts';
const settle=()=>new Promise<void>(resolve=>setImmediate(resolve));
test('new Auth events win over a delayed initial session read',async()=>{
 let resolve!: (value:string|null)=>void, event!: (value:string|null)=>void;
 const sessions:(string|null)[]=[];
 const off=subscribeSession<string>({load:()=>new Promise(r=>{resolve=r;}),listen:callback=>{event=callback;return ()=>{};},onSession:s=>sessions.push(s),onError:()=>assert.fail('unexpected failure')});
 await settle();event('new-user');resolve(null);await settle();
 assert.deepEqual(sessions,['new-user']);off();
});
test('session load failure is recoverable and disposed callbacks are ignored',async()=>{
 let reject!: (error:Error)=>void,event!: (value:string|null)=>void;let errors=0,updates=0,detached=0;
 const off=subscribeSession<string>({load:()=>new Promise((_resolve,r)=>{reject=r;}),listen:cb=>{event=cb;return ()=>{detached++;};},onSession:()=>{updates++;},onError:()=>{errors++;}});
 await settle();reject(new Error('offline'));await settle();assert.equal(errors,1);
 off();event('stale');assert.equal(updates,0);assert.equal(detached,1);
 const retry=subscribeSession<string>({load:async()=> 'recovered',listen:()=>()=>{},onSession:()=>{updates++;},onError:()=>assert.fail('retry failed')});
 await settle();assert.equal(updates,1);retry();
});
test('late errors cannot replace a newer sign-out or update a disposed mount',async()=>{
 for(const dispose of [false,true]){
  let reject!: (error:Error)=>void,event!: (value:string|null)=>void;let errors=0;
  const off=subscribeSession<string>({load:()=>new Promise((_resolve,r)=>{reject=r;}),listen:cb=>{event=cb;return ()=>{};},onSession:()=>{},onError:()=>{errors++;}});
  await settle();if(dispose)off();else event(null);reject(new Error('stale'));await settle();assert.equal(errors,0);off();
 }
});
