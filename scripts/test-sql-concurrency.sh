#!/usr/bin/env bash
# Only called against the disposable cluster created by test-sql.sh.
set -euo pipefail
PG="$1"
PORT="$2"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
run() { "$PG/psql" -h 127.0.0.1 -p "$PORT" -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run <<'SQL'
insert into auth.users(id,email) values ('90000000-0000-0000-0000-000000000001','concurrency@test');
update public.user_sync_state set revision=0 where user_id='90000000-0000-0000-0000-000000000001';
SQL
# Both operations expect revision zero. Holding the first transaction open forces the second to wait.
run > "$TMP/first" <<'SQL' &
begin;
set local role authenticated;
select set_config('test.uid','90000000-0000-0000-0000-000000000001',true);
select public.apply_sync_batch('90000000-0000-0000-0000-000000000002',0,'[]','[]','[]','{"soundEnabled":false}');
select pg_sleep(1);
commit;
SQL
FIRST=$!
run > "$TMP/second" <<'SQL' &
begin;
set local role authenticated;
select set_config('test.uid','90000000-0000-0000-0000-000000000001',true);
select public.apply_sync_batch('90000000-0000-0000-0000-000000000003',0,'[]','[]','[]','{"soundEnabled":true}');
commit;
SQL
SECOND=$!
wait "$FIRST"
wait "$SECOND"
run <<'SQL'
do $$ begin
 if (select count(*) from public.sync_receipts where user_id='90000000-0000-0000-0000-000000000001')<>1 then raise exception 'FAILED: concurrent revision accepted twice'; end if;
 if (select revision from public.user_sync_state where user_id='90000000-0000-0000-0000-000000000001')<>1 then raise exception 'FAILED: unexpected concurrent revision'; end if;
 raise notice 'ok: two native PostgreSQL connections serialize revisions; exactly one batch commits';
end $$;
SQL
# Fill a second synthetic account to one below quota, then race two new IDs.
run <<'SQL'
insert into auth.users(id,email) values ('90000000-0000-0000-0000-000000000010','quota-concurrency@test');
alter table public.cards disable trigger cards_limit_per_user;
alter table public.cards disable trigger cards_sync_revision;
insert into public.cards(user_id,id,type,box,next_review_date,data)
select '90000000-0000-0000-0000-000000000010','quota-'||n,'vocab',0,current_date,'{}' from generate_series(1,9999) n;
alter table public.cards enable trigger cards_limit_per_user;
alter table public.cards enable trigger cards_sync_revision;
SQL
quota_insert() {
run <<SQL
begin;
set local role authenticated;
select set_config('test.uid','90000000-0000-0000-0000-000000000010',true);
insert into public.cards(user_id,id,type,box,next_review_date,data) values(auth.uid(),'race-$1','vocab',0,current_date,'{}');
select pg_sleep(0.3);
commit;
SQL
}
quota_insert one > "$TMP/quota-one" 2>&1 &
ONE=$!
quota_insert two > "$TMP/quota-two" 2>&1 &
TWO=$!
ONE_STATUS=0; TWO_STATUS=0
wait "$ONE" || ONE_STATUS=$?
wait "$TWO" || TWO_STATUS=$?
if [[ "$ONE_STATUS" -eq "$TWO_STATUS" ]]; then cat "$TMP/quota-one" "$TMP/quota-two"; exit 1; fi
if ! grep -q 'card limit reached' "$TMP/quota-one" "$TMP/quota-two"; then exit 1; fi
run <<'SQL'
do $$ begin
 if (select count(*) from public.cards where user_id='90000000-0000-0000-0000-000000000010')<>10000 then raise exception 'FAILED: concurrent card quota'; end if;
 raise notice 'ok: two native connections cannot exceed the 10000-card quota';
end $$;
SQL
story_update() {
run <<SQL
begin;
set local role authenticated;
select set_config('test.uid','90000000-0000-0000-0000-000000000001',true);
insert into public.story_progress(user_id,story_id,finished_count,total_count,completed_at)
values(auth.uid(),'S01-Q1',$1,5,$2)
on conflict(user_id,story_id) do update set finished_count=excluded.finished_count,total_count=excluded.total_count,completed_at=excluded.completed_at;
select pg_sleep(0.2);
commit;
SQL
}
for order in high-first low-first; do
 run -c "delete from public.story_progress where user_id='90000000-0000-0000-0000-000000000001'"
 if [[ "$order" == high-first ]]; then
  story_update 5 'now()' > "$TMP/story-one" &
  STORY_ONE=$!
  story_update 2 'null' > "$TMP/story-two" &
 else
  story_update 2 'null' > "$TMP/story-one" &
  STORY_ONE=$!
  story_update 5 'now()' > "$TMP/story-two" &
 fi
 STORY_TWO=$!
 wait "$STORY_ONE"; wait "$STORY_TWO"
 run <<'SQL'
do $$ begin
 if not exists(select 1 from public.story_progress where user_id='90000000-0000-0000-0000-000000000001' and finished_count=5 and completed_at is not null) then raise exception 'FAILED: concurrent story merge regressed'; end if;
 raise notice 'ok: concurrent story upserts preserve highest page and completion';
end $$;
SQL
done
run <<'SQL'
begin;
set local role authenticated;
select set_config('test.uid','90000000-0000-0000-0000-000000000010',true);
do $$ declare result jsonb; begin
 result:=public.apply_sync_batch('90000000-0000-0000-0000-000000000011',public.get_sync_revision(),
 '[{"id":"replacement","type":"vocab","box":0,"next_review_date":"2026-11-18","review_count":0,"correct_count":0,"wrong_count":0,"data":{}}]',
 '["quota-1"]','[]',null);
 if (result->>'conflict')::boolean or (select count(*) from public.cards)<>10000 then raise exception 'FAILED: quota replacement batch'; end if;
 raise notice 'ok: atomic deletion plus insertion succeeds at quota';
end $$;
commit;
SQL
