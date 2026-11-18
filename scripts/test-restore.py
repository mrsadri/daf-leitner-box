#!/usr/bin/env python3
"""Restore drill against the disposable cluster from test-sql.sh; never uses hosted credentials."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time
from datetime import datetime
from zoneinfo import ZoneInfo

parser=argparse.ArgumentParser()
parser.add_argument('pg_bin')
parser.add_argument('port',type=int)
args=parser.parse_args()
pg=Path(args.pg_bin)
connection=['-h','127.0.0.1','-p',str(args.port),'-U','postgres']
def run(binary,*values):
    return subprocess.check_output([str(pg/binary),*connection,*values],text=True,stderr=subprocess.PIPE)
def query(database,sql):
    return json.loads(run('psql','-d',database,'-X','-A','-t','-v','ON_ERROR_STOP=1','-c',sql))
metadata="""select jsonb_build_object(
 'columns',(select jsonb_agg(x order by table_name,ordinal_position) from (select table_name,column_name,ordinal_position,data_type,is_nullable,column_default from information_schema.columns where table_schema='public')x),
 'policies',(select jsonb_agg(x order by tablename,policyname) from (select tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname='public')x),
 'relations',(select jsonb_agg(x order by relname) from (select c.relname,c.relrowsecurity,c.relacl::text as grants from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r')x),
 'functions',(select jsonb_agg(x order by signature) from (select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition,p.proacl::text as grants from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f')x),
 'triggers',(select jsonb_agg(x order by relation,name) from (select c.relname as relation,t.tgname as name,pg_get_triggerdef(t.oid) as definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and not t.tgisinternal)x),
 'jobs',(select jsonb_agg(x order by jobname) from (select jobname,schedule,command,active from cron.job)x),
 'counts',jsonb_build_object('cards',(select count(*) from public.cards),'reviews',(select count(*) from public.review_events),'stories',(select count(*) from public.story_progress),'users',(select count(*) from auth.users)))"""
expected=query('postgres',metadata)
assert expected['counts']['cards']>0,'Restore drill needs the synthetic native concurrency fixtures'
destination='daf_restore_rehearsal'
with tempfile.TemporaryDirectory(prefix='daf-restore-') as tmp:
    backup=Path(tmp)/'synthetic.dump'
    started=time.monotonic()
    run('pg_dump','-d','postgres','--format=custom','--no-owner','--file',str(backup))
    dumped=time.monotonic()
    # Test the exact operator pipeline with a disposable key and synthetic data.
    identity=Path(tmp)/'identity'
    subprocess.run(['age-keygen','-o',str(identity)],check=True,capture_output=True)
    recipient=subprocess.check_output(['age-keygen','-y',str(identity)],text=True).strip()
    encrypted=Path(tmp)/'synthetic.dump.age'
    backup_env={**os.environ,'PATH':str(pg)+os.pathsep+os.environ['PATH'],
      'PGHOST':'127.0.0.1','PGPORT':str(args.port),'PGUSER':'postgres',
      'PGDATABASE':'postgres','BACKUP_AGE_RECIPIENT':recipient}
    subprocess.run(['bash','scripts/backup/encrypt-dump.sh',str(encrypted)],
      env=backup_env,check=True,capture_output=True)
    assert encrypted.read_bytes().startswith(b'age-encryption.org/v1'), 'Missing age envelope'
    backup.unlink()
    subprocess.run(['age','--decrypt','-i',str(identity),'-o',str(backup),str(encrypted)],
      check=True,capture_output=True)
    # Broken connection must leave no final or partial snapshot and no credential in diagnostics.
    failed=Path(tmp)/'failed.dump.age'
    failure=subprocess.run(['bash','scripts/backup/encrypt-dump.sh',str(failed)],
      env={**backup_env,'PGPORT':'1','PGCONNECT_TIMEOUT':'1','PGPASSWORD':'synthetic-secret'},capture_output=True)
    assert failure.returncode != 0 and not failed.exists() and not Path(str(failed)+'.partial').exists()
    assert b'synthetic-secret' not in failure.stdout+failure.stderr

    # Prove the dump is a snapshot: a later synthetic write must not appear in the restore.
    run('psql','-d','postgres','-v','ON_ERROR_STOP=1','-c',"insert into public.app_flags(key,value) values('restore_after_snapshot','true') on conflict(key) do update set value='true'")
    run('createdb',destination)
    try:
        restore_start=time.monotonic()
        run('pg_restore','-d',destination,'--exit-on-error','--no-owner',str(backup))
        restored=time.monotonic()
        actual=query(destination,metadata)
        assert actual==expected,'Restored data/schema/grants/policies/triggers/jobs differ'
        assert query(destination,"select count(*) from public.app_flags where key='restore_after_snapshot'")==0,'Post-snapshot write leaked into restored snapshot'
        # Private snapshot tables and answer banks must stay inaccessible after restore.
        assert query(destination,"select to_jsonb(not has_schema_privilege('authenticated','release_backup_20261118_pr32','usage'))")
        assert query(destination,"select to_jsonb(not has_table_privilege('authenticated','public.adjective_question_bank','select'))")
        report={
          'environment':'disposable local PostgreSQL with synthetic Auth/Cron; not hosted Supabase',
          'recordedAt':datetime.now(ZoneInfo('Europe/Berlin')).isoformat(timespec='seconds'),
          'backupBytes':backup.stat().st_size,'backupSeconds':round(dumped-started,3),
          'restoreSeconds':round(restored-restore_start,3),'validationSeconds':round(time.monotonic()-restored,3),
          'restoredCounts':actual['counts'],'schemaAndPermissionsEquivalent':True,
          'postSnapshotWriteAbsent':True,'encryptedRoundTripVerified':True,
          'failedBackupLeavesNoArtifact':True,'hostedRecoveryTargetsValidated':False,
          'limitations':'Same-cluster synthetic restore. Does not test hosted backup retention, Auth service recovery, Storage objects, operator RPO/RTO, or independent disaster recovery.'}
        path=os.environ.get('DAF_RESTORE_REPORT')
        if path:Path(path).write_text(json.dumps(report,indent=2)+'\n')
        print('PASS synthetic dump/restore: '+json.dumps(report))
    finally:
        run('dropdb','--if-exists',destination)
