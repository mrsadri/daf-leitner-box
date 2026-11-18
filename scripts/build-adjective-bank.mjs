import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {build} from 'vite';
const result=await build({configFile:false,logLevel:'silent',build:{write:false,minify:false,lib:{entry:'src/features/adjective/grammar.ts',formats:['es']}}});
const bundle=Array.isArray(result)?result[0]:result;
const chunk=bundle.output.find(x=>x.type==='chunk');
const {NOUNS,ADJECTIVES,CASES,declinePhrase}=await import(`data:text/javascript;base64,${Buffer.from(chunk.code).toString('base64')}`);
const rows=[];
for(const [index,noun]of NOUNS.entries())for(const number of (noun.plural&&!noun.noArticle?['sg','pl']:['sg'])){
 const articles=number==='pl'||noun.noArticle?['definite','negative','none']:['definite','indefinite','negative'];
 for(const [ci,gcase]of CASES.entries())for(const [ai,articleType]of articles.entries()){
  const adjective=articleType==='none'||(index+ci+ai)%5!==0?ADJECTIVES[(index*3+ci+ai)%ADJECTIVES.length]:null;
  const params={noun,adjective,articleType,case:gcase,gender:noun.gender,number};
  const phrase=declinePhrase(params);
  const answers={article:phrase.article?.ending??null,adjective:phrase.adjective?.ending??null,noun:phrase.noun.ending};
  const hash=createHash('sha256').update(JSON.stringify({params,answers})).digest('hex').slice(0,24);
  const key=`${noun.id}-${number}-${gcase}-${articleType}-${hash}`;
  const quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
  rows.push(`('${key}',${quote(params)},${quote(answers)},true)`);
 }
}
const file='supabase/migrations/20261118063937_verified_adjective.sql';
const marker='-- BEGIN GENERATED ADJECTIVE BANK';
const prefix=fs.readFileSync(file,'utf8').split(marker)[0].trimEnd();
const generated=prefix+'\n\n'+marker+'\nupdate public.adjective_question_bank set active=false;\ninsert into public.adjective_question_bank(question_key,params,answers,active) values\n'+rows.join(',\n')+'\non conflict(question_key) do update set active=true;\n';
if(process.argv.includes('--check')){if(fs.readFileSync(file,'utf8')!==generated)throw new Error('Adjective bank is stale');}
else fs.writeFileSync(file,generated);
console.log(`${rows.length} deterministic server questions ${process.argv.includes('--check')?'verified':'generated'}`);
