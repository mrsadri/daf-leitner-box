/** Read-only metadata check; never reads secret values or connects to PostgreSQL. */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const repository='mrsadri/daf-leitner-box';
const read=args=>JSON.parse(execFileSync('gh',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}));
let report;
try {

 const variables=read(['variable','list','--repo',repository,'--json','name,value']);
 const value=name=>variables.find(item=>item.name===name)?.value;
 const required=['BACKUP_PGHOST','BACKUP_PGPORT','BACKUP_PGUSER','BACKUP_PGPASSWORD'];
 const missingVariables=['BACKUP_REPOSITORY','BACKUP_AGE_RECIPIENT'].filter(name=>!value(name));
 const recipientValid=/^age1[0-9a-z]+$/.test(value('BACKUP_AGE_RECIPIENT')??'');
 const destination=value('BACKUP_REPOSITORY');
 let privateDestination=false;
 if(destination&&/^[\w.-]+\/[\w.-]+$/.test(destination)) {
  try {privateDestination=read(['repo','view',destination,'--json','visibility']).visibility==='PRIVATE';}catch{/* Inaccessible destinations fail closed. */}
 }
 const secrets=privateDestination?read(['secret','list','--repo',destination,'--json','name']).map(item=>item.name):[];
 const missingSecrets=required.filter(name=>!secrets.includes(name));
 const privateVariables=privateDestination?read(['variable','list','--repo',destination,'--json','name,value']):[];
 const privateValue=name=>privateVariables.find(item=>item.name===name)?.value;
 const privateConfigurationMatches=privateValue('BACKUP_REPOSITORY')===destination&&privateValue('BACKUP_AGE_RECIPIENT')===value('BACKUP_AGE_RECIPIENT');
 const configured=missingSecrets.length===0&&missingVariables.length===0&&recipientValid&&privateDestination&&privateConfigurationMatches;
 report={checkedAt:new Date().toISOString(),configured,enabled:privateValue('BACKUP_ENABLED')==='true',missingSecrets,missingVariables,recipientValid,privateDestination,privateConfigurationMatches,
   secretValuesRead:false,databaseAccessed:false,hostedRestoreValidated:false,
   setupUrl:`https://github.com/${privateDestination?destination:repository}/settings/secrets/actions`,
   nextAction:configured?'Run a manual backup, download/decrypt it and validate an isolated restore before relying on recovery targets.':'Complete the missing configuration using docs/encrypted-backups.md; keep BACKUP_ENABLED disabled.'};
} catch {
 report={configured:false,metadataAccessible:false,error:'Cannot read GitHub Actions configuration. Authenticate gh with permission to inspect this repository; no secret values were requested.'};
}
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
if(!report.configured)process.exitCode=1;
