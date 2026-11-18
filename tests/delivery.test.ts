import {test} from 'node:test';
import assert from 'node:assert/strict';
import {deliveryOutcome,mapBounded} from '../supabase/functions/send-reminders/delivery.ts';
test('ambiguous sends are not automatically retried; status failures remain distinct',()=>{
 assert.equal(deliveryOutcome(null),'unknown');assert.equal(deliveryOutcome(201),'sent');assert.equal(deliveryOutcome(410),'expired');assert.equal(deliveryOutcome(503),'failed');
});
test('bounded sends retain result ordering and never exceed concurrency',async()=>{
 let active=0,peak=0;
 const results=await mapBounded([1,2,3,4,5],2,async value=>{active++;peak=Math.max(peak,active);await new Promise<void>(resolve=>setTimeout(resolve,1));active--;return value*2;});
 assert.deepEqual(results,[2,4,6,8,10]);assert.equal(peak,2);
});
