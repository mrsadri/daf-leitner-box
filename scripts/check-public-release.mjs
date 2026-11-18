/** Public, signed-out release checks. No credentials, login, notifications or database mutations. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base=new URL(process.argv[2]??'https://daf-leitner-box.vercel.app');
assert.equal(base.protocol,'https:','Use an HTTPS public release URL');
const request=async path=>{
 const url=new URL(path,base);assert.equal(url.origin,base.origin,'Release asset must be same-origin');
 const response=await fetch(url,{signal:AbortSignal.timeout(15000)});
 assert.equal(response.status,200,`${url.pathname}: expected HTTP 200`);return response;
};
const root=await request('/');const html=await root.text();
const headers={
 nosniff:root.headers.get('x-content-type-options'),
 frameOptions:root.headers.get('x-frame-options'),
 referrerPolicy:root.headers.get('referrer-policy'),
 permissionsPolicy:root.headers.get('permissions-policy'),
 reportOnlyCsp:root.headers.get('content-security-policy-report-only'),
};
assert.equal(headers.nosniff,'nosniff');assert.equal(headers.frameOptions,'DENY');
assert.equal(headers.referrerPolicy,'strict-origin-when-cross-origin');
assert.ok(headers.permissionsPolicy?.includes('camera=()'));assert.ok(headers.permissionsPolicy?.includes('microphone=()'));
assert.ok(headers.reportOnlyCsp?.includes("object-src 'none'"));assert.ok(headers.reportOnlyCsp?.includes("frame-ancestors 'none'"));
const scripts=[...html.matchAll(/<script\b[^>]*src="([^"]+)"/g)].map(match=>match[1]);
const styles=[...html.matchAll(/<link\b[^>]*href="([^"]+\.css(?:\?[^"]*)?)"/g)].map(match=>match[1]);
assert.ok(scripts.length>0,'Missing application script');
const checked=[];
for(const path of scripts){await request(path);checked.push(path);}
for(const path of styles){
 const css=await (await request(path)).text();checked.push(path);
 const fonts=[...css.matchAll(/url\(["']?([^"')]+\.(?:woff2?|ttf))["']?\)/g)].map(match=>new URL(match[1],new URL(path,base)).href);
 for(const font of [...new Set(fonts)].slice(0,2)){await request(font);checked.push(new URL(font).pathname);}
}
assert.equal((await (await request('/data/stories/index.json')).json()).books.length,10);
await request('/privacy.html');await request('/sw.js');
const report={checkedAt:new Date().toISOString(),url:base.origin,headers,assets:checked,storyBooks:10,
 scope:'Public signed-out HTTP/assets only; no authenticated learner flow or notification sent',
 cspEnforced:false,interactiveOAuthVerified:false,realPushDeliveryVerified:false};
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
