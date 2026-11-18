/** Clean installation and legacy-fixture upgrade equivalence. Always isolated, never hosted. */
import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {applySchema,schemaFiles,repositoryRoot} from './database-schema.mjs';
const snapshots={
 schemas:`select nspname,nspacl::text as grants from pg_namespace where nspname in ('public','cron') order by nspname`,
 defaults:`select pg_get_userbyid(d.defaclrole) as owner,n.nspname,d.defaclobjtype,d.defaclacl::text as grants from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by owner,n.nspname,d.defaclobjtype`,
 views:`select viewname,definition from pg_views where schemaname='public' order by viewname`,
 sequences:`select sequencename,data_type::text,start_value,min_value,max_value,increment_by,cycle,cache_size from pg_sequences where schemaname='public' order by sequencename`,
 columns:`select table_name,column_name,ordinal_position,data_type,udt_name,is_nullable,column_default from information_schema.columns where table_schema='public' order by table_name,ordinal_position`,
 constraints:`select c.relname,con.conname,pg_get_constraintdef(con.oid) as definition from pg_constraint con join pg_class c on c.oid=con.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname,con.conname`,
 indexes:`select tablename,indexname,indexdef from pg_indexes where schemaname='public' order by tablename,indexname`,
 policies:`select tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' order by tablename,policyname`,
 functions:`select p.proname,pg_get_function_identity_arguments(p.oid) as arguments,pg_get_functiondef(p.oid) as definition,p.proacl::text as grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f' order by p.proname,arguments`,
 relations:`select c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text as grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' order by c.relname`,
 columnGrants:`select table_name,column_name,grantee,privilege_type,is_grantable from information_schema.column_privileges where table_schema='public' order by table_name,column_name,grantee,privilege_type`,
 triggers:`select c.relname,t.tgname,pg_get_triggerdef(t.oid) as definition,t.tgenabled from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal order by c.relname,t.tgname`,
 jobs:`select jobname,schedule,command,active from cron.job order by jobname`,
};
const clean=new PGlite(),upgrade=new PGlite();
try{
 await applySchema(clean);
 await upgrade.exec(fs.readFileSync(path.join(repositoryRoot,'supabase/tests/stub-supabase.sql'),'utf8'));
 const files=schemaFiles();const boundary=files.findIndex(file=>path.basename(file).startsWith('20261118055307'));
 assert.ok(boundary>0,'Upgrade boundary must exist');
 for(const file of files.slice(0,boundary))await upgrade.exec(fs.readFileSync(path.join(repositoryRoot,file),'utf8'));
 await upgrade.exec(`insert into auth.users(id,email) values('81000000-0000-0000-0000-000000000001','upgrade@example.test');
 insert into public.cards(user_id,id,type,box,next_review_date,review_count,correct_count,wrong_count)
 values('81000000-0000-0000-0000-000000000001','daf_01_1','vocab',3,current_date,3,3,0);
 insert into public.story_progress(user_id,story_id,finished_count,total_count,completed_at)
 values('81000000-0000-0000-0000-000000000001','S01-Q1',5,5,now());`);
 for(const file of files.slice(boundary))await upgrade.exec(fs.readFileSync(path.join(repositoryRoot,file),'utf8'));
 // Replay tests additive upgrade files against an installation containing existing learner data.
 for(const file of files.slice(boundary))await upgrade.exec(fs.readFileSync(path.join(repositoryRoot,file),'utf8'));
 for(const [name,query] of Object.entries(snapshots)){
  assert.deepEqual((await upgrade.query(query)).rows,(await clean.query(query)).rows,`${name} differ between clean and upgraded installations`);
  console.log(`PASS clean/upgrade ${name}`);
 }
 assert.equal((await upgrade.query("select box from public.cards where id='daf_01_1'")).rows[0].box,3);
 assert.equal((await upgrade.query("select finished_count,completed_at is not null as completed from public.story_progress where story_id='S01-Q1'")).rows[0].completed,true);
 assert.equal((await upgrade.query('select count(*)::integer as n from public.verified_card_points')).rows[0].n,0);
 console.log('PASS legacy card/story data preserved without fabricated competitive credit');
}finally{await Promise.all([clean.close(),upgrade.close()]);}
