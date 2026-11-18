\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values ('40000000-0000-0000-0000-000000000001','reminder@test');
set local role authenticated;
do $$ begin
 begin
  perform public.claim_reminder_user('40000000-0000-0000-0000-000000000001');
  raise exception 'FAILED: ordinary user claimed worker lease';
 exception when insufficient_privilege then null; end;
 raise notice 'ok: reminder lease is not callable by users';
end $$;
reset role;
set local role service_role;
do $$ begin
 if not public.claim_reminder_user('40000000-0000-0000-0000-000000000001') then raise exception 'FAILED: initial lease claim denied'; end if;
 if public.claim_reminder_user('40000000-0000-0000-0000-000000000001') then raise exception 'FAILED: duplicate lease claim'; end if;
 raise notice 'ok: only one reminder worker may hold a user lease';
end $$;
update public.push_delivery_leases set expires_at=now()-interval '1 second';
do $$ begin
 if not public.claim_reminder_user('40000000-0000-0000-0000-000000000001') then raise exception 'FAILED: expired lease not reclaimed'; end if;
 raise notice 'ok: expired reminder lease may be reclaimed';
end $$;
reset role;
rollback;
