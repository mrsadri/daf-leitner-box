-- Tests for migrations/20261030_overdue_overtake.sql on a local PostgreSQL (see scripts/test-sql.sh).
-- Each check raises an exception when it fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-000000000001', 'u1@test'),
  ('00000000-0000-0000-0000-000000000002', 'u2@test'),
  ('00000000-0000-0000-0000-000000000003', 'u3@test');
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-000000000002';
update public.profiles set show_on_leaderboard = false where id = '00000000-0000-0000-0000-000000000003';

-- "Today" for all runs: 2026-11-10
insert into public.cards (user_id, id, type, box, next_review_date) values
  ('00000000-0000-0000-0000-000000000001', 'b3_3days',  'vocab', 3, '2026-11-07'),  -- the user's example → box 2, due 11-14
  ('00000000-0000-0000-0000-000000000001', 'b3_2days',  'vocab', 3, '2026-11-08'),  -- only 2 days → unchanged
  ('00000000-0000-0000-0000-000000000001', 'b5_40days', 'vocab', 5, '2026-10-01'),  -- chained → box 1, due 11-12
  ('00000000-0000-0000-0000-000000000001', 'b1_9days',  'vocab', 1, '2026-11-01'),  -- → box 0, due 11-05 (stays due)
  ('00000000-0000-0000-0000-000000000001', 'b0_old',    'vocab', 0, '2026-10-01'),  -- box 0 → unchanged
  ('00000000-0000-0000-0000-000000000001', 'b6',        'vocab', 6, '2999-12-31'),  -- archive → unchanged
  ('00000000-0000-0000-0000-000000000001', 'b2_future', 'vocab', 2, '2026-11-20'),  -- not due → unchanged
  ('00000000-0000-0000-0000-000000000001', 'refl',      'reflection', 2, '2026-11-05'), -- → box 1, due 11-10
  ('00000000-0000-0000-0000-000000000002', 'sus',       'vocab', 3, '2026-10-01'),  -- suspended → unchanged
  ('00000000-0000-0000-0000-000000000003', 'hidden',    'vocab', 4, '2026-11-01');  -- → box 3, due 11-12

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;

create function pg_temp.card(p_id text) returns text language sql as $$
  select box || ' ' || next_review_date from public.cards where id = p_id
$$;

-- Dry run: reports, changes nothing
select pg_temp.check((select users_affected = 2 and cards_moved = 5 from public.apply_overdue_demotions(true, '2026-11-10')), 'dry run counts');
select pg_temp.check(pg_temp.card('b3_3days') = '3 2026-11-07', 'dry run left cards alone');
select pg_temp.check((select count(*) = 0 from public.overdue_demotions), 'dry run wrote no log');
select pg_temp.check((select moves = '{"1→0": 1, "2→1": 1, "3→2": 1, "4→3": 1, "5→1": 1}'::jsonb from public.apply_overdue_demotions(true, '2026-11-10')), 'dry run moves summary');

-- Real run
select pg_temp.check((select cards_moved = 5 from public.apply_overdue_demotions(false, '2026-11-10')), 'real run moved 5 cards');
select pg_temp.check(pg_temp.card('b3_3days')  = '2 2026-11-14', 'box 3, 3 days overdue → start of box 2 (due in 4 days)');
select pg_temp.check(pg_temp.card('b3_2days')  = '3 2026-11-08', '2 days overdue → unchanged');
select pg_temp.check(pg_temp.card('b5_40days') = '1 2026-11-12', 'box 5, 40 days overdue → box 1 via 4, 3, 2');
select pg_temp.check(pg_temp.card('b1_9days')  = '0 2026-11-05', 'box 1 → box 0 and still due');
select pg_temp.check(pg_temp.card('b0_old')    = '0 2026-10-01', 'box 0 unchanged');
select pg_temp.check(pg_temp.card('b6')        = '6 2999-12-31', 'archive unchanged');
select pg_temp.check(pg_temp.card('b2_future') = '2 2026-11-20', 'not due → unchanged');
select pg_temp.check(pg_temp.card('refl')      = '1 2026-11-10', 'reflection cards follow the rule too');
select pg_temp.check(pg_temp.card('sus')       = '3 2026-10-01', 'suspended account untouched');
select pg_temp.check(pg_temp.card('hidden')    = '3 2026-11-12', 'hidden-from-leaderboard users follow the rule');
select pg_temp.check((select count(*) = 5 from public.overdue_demotions), 'one log row per moved card');
select pg_temp.check((select from_box = 5 and to_box = 1 and demoted_on = '2026-11-10' from public.overdue_demotions where card_id = 'b5_40days'), 'log keeps original and final box');

-- Same day again: nothing more
select pg_temp.check((select cards_moved = 0 from public.apply_overdue_demotions(false, '2026-11-10')), 'second run the same day changes nothing');
select pg_temp.check((select count(*) = 5 from public.overdue_demotions), 'no extra log rows');

-- Following days: each card moves again only after 3 more unreviewed days
select pg_temp.check((select cards_moved = 1 from public.apply_overdue_demotions(false, '2026-11-11')), '11-11: only b3_2days (due 11-08) moves');
select pg_temp.check(pg_temp.card('b3_2days') = '2 2026-11-15', 'b3_2days → box 2, due 11-15');
select pg_temp.check((select cards_moved = 1 from public.apply_overdue_demotions(false, '2026-11-13')), '11-13: only refl (due 11-10) moves');
select pg_temp.check(pg_temp.card('refl') = '0 2026-11-14', 'refl → box 0, due 11-14');
select pg_temp.check(pg_temp.card('b1_9days') = '0 2026-11-05', 'box 0 card still unchanged and due');

