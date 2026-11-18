-- Real SET ROLE checks against disposable fixtures. Never run against production.
\set ON_ERROR_STOP on
begin;
insert into auth.users (id, email) values
 ('10000000-0000-0000-0000-000000000001', 'owner-a@test'),
 ('10000000-0000-0000-0000-000000000002', 'owner-b@test');
insert into public.cards (user_id,id,type,box,next_review_date) values
 ('10000000-0000-0000-0000-000000000001','auth-check-a','vocab',0,current_date),
 ('10000000-0000-0000-0000-000000000002','auth-check-b','vocab',0,current_date);

set local role anon;
select set_config('test.uid', '', true);
do $$ begin
 begin
  if exists(select 1 from public.cards) then raise exception 'FAILED: anonymous card read'; end if;
 exception when insufficient_privilege then null; end;
 begin
  insert into public.cards (user_id,id,type,box,next_review_date)
  values ('10000000-0000-0000-0000-000000000001','anonymous-write','vocab',0,current_date);
  raise exception 'FAILED: anonymous card write';
 exception when insufficient_privilege then null; end;
 begin
  perform public.admin_list_users();
  raise exception 'FAILED: anonymous admin RPC';
 exception when insufficient_privilege then null; end;
 raise notice 'ok: anonymous users cannot read cards, write cards, or call admin RPC';
end $$;
reset role;

set local role authenticated;
select set_config('test.uid', '10000000-0000-0000-0000-000000000001', true);
do $$ declare affected integer; begin
 if (select count(*) from public.cards) <> 1 then raise exception 'FAILED: owner card visibility'; end if;
 update public.cards set box=1 where id='auth-check-a';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'FAILED: own update denied'; end if;
 update public.cards set box=2 where id='auth-check-b';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'FAILED: cross-user update'; end if;
 delete from public.cards where id='auth-check-b';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'FAILED: cross-user delete'; end if;
 begin
  insert into public.cards (user_id,id,type,box,next_review_date)
  values ('10000000-0000-0000-0000-000000000002','cross-user-write','vocab',0,current_date);
  raise exception 'FAILED: cross-user insert';
 exception when insufficient_privilege then null; end;
 begin
  update public.cards set user_id='10000000-0000-0000-0000-000000000002' where id='auth-check-a';
  raise exception 'FAILED: reassigned card ownership';
 exception when insufficient_privilege then null; end;
 begin
  update public.profiles set suspended_at=null where id=auth.uid();
  raise exception 'FAILED: protected profile column writable';
 exception when insufficient_privilege then null; end;
 begin
  perform public.admin_list_users();
  raise exception 'FAILED: ordinary user admin RPC';
 exception when insufficient_privilege then null; end;
 raise notice 'ok: owner writes work; cross-owner writes and protected/admin operations are denied';
end $$;
reset role;

update public.profiles set suspended_at=now() where id='10000000-0000-0000-0000-000000000001';
set local role authenticated;
select set_config('test.uid', '10000000-0000-0000-0000-000000000001', true);
do $$ begin
 if exists(select 1 from public.cards) then raise exception 'FAILED: suspended card visibility'; end if;
 begin
  insert into public.cards (id,type,box,next_review_date) values ('suspended-write','vocab',0,current_date);
  raise exception 'FAILED: suspended card insert';
 exception when insufficient_privilege then null; end;
 raise notice 'ok: suspended account cannot read or insert cards';
end $$;
reset role;
insert into public.app_admins (user_id) values ('10000000-0000-0000-0000-000000000002');
set local role authenticated;
select set_config('test.uid', '10000000-0000-0000-0000-000000000002', true);
do $$ begin
 if not public.is_admin() then raise exception 'FAILED: administrator not recognized'; end if;
 if not exists(select 1 from public.admin_list_users() where user_id='10000000-0000-0000-0000-000000000001') then
  raise exception 'FAILED: authorized administrator cannot list users';
 end if;
 raise notice 'ok: explicitly authorized administrator can list users';
end $$;
reset role;
rollback;
