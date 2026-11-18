\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('80000000-0000-0000-0000-000000000001','delivery-a@test'),('80000000-0000-0000-0000-000000000002','delivery-b@test');
insert into public.push_subscriptions(user_id,endpoint,p256dh,auth)
values('80000000-0000-0000-0000-000000000001','https://fcm.googleapis.com/fcm/send/disposable-fixture','key','auth');
do $$ declare sid bigint; r jsonb;
begin
 select id into sid from public.push_subscriptions where endpoint='https://fcm.googleapis.com/fcm/send/disposable-fixture';
 r:=public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','sent');
 if r->>'state'<>'claimed' then raise exception 'FAILED: initial claim'; end if;
 perform public.finish_push_delivery(sid,'sent',1,'sent',201);
 if public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','sent')->>'state'<>'sent' then raise exception 'FAILED: sent device would be retried'; end if;
 r:=public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','crash');
 update public.push_delivery_attempts set lease_until=clock_timestamp()-interval '1 second' where subscription_id=sid and delivery_key='crash';
 if public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','crash')->>'state'<>'unknown' then raise exception 'FAILED: crashed send repeated'; end if;
 r:=public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','failure');
 perform public.finish_push_delivery(sid,'failure',1,'failed',503);
 r:=public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','failure');
 if (r->>'attempt')::integer<>2 then raise exception 'FAILED: bounded retry missing'; end if;
 perform public.finish_push_delivery(sid,'failure',1,'sent',201);
 if (select state from public.push_delivery_attempts where subscription_id=sid and delivery_key='failure')<>'sending' then raise exception 'FAILED: stale worker overwrote newer attempt'; end if;
 perform public.finish_push_delivery(sid,'failure',2,'failed',503);
 r:=public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','failure');
 perform public.finish_push_delivery(sid,'failure',3,'failed',503);
 if public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','failure')->>'state'<>'exhausted' then raise exception 'FAILED: retry budget not enforced'; end if;
 update public.push_subscriptions set user_id='80000000-0000-0000-0000-000000000002' where id=sid;
 if public.claim_push_delivery(sid,'80000000-0000-0000-0000-000000000001','old-account')->>'state'<>'gone' then raise exception 'FAILED: old owner may notify new account device'; end if;
 raise notice 'ok: per-device deduplication, uncertain-send terminal state, bounded retries, stale-worker guard and subscription ownership';
end $$;
set local role authenticated;
do $$ begin
 begin
  perform public.claim_push_delivery(1,'80000000-0000-0000-0000-000000000001','forged');
  raise exception 'FAILED: client can claim delivery';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
