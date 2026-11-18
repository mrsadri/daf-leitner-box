\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('50000000-0000-0000-0000-000000000001','sync-a@test'),('50000000-0000-0000-0000-000000000002','sync-b@test');
set local role authenticated;
select set_config('test.uid','50000000-0000-0000-0000-000000000001',true);
do $$
declare rev bigint; result jsonb; again jsonb; card jsonb; event jsonb;
begin
 rev:=public.get_sync_revision();
 begin
  perform public.apply_sync_batch('50000000-0000-0000-0000-000000000020',rev,'[]','[]','[]',null,'50000000-0000-0000-0000-000000000002');
  raise exception 'FAILED: stale account transport accepted';
 exception when insufficient_privilege then null; end;
 if public.get_sync_revision()<>rev then raise exception 'FAILED: wrong-account request changed revision'; end if;
 card:=jsonb_build_object('id','daf_01_64','type','vocab','box',1,'next_review_date',current_date+2,'last_reviewed_at',now(),
  'review_count',1,'correct_count',1,'wrong_count',0,'data','{}'::jsonb,'created_at',now());
 event:=jsonb_build_object('operationId','50000000-0000-0000-0000-000000000003','cardId','daf_01_64','cardType','vocab','correct',true,'fromBox',0,'toBox',1,'reviewDay',current_date);
 result:=public.apply_sync_batch('50000000-0000-0000-0000-000000000004',rev,jsonb_build_array(card),'[]',jsonb_build_array(event),'{"soundEnabled":false}');
 if (result->>'conflict')::boolean then raise exception 'FAILED: fresh batch conflicted'; end if;
 again:=public.apply_sync_batch('50000000-0000-0000-0000-000000000004',rev,jsonb_build_array(card),'[]',jsonb_build_array(event),'{"soundEnabled":false}');
 if result<>again then raise exception 'FAILED: committed receipt changed on retry'; end if;
 if (select count(*) from public.review_events where user_id=auth.uid())<>1 then raise exception 'FAILED: duplicate event'; end if;
 if (select box from public.cards where user_id=auth.uid() and id='daf_01_64')<>1 then raise exception 'FAILED: card not committed'; end if;
 if not exists(select 1 from public.get_verified_leaderboard('all',100) where is_me and score=1 and score_7d=1) then raise exception 'FAILED: validated leaderboard score'; end if;
 again:=public.apply_sync_batch('50000000-0000-0000-0000-000000000005',rev,'[]','[]','[]',null);
 if not (again->>'conflict')::boolean then raise exception 'FAILED: stale revision accepted'; end if;
 rev:=(result->>'revision')::bigint;
 begin
  perform public.apply_sync_batch('50000000-0000-0000-0000-000000000006',rev,jsonb_build_array(card||'{"review_count":-1}'::jsonb),'[]',
    jsonb_build_array(event||'{"operationId":"50000000-0000-0000-0000-000000000007","reviewDay":"2020-01-01"}'::jsonb),null);
  raise exception 'FAILED: invalid card accepted';
 exception when check_violation then null; end;
 if public.get_sync_revision()<>rev then raise exception 'FAILED: rejected transaction advanced revision'; end if;
 if exists(select 1 from public.personal_review_history where operation_id='50000000-0000-0000-0000-000000000007') then raise exception 'FAILED: partial event leaked from rollback'; end if;
 -- A mixed batch keeps expired/impossible events personally, without losing a valid event.
 card:=card||'{"id":"daf_01_1","box":1}'::jsonb;
 result:=public.apply_sync_batch('50000000-0000-0000-0000-000000000008',rev,
  jsonb_build_array(card), '[]', jsonb_build_array(
   event||'{"operationId":"50000000-0000-0000-0000-000000000009","cardId":"old-offline","reviewDay":"2020-01-01"}'::jsonb,
   event||'{"operationId":"50000000-0000-0000-0000-000000000010","cardId":"impossible","toBox":6}'::jsonb,
   event||'{"operationId":"50000000-0000-0000-0000-000000000011","cardId":"daf_01_1"}'::jsonb),null);
 if jsonb_array_length(result->'personal')<>2 then raise exception 'FAILED: mixed batch personal outcomes'; end if;
 if (select count(*) from public.review_events where user_id=auth.uid() and verified)<>2 then raise exception 'FAILED: mixed valid review lost or impossible transition credited'; end if;
 begin
  perform public.apply_sync_batch('50000000-0000-0000-0000-000000000012',(result->>'revision')::bigint,'[]','[]','[]','{"speechRate":"invalid"}');
  raise exception 'FAILED: invalid server settings accepted';
 exception when invalid_parameter_value then null; end;
 raise notice 'ok: card + event + settings commit together, receipt retry deduplicates, stale revision conflicts, failed batch rolls back';
end $$;
reset role;
do $$ begin
 if (select points from public.verified_card_points where user_id='50000000-0000-0000-0000-000000000001' and card_id='daf_01_64')<>1 then raise exception 'FAILED: validated review not credited'; end if;
end $$;
set local role authenticated;
select set_config('test.uid','50000000-0000-0000-0000-000000000002',true);
do $$ begin
 if exists(select 1 from public.personal_review_history) then raise exception 'FAILED: another user sees personal history'; end if;
 begin
  update public.review_events set verified=true;
  raise exception 'FAILED: client may set verification flag';
 exception when insufficient_privilege then null; end;
 if not exists(select 1 from public.get_verified_leaderboard('all',100) where is_me and score=0) then raise exception 'FAILED: unverified user score'; end if;
 raise notice 'ok: personal history isolated and verification flags cannot be asserted by clients';
end $$;
reset role;
rollback;
