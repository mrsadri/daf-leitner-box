-- Tests for migrations/20261117_adjective_drill.sql on a local PostgreSQL (see scripts/test-sql.sh).
-- Each check raises an exception when it fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000a1', 'a1@test'),  -- normal user
  ('00000000-0000-0000-0000-0000000000a2', 'a2@test'),  -- suspended
  ('00000000-0000-0000-0000-0000000000a3', 'a3@test'),  -- hidden from leaderboard
  ('00000000-0000-0000-0000-0000000000a4', 'a4@test');  -- normal user, for ties
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000a2';
update public.profiles set show_on_leaderboard = false where id = '00000000-0000-0000-0000-0000000000a3';

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated, anon;

-- ---------------- starting a run ----------------
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

do $$
declare v_id uuid;
begin
  v_id := public.start_adjective_run();
  if v_id is null then raise exception 'FAILED: start returned no id'; end if;
  raise notice 'ok: start_adjective_run returns an id';
end $$;

do $$ begin
  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
  perform public.start_adjective_run();
  raise exception 'FAILED: a suspended user could start a run';
exception when others then raise notice 'ok: a suspended user cannot start a run';
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
reset role;

-- ---------------- finishing: too early ----------------
set role service_role; -- bypasses RLS, so the harness can read/backdate rows directly
delete from public.adjective_drill_runs; -- start fresh for the scored checks below
reset role;

set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
do $$
declare v_id uuid;
begin
  v_id := public.start_adjective_run();
  begin
    perform public.finish_adjective_run(v_id, 5, 10);
    raise exception 'FAILED: finished immediately (too early) without error';
  exception when others then raise notice 'ok: finishing right after starting is rejected (too early)';
  end;
end $$;
reset role;

-- ---------------- finishing: too late, invalid scores, ownership, double-finish ----------------
set role service_role;
delete from public.adjective_drill_runs;
insert into public.adjective_drill_runs (id, user_id, started_at) values
  ('11111111-0000-0000-0000-000000000001', '00000000-0000-0000-0000-0000000000a1', now() - interval '25 hours'),
  ('11111111-0000-0000-0000-000000000002', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 minutes'),
  ('11111111-0000-0000-0000-000000000003', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 minutes'),
  ('11111111-0000-0000-0000-000000000004', '00000000-0000-0000-0000-0000000000a1', now() - interval '6 minutes');
reset role;

set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

do $$ begin
  perform public.finish_adjective_run('11111111-0000-0000-0000-000000000001', 5, 10);
  raise exception 'FAILED: a run older than 24h was accepted';
exception when others then raise notice 'ok: a run older than 24h is rejected (too late)';
end $$;

do $$ begin
  perform public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 10, 5);
  raise exception 'FAILED: score greater than answered was accepted';
exception when others then raise notice 'ok: score > answered is rejected';
end $$;

do $$ begin
  perform public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 151, 151);
  raise exception 'FAILED: answered above the 150 cap was accepted';
exception when others then raise notice 'ok: answered > 150 is rejected';
end $$;

do $$ begin
  perform set_config('test.uid', '00000000-0000-0000-0000-0000000000a4', false);
  perform public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 5, 10);
  raise exception 'FAILED: a different user finished someone else''s run';
exception when others then raise notice 'ok: a run can only be finished by its owner';
end $$;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

select public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 8, 10);
select pg_temp.check((select score = 8 and answered = 10 and finished_at is not null
  from public.adjective_drill_runs where id = '11111111-0000-0000-0000-000000000002'), 'a valid finish is recorded');

select public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 8, 10); -- same values again
select pg_temp.check(true, 'sending the same finished result twice is accepted (idempotent)');

do $$ begin
  perform public.finish_adjective_run('11111111-0000-0000-0000-000000000002', 9, 10);
  raise exception 'FAILED: a finished run accepted a different result';
exception when others then raise notice 'ok: a finished run rejects a different result (not re-scored)';
end $$;

reset role;

-- ---------------- daily start limit ----------------
set role service_role;
delete from public.adjective_drill_runs;
reset role;

set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  for i in 1..30 loop
    perform public.start_adjective_run();
  end loop;
end $$;
select pg_temp.check((select count(*) = 30 from public.adjective_drill_runs where user_id = '00000000-0000-0000-0000-0000000000a1'), '30 starts succeed');
do $$ begin
  perform public.start_adjective_run();
  raise exception 'FAILED: a 31st start today was accepted';
exception when others then raise notice 'ok: more than 30 starts in a UTC day is rejected';
end $$;
reset role;

