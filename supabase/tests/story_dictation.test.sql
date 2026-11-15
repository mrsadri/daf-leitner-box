-- Tests for migrations/20261115_story_dictation.sql on a local PostgreSQL (see scripts/test-sql.sh).
-- Each check raises an exception when it fails.
\set ON_ERROR_STOP on

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000f1', 'a@test'),
  ('00000000-0000-0000-0000-0000000000f2', 'b@test'),
  ('00000000-0000-0000-0000-0000000000f3', 'd@test');
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000f3';

create function pg_temp.check(ok boolean, what text) returns void language plpgsql as $$
begin
  if not coalesce(ok, false) then raise exception 'FAILED: %', what; end if;
  raise notice 'ok: %', what;
end $$;
create function pg_temp.err(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return '';
exception when others then
  return sqlerrm;
end $$;
grant execute on function pg_temp.check(boolean, text) to authenticated, anon;
grant execute on function pg_temp.err(text) to authenticated, anon;

-- ---------------- rank function ----------------
select pg_temp.check(public.dictation_status_rank('heard') = 1 and public.dictation_status_rank('attempted') = 2
  and public.dictation_status_rank('moved') = 3 and public.dictation_status_rank('skipped') = 3
  and public.dictation_status_rank('correct') = 4 and public.dictation_status_rank('x') = 0, 'status ranks');

-- the flag exists and is on by default
select pg_temp.check((select value = 'false'::jsonb from public.app_flags where key = 'dictation_enabled'), 'dictation_enabled flag is seeded off');

set role authenticated;

-- ---------------- user a saves progress ----------------
set test.uid = '00000000-0000-0000-0000-0000000000f1';
select public.save_dictation_progress(
  '{"story_id":"story-01","finished_count":1,"total_count":352,"last_sentence_id":"s01q1n0001","content_version":"v1"}',
  '[{"story_id":"story-01","sentence_id":"s01q1n0001","sentence_order":1,"status":"correct","attempts":3,"mistakes":2,"skips":0,"listens":4,"leitner_actions":1,"content_hash":"h1","first_correct_at":"2026-11-15T10:00:00Z","last_attempt_at":"2026-11-15T10:00:00Z"},
    {"story_id":"story-01","sentence_id":"s01q1n0002","sentence_order":2,"status":"heard","listens":1}]');
select pg_temp.check((select count(*) = 2 from public.story_sentence_progress), 'a: two rows saved');
select pg_temp.check((select finished_count = 1 and total_count = 352 from public.story_progress where story_id = 'story-01'), 'a: story summary saved');

-- ---------------- RLS isolation ----------------
set test.uid = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.check((select count(*) = 0 from public.story_sentence_progress), 'b sees none of a''s sentence rows');
select pg_temp.check((select count(*) = 0 from public.story_progress), 'b sees none of a''s story rows');
select pg_temp.check(pg_temp.err($$insert into public.story_sentence_progress (user_id, story_id, sentence_id, sentence_order)
  values ('00000000-0000-0000-0000-0000000000f1', 'story-01', 'forged', 1)$$) like '%row-level security%', 'b cannot insert a row for a');
update public.story_sentence_progress set status = 'heard' where sentence_id = 's01q1n0001';
select pg_temp.check((select count(*) = 0 from public.story_sentence_progress), 'b: update of a''s row touches nothing');
-- b saves the same sentence id: it creates b's own row, a's row is untouched (primary key includes user_id)
select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0001","sentence_order":1,"status":"attempted","attempts":1}]');
select pg_temp.check((select count(*) = 1 and min(status) = 'attempted' from public.story_sentence_progress), 'b: own row for the same sentence id');

set test.uid = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select status = 'correct' and attempts = 3 from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'a: row unchanged by b');

-- ---------------- monotonic merge ----------------
select public.save_dictation_progress(null,
  '[{"story_id":"story-01","sentence_id":"s01q1n0001","sentence_order":1,"status":"attempted","attempts":2,"mistakes":5,"skips":0,"listens":9,"leitner_actions":0,"content_hash":"h2","first_correct_at":"2026-11-16T10:00:00Z","last_attempt_at":"2026-11-14T10:00:00Z"}]');
