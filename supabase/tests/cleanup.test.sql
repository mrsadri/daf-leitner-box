-- Tests for migrations/20261117_cleanup_insights_dictation.sql on a local PostgreSQL (see scripts/test-sql.sh).
-- The harness has already run every migration (twice). Here the clean-up runs once more on fresh data, as it will in
-- production, and each check raises an exception when it fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000c1', 'c1@test'),
  ('00000000-0000-0000-0000-0000000000c2', 'c2@test');

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated, anon;

-- ---------------- data as it is in production before the clean-up ----------------
alter table public.cards disable trigger cards_guard_shared_copies;
insert into public.cards (user_id, id, type, box, next_review_date, data) values
  ('00000000-0000-0000-0000-0000000000c1', 'refl_own', 'reflection', 2, current_date, '{"title":"Mein Ziel"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'daf_02_24', 'vocab', 1, current_date, '{}'),
  ('00000000-0000-0000-0000-0000000000c1', 'shared_11111111-1111-1111-1111-111111111111', 'reflection', 3, current_date, '{"title":"Fremd"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'shared_22222222-2222-2222-2222-222222222222', 'reflection', 0, current_date, '{}');
alter table public.cards enable trigger cards_guard_shared_copies;
insert into public.story_progress (user_id, story_id, finished_count, total_count) values
  ('00000000-0000-0000-0000-0000000000c1', 'story-01', 12, 80),
  ('00000000-0000-0000-0000-0000000000c1', 'S01-Q1', 3, 3);
drop table if exists public.backup_shared_copies_20261117;

\ir ../migrations/20261117_cleanup_insights_dictation.sql

-- ---------------- copies ----------------
select pg_temp.check((select count(*) from public.backup_shared_copies_20261117) = 2, 'both copies are in the backup');
select pg_temp.check(not exists (select 1 from public.cards where left(id, 7) = 'shared_'), 'copies deleted');
select pg_temp.check((select count(*) from public.cards where user_id = '00000000-0000-0000-0000-0000000000c1') = 2, 'own cards untouched');

-- ---------------- objects ----------------
select pg_temp.check(to_regclass('public.shared_insights') is null and to_regclass('public.insight_reports') is null, 'sharing tables dropped');
select pg_temp.check(to_regprocedure('public.publish_insight(text)') is null and to_regprocedure('public.adopt_insight(uuid,date)') is null
  and to_regprocedure('public.share_quota()') is null and to_regprocedure('public.admin_list_insights()') is null, 'sharing functions dropped');
select pg_temp.check(to_regclass('public.story_sentence_progress') is null and to_regclass('public.dictation_events') is null, 'dictation tables dropped');
select pg_temp.check(to_regprocedure('public.save_dictation_progress(jsonb,jsonb)') is null and to_regprocedure('public.dictation_status_rank(text)') is null, 'dictation functions dropped');
select pg_temp.check(to_regclass('public.story_progress') is not null, 'story_progress kept');
select pg_temp.check(not exists (select 1 from public.story_progress where story_id = 'story-01')
  and exists (select 1 from public.story_progress where story_id = 'S01-Q1'), 'only old dictation rows removed');
select pg_temp.check((select value from public.app_flags where key = 'stories_enabled') = 'true'::jsonb
  and not exists (select 1 from public.app_flags where key = 'dictation_enabled'), 'flags');
select pg_temp.check(not has_table_privilege('authenticated', 'public.backup_shared_copies_20261117', 'select'), 'backup not readable by users');

-- ---------------- the app, as a signed-in user ----------------
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000c1', false);

-- An old phone sends a copy back (insert and upsert): skipped without an error
insert into public.cards (id, type, box, next_review_date) values ('shared_33333333-3333-3333-3333-333333333333', 'reflection', 0, current_date);
insert into public.cards (id, type, box, next_review_date) values ('shared_11111111-1111-1111-1111-111111111111', 'reflection', 4, current_date)
  on conflict (user_id, id) do update set box = excluded.box;
select pg_temp.check(not exists (select 1 from public.cards where left(id, 7) = 'shared_'), 'copies cannot come back, and no error');
-- Ordinary cards still sync
insert into public.cards (id, type, box, next_review_date) values ('refl_new', 'reflection', 0, current_date)
  on conflict (user_id, id) do update set box = excluded.box;
select pg_temp.check(exists (select 1 from public.cards where id = 'refl_new'), 'ordinary cards still sync');

-- Stories save progress with a plain upsert under row-level security
insert into public.story_progress (user_id, story_id, finished_count, total_count, last_sentence_id, last_active_at)
  values (auth.uid(), 'S01-Q2', 2, 4, 'p2', now())
  on conflict (user_id, story_id) do update set finished_count = excluded.finished_count;
insert into public.story_progress (user_id, story_id, finished_count, total_count, last_sentence_id, completed_at, last_active_at)
  values (auth.uid(), 'S01-Q2', 4, 4, 'p4', now(), now())
  on conflict (user_id, story_id) do update set finished_count = excluded.finished_count, completed_at = excluded.completed_at;
select pg_temp.check((select finished_count = 4 and completed_at is not null from public.story_progress where story_id = 'S01-Q2'), 'story progress upsert');
select pg_temp.check((select value from public.app_flags where key = 'stories_enabled') = 'true'::jsonb, 'users can read the flag');
select pg_temp.check((select count(*) from public.story_progress) = 2, 'users see only their own progress');

-- Another user's progress cannot be written
select set_config('test.uid', '00000000-0000-0000-0000-0000000000c2', false);
do $$ begin
  insert into public.story_progress (user_id, story_id, finished_count, total_count) values ('00000000-0000-0000-0000-0000000000c1', 'S02-Q1', 1, 3);
  raise exception 'FAILED: wrote another user''s progress';
exception when insufficient_privilege then raise notice 'ok: other users'' progress is protected';
end $$;
reset role;

-- Leave the database as the other test files expect it
delete from auth.users where id in ('00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-0000000000c2');

select pg_temp.check(true, 'PASSED cleanup');