-- ---------------- ranking, ties, top3, hidden and suspended users, empty week ----------------
set role service_role;
delete from public.adjective_drill_runs;
-- a1: best 10 (older), two more finished runs -> top3 = {10, 7, 4}; best is > 7 days old (out of the week view)
insert into public.adjective_drill_runs (user_id, score, answered, started_at, finished_at) values
  ('00000000-0000-0000-0000-0000000000a1', 10, 12, now() - interval '20 days' - interval '6 minutes', now() - interval '20 days'),
  ('00000000-0000-0000-0000-0000000000a1', 7,  9,  now() - interval '2 days'  - interval '6 minutes', now() - interval '2 days'),
  ('00000000-0000-0000-0000-0000000000a1', 4,  8,  now() - interval '1 days'  - interval '6 minutes', now() - interval '1 days');
-- a4: ties a1's old best (10) but reached it later -> a1 ranks ahead on the earlier best_at
insert into public.adjective_drill_runs (user_id, score, answered, started_at, finished_at) values
  ('00000000-0000-0000-0000-0000000000a4', 10, 10, now() - interval '19 days' - interval '6 minutes', now() - interval '19 days');
-- a2 (suspended): would otherwise lead, must not appear at all
insert into public.adjective_drill_runs (user_id, score, answered, started_at, finished_at) values
  ('00000000-0000-0000-0000-0000000000a2', 50, 50, now() - interval '1 days' - interval '6 minutes', now() - interval '1 days');
-- a3 (hidden): a recent best, within the week
insert into public.adjective_drill_runs (user_id, score, answered, started_at, finished_at) values
  ('00000000-0000-0000-0000-0000000000a3', 6, 6, now() - interval '1 days' - interval '6 minutes', now() - interval '1 days');
reset role;

set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);

select pg_temp.check((select top3 = '{10,7,4}' from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a1'), 'top3 holds the three highest individual scores, descending');
select pg_temp.check((select best = 10 and rank = 1 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a1'), 'a1 ranks 1st (tie with a4, earlier best_at)');
select pg_temp.check((select rank = 2 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a4'), 'a4 ranks 2nd (same score as a1, later best_at)');
select pg_temp.check(not exists (select 1 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a2'), 'a suspended user never appears on the board');
select pg_temp.check(not exists (select 1 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a3'), 'a1 cannot see a3''s hidden row');

select pg_temp.check((select count(*) = 1 from public.get_adjective_board('week', 100) where user_id = '00000000-0000-0000-0000-0000000000a1'), 'a1''s week best is the 2-days-old run, not the 20-days-old one');
select pg_temp.check((select best = 7 from public.get_adjective_board('week', 100) where user_id = '00000000-0000-0000-0000-0000000000a1'), 'week best picks the best run within 7 days, not the all-time best');
select pg_temp.check(not exists (select 1 from public.get_adjective_board('week', 100) where user_id = '00000000-0000-0000-0000-0000000000a4'), 'a4 has no run in the last 7 days: not listed on the week board');

select pg_temp.check((select best_all = 10 and best_week = 7 from public.get_my_adjective_bests()), 'get_my_adjective_bests: all-time vs this-week for the caller');

-- a3 is hidden from others but still sees their own row and rank
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a3', false);
select pg_temp.check((select count(*) = 1 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a3'), 'a3 sees their own row even while hidden');
select pg_temp.check((select best_all = 6 from public.get_my_adjective_bests()), 'a3''s own bests are visible to themselves');
reset role;

-- a2 (suspended): their own row never appears, even to themselves, though they still see everyone else's
-- (the exclusion is per-row, like get_leaderboard; suspension is enforced separately on writes)
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a2', false);
select pg_temp.check(not exists (select 1 from public.get_adjective_board('all', 100) where user_id = '00000000-0000-0000-0000-0000000000a2'), 'a suspended caller''s own row never appears, even to themselves');
select pg_temp.check((select count(*) >= 2 from public.get_adjective_board('all', 100)), 'a suspended caller still sees other players'' rows');
reset role;

-- ---------------- access control on the table itself ----------------
set role authenticated;
select set_config('test.uid', '00000000-0000-0000-0000-0000000000a1', false);
do $$ begin
  insert into public.adjective_drill_runs (id) values ('22222222-0000-0000-0000-000000000001');
  raise exception 'FAILED: a user could insert into adjective_drill_runs directly';
exception when insufficient_privilege then raise notice 'ok: users cannot insert runs directly (writes go through the functions)';
end $$;
select pg_temp.check((select count(*) >= 1 from public.adjective_drill_runs where user_id = auth.uid()), 'users can select their own runs');
select pg_temp.check(not exists (select 1 from public.adjective_drill_runs where user_id <> auth.uid()), 'users cannot select another user''s runs');
reset role;

-- Leave the database as the other test files expect it
delete from auth.users where id in (
  '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2',
  '00000000-0000-0000-0000-0000000000a3', '00000000-0000-0000-0000-0000000000a4'
);

select pg_temp.check(true, 'PASSED adjective_drill');