select pg_temp.check((select status = 'correct' from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'merge: status never goes down');
select pg_temp.check((select attempts = 3 and mistakes = 5 and listens = 9 and leitner_actions = 1 from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'merge: counters take the greater value');
select pg_temp.check((select first_correct_at = '2026-11-15T10:00:00Z' and last_attempt_at = '2026-11-15T10:00:00Z' from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'merge: first_correct_at earlier, last_attempt_at later');
select pg_temp.check((select content_hash = 'h2' from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'merge: content hash follows the latest write');
select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0002","sentence_order":2,"status":"skipped","skips":1}]');
select pg_temp.check((select status = 'skipped' and skips = 1 from public.story_sentence_progress where sentence_id = 's01q1n0002'), 'merge: heard moves up to skipped');
select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0002","sentence_order":2,"status":"moved"}]');
select pg_temp.check((select status = 'moved' from public.story_sentence_progress where sentence_id = 's01q1n0002'), 'merge: equal rank takes the incoming status');

-- ---------------- idempotent retry ----------------
create temp table snap as select * from public.story_sentence_progress where user_id = auth.uid();
grant all on snap to authenticated;
select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0001","sentence_order":1,"status":"correct","attempts":3,"mistakes":5,"skips":0,"listens":9,"leitner_actions":1,"content_hash":"h2","first_correct_at":"2026-11-15T10:00:00Z","last_attempt_at":"2026-11-15T10:00:00Z"}]');
select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0001","sentence_order":1,"status":"correct","attempts":3,"mistakes":5,"skips":0,"listens":9,"leitner_actions":1,"content_hash":"h2","first_correct_at":"2026-11-15T10:00:00Z","last_attempt_at":"2026-11-15T10:00:00Z"}]');
select pg_temp.check((select attempts = 3 and mistakes = 5 and listens = 9 from public.story_sentence_progress where sentence_id = 's01q1n0001'), 'retry of the same payload does not double count');

-- ---------------- story summary ----------------
select public.save_dictation_progress('{"story_id":"story-01","finished_count":0,"total_count":352,"content_version":"v1"}', null);
select pg_temp.check((select finished_count = 1 from public.story_progress where story_id = 'story-01'), 'summary: same content version, finished_count never goes down');
select public.save_dictation_progress('{"story_id":"story-01","finished_count":0,"total_count":353,"content_version":"v2"}', null);
select pg_temp.check((select finished_count = 0 and total_count = 353 and content_version = 'v2' from public.story_progress where story_id = 'story-01'), 'summary: a new content version takes the recomputed counts');
select public.save_dictation_progress('{"story_id":"story-01","finished_count":353,"total_count":353,"content_version":"v2"}', null);
select pg_temp.check((select completed_at is not null from public.story_progress where story_id = 'story-01'), 'summary: completed_at set when all sentences are finished');

-- ---------------- validation and limits ----------------
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[{"story_id":"s","sentence_id":"x","status":"bogus"}]')$$) like '%check%', 'invalid status rejected');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '{"a":1}')$$) like '%array%', 'non-array rejected');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null,
  (select jsonb_agg(jsonb_build_object('story_id','story-01','sentence_id','b'||g,'sentence_order',g,'status','heard')) from generate_series(1, 501) g))$$) like '%batch too large%', 'batch above 500 rows rejected');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null,
  (select jsonb_agg(jsonb_build_object('story_id','story-01','sentence_id','c'||g,'sentence_order',g,'status','heard')) from generate_series(1, 500) g))$$) = '', 'batch of 500 rows accepted');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"this-id-is-much-longer-than-forty-characters-for-sure","status":"heard"}]')$$) like '%check%', 'overlong sentence id rejected');

