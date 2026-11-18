/** Full worker handler with real SDK/encryption, synthetic database HTTP and no network permission. */
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'npm:web-push@3.6.7';

let handler: (request:Request)=>Promise<Response>;
const originalServe=Deno.serve;
Object.defineProperty(Deno,'serve',{configurable:true,writable:true,value:(callback:typeof handler)=>{handler=callback;return {};}});
try { await import('./index.ts'); } finally {Object.defineProperty(Deno,'serve',{configurable:true,writable:true,value:originalServe});}

Deno.test('overlapping workers retry failed devices only and never repeat uncertain sends',async()=>{
 const originalFetch=globalThis.fetch;const originalError=console.error;
 const keys=webpush.generateVAPIDKeys();const device=createECDH('prime256v1');device.generateKeys();
 const variables:Record<string,string>={CRON_SECRET:'synthetic-cron',VAPID_SUBJECT:'mailto:synthetic@example.test',VAPID_PUBLIC_KEY:keys.publicKey,VAPID_PRIVATE_KEY:keys.privateKey,SUPABASE_URL:'https://reminder-db.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-service-key'};
 const before=new Map(Object.keys(variables).map(key=>[key,Deno.env.get(key)]));
 for(const [key,value] of Object.entries(variables))Deno.env.set(key,value);
 console.error=()=>{}; // Expected synthetic transport failures; never log encrypted payloads or keys.
 const uid='84000000-0000-0000-0000-000000000001';
 const offset=new Date().getUTCHours()-12;const zone=`Etc/GMT${offset>=0?'+':'-'}${Math.abs(offset)}`;
 const profile={id:uid,last_seen_at:new Date(Date.now()-48*3600000).toISOString(),suspended_at:null,settings:{notifyOvertake:false}};
 const subscriptions=Array.from({length:5},(_,i)=>({id:i+1,user_id:uid,endpoint:`https://fcm.googleapis.com/fcm/send/${i+1}`,p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url'),timezone:zone,lang:'en',created_at:profile.last_seen_at}));
 type Delivery={state:string;attempt:number};
 const ledger=new Map<string,Delivery>();const calls=new Map<number,number>();
 let lease=false,state:Record<string,unknown>|null=null,active=0,peak=0,failDevice=true,loseReceipt=false,failBookkeeping=false;
 let unblock!:()=>void;let gate:Promise<void>=new Promise(resolve=>{unblock=resolve;});
 let began!:()=>void;const pushing=new Promise<void>(resolve=>{began=resolve;});
 const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json'}});
 globalThis.fetch=async(input,options)=>{
  const request=input instanceof Request?input:new Request(input,options);const url=new URL(request.url);
  if(url.hostname==='fcm.googleapis.com'){
   const id=Number(url.pathname.split('/').at(-1));calls.set(id,(calls.get(id)??0)+1);
   active++;peak=Math.max(peak,active);began();await gate;active--;
   if(id===2&&failDevice){failDevice=false;return new Response(null,{status:503});}
   return new Response(null,{status:201});
  }
  assert.equal(url.hostname,'reminder-db.invalid','Unexpected real network destination');
  const body=request.method==='POST'?await request.json():null;
  const name=url.pathname.split('/').at(-1)!;
  if(url.pathname.includes('/rpc/')){
   if(name==='verified_leaderboard_ranks')return json([]);
   if(name==='claim_reminder_user'){if(lease)return json(false);lease=true;return json(true);}
   const key=`${body.p_subscription}:${body.p_key}`;
   if(name==='claim_push_delivery'){
    const entry=ledger.get(key);
    if(entry&&['sent','unknown','expired'].includes(entry.state))return json({state:entry.state});
    if(entry?.state==='sending')return json({state:'claimed_elsewhere'});
    const next={state:'sending',attempt:(entry?.attempt??0)+1};ledger.set(key,next);return json({state:'claimed',attempt:next.attempt});
   }
   if(name==='finish_push_delivery'){
    if(loseReceipt){loseReceipt=false;throw new TypeError('Synthetic receipt connection lost after provider success');}
    const entry=ledger.get(key)!;if(entry.attempt===body.p_attempt)entry.state=body.p_state;return json(null);
   }
   throw new Error(`Unexpected RPC: ${name}`);
  }
  if(name==='push_subscriptions')return json(subscriptions);
  if(name==='profiles')return json([profile]);
  if(name==='push_state'){
   if(request.method==='POST'){
    if(failBookkeeping){failBookkeeping=false;return json({message:'synthetic state write failed',code:'XX000'},500);}
    state=body;return new Response(null,{status:204});
   }
   return json(state?[state]:[]);
  }
  throw new Error(`Unexpected table: ${name}`);
 };
 const invoke=()=>handler(new Request('https://worker.invalid',{method:'POST',headers:{'x-cron-secret':'synthetic-cron','Content-Type':'application/json'},body:'{}'}));
 try{
  const first=invoke();await pushing;
  const overlapping=await (await invoke()).json();assert.equal(overlapping.delivered,0);
  unblock();const initial=await (await first).json();assert.equal(initial.delivered,4);assert.equal(initial.failed,1);assert.equal(initial.inactivitySent,0);assert.equal(peak,3);
  lease=false;const retry=await (await invoke()).json();assert.equal(retry.delivered,1);assert.equal(retry.inactivitySent,1);
  assert.deepEqual([...calls.values()].sort(),[1,1,1,1,2]);
  // New synthetic absence: lose the delivery receipt after provider success and fail bookkeeping.
  profile.last_seen_at=new Date(Date.now()-72*3600000).toISOString();state=null;lease=false;loseReceipt=true;failBookkeeping=true;gate=Promise.resolve();
  const uncertain=await (await invoke()).json();assert.equal(uncertain.uncertain,1);
  const sentCount=[...calls.values()].reduce((a,b)=>a+b,0);
  lease=false;const recovered=await (await invoke()).json();assert.equal(recovered.inactivitySent,1);
  assert.equal([...calls.values()].reduce((a,b)=>a+b,0),sentCount,'Provider sends must not repeat after an uncertain receipt or lost bookkeeping');
  assert.ok([...ledger.values()].some(entry=>entry.state==='unknown'));
 }finally{
  unblock();globalThis.fetch=originalFetch;console.error=originalError;
  for(const [key,value] of before)if(value===undefined)Deno.env.delete(key);else Deno.env.set(key,value);
 }
});