-- A card reviewed in time is never touched
insert into public.cards (user_id, id, type, box, next_review_date) values
  ('00000000-0000-0000-0000-000000000001', 'reviewed', 'vocab', 4, '2026-12-01');
select pg_temp.check((select cards_moved = 0 from public.apply_overdue_demotions(false, '2026-11-13')), 'nothing else due on 11-13');
select pg_temp.check(pg_temp.card('reviewed') = '4 2026-12-01', 'reviewed card untouched');

-- Access: users read only their own log and can only mark their own rows seen
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000003';
select pg_temp.check((select count(*) = 1 from public.overdue_demotions), 'u3 sees only own log row');
select public.mark_overdue_demotions_seen();
reset role;
select pg_temp.check((select count(*) = 1 from public.overdue_demotions where seen_at is not null), 'only u3''s row marked seen');

set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
do $$ begin
  insert into public.overdue_demotions (user_id, card_id, from_box, to_box, demoted_on)
  values ('00000000-0000-0000-0000-000000000001', 'x', 2, 1, '2026-11-10');
  raise exception 'FAILED: user could insert into the log';
exception when insufficient_privilege then raise notice 'ok: users cannot write the log';
end $$;
do $$ begin
  perform public.apply_overdue_demotions(true);
  raise exception 'FAILED: user could run apply_overdue_demotions';
exception when insufficient_privilege then raise notice 'ok: users cannot run the rule';
end $$;
do $$ begin
  perform public.leaderboard_ranks();
  raise exception 'FAILED: user could read leaderboard_ranks';
exception when insufficient_privilege then raise notice 'ok: users cannot read raw ranks';
end $$;
reset role;

-- Ranks (service role): visible, active users only, as on the leaderboard
set role service_role;
select pg_temp.check((select count(*) = 1 from public.leaderboard_ranks()), 'ranks: suspended and hidden users excluded');
select pg_temp.check((select rank = 1 and score = (select sum(box) from public.cards where user_id = '00000000-0000-0000-0000-000000000001') from public.leaderboard_ranks()), 'ranks: score = sum of boxes');
reset role;

-- Silver cards (review_day validation is switched off here to write past days)
alter table public.review_events disable trigger review_events_validate;
insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'c' || g, 'vocab', true, 1, 2, '2026-11-01' from generate_series(1, 16) g;   -- 16 correct → a card
insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'c' || g, 'vocab', true, 1, 2, '2026-11-02' from generate_series(1, 15) g;   -- only 15 …
insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'r' || g, 'reflection', true, 1, 2, '2026-11-02' from generate_series(1, 5) g; -- … reflections don't count
insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'w' || g, 'vocab', false, 2, 1, '2026-11-02' from generate_series(1, 9) g;     -- … nor wrong answers
insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'c' || g, 'vocab', true, 1, 2, '2026-10-30' from generate_series(1, 20) g;   -- before the start date

set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
select pg_temp.check((select total = 1 and today_correct = 16 and earned_today from public.get_silver_status('2026-11-01')), 'silver: 16 correct on 11-01 → 1 card, earned that day');
select pg_temp.check((select total = 1 and today_correct = 15 and not earned_today from public.get_silver_status('2026-11-02')), 'silver: 15 correct (+ reflections, wrong answers) → no card');
select pg_temp.check((select total = 1 and today_correct = 0 from public.get_silver_status('2026-11-05')), 'silver: quiet day');
select pg_temp.check((select silver = 1 from public.get_leaderboard('all', 100) where is_me), 'leaderboard shows the silver count');
set test.uid = '00000000-0000-0000-0000-000000000003';
select pg_temp.check((select total = 0 from public.get_silver_status('2026-11-01')), 'silver status is per user');
reset role;

insert into public.review_events (user_id, card_id, card_type, correct, from_box, to_box, review_day)
select '00000000-0000-0000-0000-000000000001', 'c' || g, 'vocab', true, 1, 2, date '2026-11-10' + d
from generate_series(1, 16) g, generate_series(0, 39) d;   -- 40 more good days
set role authenticated;
set test.uid = '00000000-0000-0000-0000-000000000001';
select pg_temp.check((select total = 30 from public.get_silver_status('2026-12-30')), 'silver: at most 30');
select pg_temp.check((select silver = 30 from public.get_leaderboard('all', 100) where is_me), 'leaderboard: at most 30');
select pg_temp.check((select count(*) >= 1 from public.get_leaderboard('week', 100)), 'leaderboard week tab still works');
reset role;
alter table public.review_events enable trigger review_events_validate;

-- Cron job registered once (file can run twice)
select pg_temp.check((select count(*) = 1 and min(schedule) = '35 20 * * *' from cron.job where jobname = 'daf-overdue-demotions'), 'cron job scheduled at 00:05 Tehran');
select pg_temp.check((select count(*) = 2 from information_schema.columns where table_name = 'push_state' and column_name in ('overtake_rank', 'last_overtake_at')), 'push_state columns added');

\echo ALL SQL TESTS PASSED
