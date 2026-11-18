import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validPushEndpoint, sendPushRequest } from '../supabase/functions/send-reminders/pushEndpoint.ts';
test('push worker permits provider origins and rejects arbitrary or ambiguous destinations', () => {
 for (const url of ['https://fcm.googleapis.com/fcm/send/a','https://updates.push.services.mozilla.com/wpush/a','https://web.push.apple.com/a']) assert.equal(validPushEndpoint(url),true,url);
 for (const url of ['http://fcm.googleapis.com/a','https://127.0.0.1/a','https://169.254.169.254/a','https://fcm.googleapis.com.evil.test/a','https://evil.test/a','https://user@fcm.googleapis.com/a','https://fcm.googleapis.com:444/a']) assert.equal(validPushEndpoint(url),false,url);
});


test('push request boundary never fetches forbidden endpoints and rejects redirects',async()=>{
 let calls=0;
 const fetcher:typeof fetch=async(_url,options)=>{
  calls++;assert.equal(options?.redirect,'error');assert.ok(options?.signal instanceof AbortSignal);
  return new Response(null,{status:302,headers:{Location:'https://example.invalid/private'}});
 };
 const request={endpoint:'https://127.0.0.1/private',method:'POST',headers:{}};
 await assert.rejects(sendPushRequest(request,fetcher),/Unsupported push destination/);
 assert.equal(calls,0);
 await assert.rejects(sendPushRequest({...request,endpoint:'https://fcm.googleapis.com/send/example'},fetcher),/redirects are forbidden/);
 assert.equal(calls,1,'redirect target must never be fetched');
});

test('valid push requests preserve the signed body and use a ten-second timeout',async(t)=>{
 const controller=new AbortController();
 t.mock.method(AbortSignal,'timeout',(ms:number)=>{assert.equal(ms,10000);return controller.signal;});
 const response=await sendPushRequest({endpoint:'https://web.push.apple.com/example',method:'POST',headers:{Authorization:'synthetic'},body:'encrypted'},async(url,options)=>{
  assert.equal(url,'https://web.push.apple.com/example');assert.equal(options?.body,'encrypted');assert.equal(options?.signal,controller.signal);
  return new Response(null,{status:201});
 });
 assert.equal(response.status,201);
});