reset role;
-- fill a's rows up to the cap (as the superuser), then check the cap and that updates still work
insert into public.story_sentence_progress (user_id, story_id, sentence_id, sentence_order)
select '00000000-0000-0000-0000-0000000000f1', 'story-99', 'fill' || g, g from generate_series(1, 20000 - (select count(*) from public.story_sentence_progress where user_id = '00000000-0000-0000-0000-0000000000f1')::int) g;
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select count(*) = 20000 from public.story_sentence_progress), 'a is exactly at the cap');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"over-the-cap","status":"heard"}]')$$) like '%limit reached%', 'a new row above the cap is rejected');
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"s01q1n0002","sentence_order":2,"status":"correct"}]')$$) = '', 'an existing row can still be updated at the cap');
select pg_temp.check((select status = 'correct' from public.story_sentence_progress where sentence_id = 's01q1n0002'), 'the update at the cap took effect');

-- ---------------- suspended user ----------------
set test.uid = '00000000-0000-0000-0000-0000000000f3';
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[{"story_id":"story-01","sentence_id":"x1","status":"heard"}]')$$) like '%row-level security%', 'suspended user cannot write');
select pg_temp.check((select count(*) = 0 from public.story_sentence_progress), 'suspended user reads nothing');

-- ---------------- signed out ----------------
reset role;
set role anon;
set test.uid = '';
select pg_temp.check(pg_temp.err($$select public.save_dictation_progress(null, '[]')$$) like '%permission denied%', 'anon cannot call the save function');
select pg_temp.check(pg_temp.err($$select * from public.story_sentence_progress$$) like '%permission denied%', 'anon cannot read progress');
reset role;

-- ---------------- app_flags ----------------
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.check((select count(*) = 1 from public.app_flags where key = 'dictation_enabled'), 'authenticated can read the flag');
select pg_temp.check(pg_temp.err($$update public.app_flags set value = 'false'$$) like '%permission denied%', 'authenticated cannot change flags');
select pg_temp.check(pg_temp.err($$insert into public.app_flags (key) values ('x')$$) like '%permission denied%', 'authenticated cannot add flags');
reset role;
set role anon;
select pg_temp.check(pg_temp.err($$select * from public.app_flags$$) like '%permission denied%', 'anon cannot read flags');
reset role;

-- ---------------- dictation_events ----------------
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000f2';
insert into public.dictation_events (event, mode, sentence_id, detail, client) values ('audio_fallback', 'A', 's01q1n0001', 'A->B', 'chrome');
select pg_temp.check(pg_temp.err($$select * from public.dictation_events$$) like '%permission denied%', 'events cannot be read by users');
select pg_temp.check(pg_temp.err($$insert into public.dictation_events (event) values ('something_else')$$) like '%check%', 'unknown event rejected');
select pg_temp.check(pg_temp.err($$insert into public.dictation_events (user_id, event) values ('00000000-0000-0000-0000-0000000000f1', 'audio_failed')$$) like '%row-level security%', 'events cannot be written for another user');
reset role;
insert into public.dictation_events (user_id, event) select '00000000-0000-0000-0000-0000000000f2', 'audio_failed' from generate_series(1, 1999);
set role authenticated;
set test.uid = '00000000-0000-0000-0000-0000000000f2';
select pg_temp.check(pg_temp.err($$insert into public.dictation_events (event) values ('audio_failed')$$) like '%limit reached%', 'events capped at 2000 per user');
reset role;

-- ---------------- cascade ----------------
select pg_temp.check((select count(*) > 0 from public.story_sentence_progress where user_id = '00000000-0000-0000-0000-0000000000f1'), 'a has rows before deletion');
delete from auth.users where id = '00000000-0000-0000-0000-0000000000f1';
select pg_temp.check((select count(*) = 0 from public.story_sentence_progress where user_id = '00000000-0000-0000-0000-0000000000f1')
  and (select count(*) = 0 from public.story_progress where user_id = '00000000-0000-0000-0000-0000000000f1'), 'deleting the account removes its progress');
select pg_temp.check((select count(*) > 0 from public.story_sentence_progress where user_id = '00000000-0000-0000-0000-0000000000f2'), 'b''s rows survive');
select 'PASSED story_dictation';
