/** Fresh signed-out browser; injects enforcement locally, stops before Google credentials. */
import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const base='https://daf-leitner-box.vercel.app';
const candidate=process.argv.includes('--candidate');
const browser=await chromium.launch({executablePath:process.env.PW_EXE});
const results=[];
try {
 for(const lang of ['en','fa']) {
  const context=await browser.newContext({serviceWorkers:'block'});
  const page=await context.newPage();
  const errors=[];let handoff=false;let redirectValid=false;
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(lang=>{
   localStorage.setItem('daf_lang',lang);
   window.__cspViolations=[];
   document.addEventListener('securitypolicyviolation',e=>window.__cspViolations.push({directive:e.effectiveDirective,blocked:e.blockedURI}));
  },lang);
  await page.route(base+'/',async route=>{
   const response=await route.fetch();const headers={...response.headers()};
   assert.ok(headers['content-security-policy-report-only']);
   headers['content-security-policy']=headers['content-security-policy-report-only'];
   delete headers['content-security-policy-report-only'];
   let body=await response.text();
   if(candidate)body=body.replace(/<script>[^]*?<\/script>/,'<script src="/interface-language.js"></script>');
   await route.fulfill({response,headers,body});
  });
  if(candidate)await page.route(base+'/interface-language.js',route=>route.fulfill({contentType:'application/javascript',body:fs.readFileSync('public/interface-language.js','utf8')}));
  await page.route('https://accounts.google.com/**',async route=>{
   handoff=true;
   await route.fulfill({status:200,contentType:'text/html',body:'<title>OAuth handoff captured</title>'});
  });
  page.on('request',request=>{
   const url=new URL(request.url());
   if(url.hostname.endsWith('.supabase.co')&&url.pathname==='/auth/v1/authorize') {
    assert.equal(url.searchParams.get('provider'),'google');
    redirectValid=new URL(url.searchParams.get('redirect_to')).origin===base;
   }
  });
  await page.goto(base,{waitUntil:'networkidle'});
  const button=page.getByRole('button',{name:/Google|گوگل/i});
  await button.waitFor();
  const violations=await page.evaluate(()=>window.__cspViolations);
  await button.click();
  await page.waitForURL('https://accounts.google.com/**',{timeout:20000});
  assert.equal(handoff,true);assert.equal(redirectValid,true);
  assert.deepEqual(violations,[]);assert.deepEqual(errors,[]);
  results.push({lang,injectedCspEnforcementPassed:true,oauthGoogleHandoff:true,redirectOriginCorrect:true,violations,errors});
  await context.close();
 }
 const report={candidateBootstrap:candidate,checkedAt:new Date().toISOString(),results,scope:'Fresh signed-out browser with locally injected enforcement; Google destination intercepted before credentials. Not interactive login, authenticated flow, push delivery or production CSP enforcement.'};
 if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
 console.log(JSON.stringify(report,null,2));
}finally{await browser.close();}
