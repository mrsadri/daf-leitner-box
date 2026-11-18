/** Uses real web-push encryption/signing, but a fake HTTP transport; no provider is contacted. */
import assert from 'node:assert/strict';
import {createECDH,randomBytes} from 'node:crypto';
import webpush from 'npm:web-push@3.6.7';
import {sendPushRequest} from './pushEndpoint.ts';

Deno.test('real web-push request survives the Deno transport policy',async()=>{
 const vapid=webpush.generateVAPIDKeys();
 webpush.setVapidDetails('mailto:synthetic@example.test',vapid.publicKey,vapid.privateKey);
 const device=createECDH('prime256v1');device.generateKeys();
 const endpoint='https://fcm.googleapis.com/fcm/send/synthetic';
 const request=webpush.generateRequestDetails({endpoint,keys:{p256dh:device.getPublicKey().toString('base64url'),auth:randomBytes(16).toString('base64url')}},JSON.stringify({title:'Synthetic test'}),{TTL:3600});
 let calls=0;
 const response=await sendPushRequest(request,async(url,options)=>{
  calls++;assert.equal(url,endpoint);assert.equal(options?.redirect,'error');
  const headers=new Headers(options?.headers);
  assert.equal(headers.get('content-encoding'),'aes128gcm');
  assert.ok(headers.has('authorization'));assert.ok(options?.body);
  return new Response(null,{status:201});
 });
 assert.equal(response.status,201);assert.equal(calls,1);
});

Deno.test('Deno request boundary refuses a redirect without contacting its target',async()=>{
 // Data URLs cannot redirect. A synthetic fetch verifies the policy without opening sockets.
 let calls=0;
 await assert.rejects(()=>sendPushRequest({endpoint:'https://web.push.apple.com/synthetic',method:'POST',headers:{}},async(_url,options)=>{
  calls++;assert.equal(options?.redirect,'error');return new Response(null,{status:307});
 }),/redirects are forbidden/);
 assert.equal(calls,1);
});
