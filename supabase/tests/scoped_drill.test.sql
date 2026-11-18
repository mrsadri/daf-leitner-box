\set ON_ERROR_STOP on
begin;
insert into auth.users(id,email) values('85000000-0000-0000-0000-000000000001','scope-a@example.test'),('85000000-0000-0000-0000-000000000002','scope-b@example.test');
set local role authenticated;
select set_config('test.uid','85000000-0000-0000-0000-000000000001',true);
do $$ declare challenge jsonb; begin
 begin
  perform public.start_scoped_adjective_run('85000000-0000-0000-0000-000000000002');
  raise exception 'FAILED: mismatched account started a drill';
 exception when insufficient_privilege then null; end;
 if exists(select 1 from public.adjective_drill_runs where user_id=auth.uid()) then raise exception 'FAILED: refused startup consumed a run'; end if;
 challenge:=public.start_scoped_adjective_run(auth.uid());
 if jsonb_array_length(challenge->'questions')<>150 then raise exception 'FAILED: scoped startup lost issued questions'; end if;
 if not exists(select 1 from public.adjective_drill_runs where id=(challenge->>'id')::uuid and user_id=auth.uid()) then raise exception 'FAILED: wrong run owner'; end if;
 raise notice 'ok: expected account is checked before creating a drill or consuming quota';
end $$;
reset role;
set local role anon;
do $$ begin
 begin
  perform public.start_scoped_adjective_run('85000000-0000-0000-0000-000000000001');
  raise exception 'FAILED: anonymous scoped startup';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
