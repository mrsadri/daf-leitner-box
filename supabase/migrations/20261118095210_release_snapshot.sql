begin;
-- Private pre-release recovery snapshot. Keep it on the database; never export learner data to Git.
-- The operator applies this before the release migrations; replay preserves the first snapshot.
set local lock_timeout='5s';
lock table public.profiles,public.cards,public.review_events,public.story_progress,
 public.adjective_drill_runs,public.push_subscriptions,public.push_state,public.overdue_demotions,public.app_flags in share mode;
create schema if not exists release_backup_20261118_pr32;
revoke all on schema release_backup_20261118_pr32 from public,anon,authenticated;
do $$ declare name_ text; begin
 foreach name_ in array array['profiles','cards','review_events','story_progress','adjective_drill_runs','push_subscriptions','push_state','overdue_demotions','app_flags'] loop
  execute format('create table if not exists release_backup_20261118_pr32.%I as table public.%I',name_,name_);
  execute format('alter table release_backup_20261118_pr32.%I enable row level security',name_);
 end loop;
end $$;
create table if not exists release_backup_20261118_pr32.function_definitions as
 select p.oid::regprocedure::text as signature,pg_get_functiondef(p.oid) as definition
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prokind='f';
alter table release_backup_20261118_pr32.function_definitions enable row level security;
create table if not exists release_backup_20261118_pr32.manifest as
 select now() as captured_at,'PR 32 pre-release snapshot; not a disaster-recovery backup'::text as purpose;
alter table release_backup_20261118_pr32.manifest enable row level security;
revoke all on all tables in schema release_backup_20261118_pr32 from public,anon,authenticated;
-- Advisor hardening: triggers remain executable by their owner; clients cannot call this internal function.
alter function public.validate_review_event() set search_path=public;
revoke all on function public.handle_new_user() from public,anon,authenticated;

commit;
