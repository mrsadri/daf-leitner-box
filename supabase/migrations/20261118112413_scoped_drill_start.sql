-- Preserve the legacy endpoint while preventing new clients from starting a contest under a changed account.
create or replace function public.start_scoped_adjective_run(p_expected_user uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
begin
 if auth.uid() is null or p_expected_user is distinct from auth.uid() then
  raise exception 'session account changed' using errcode='42501';
 end if;
 return public.start_verified_adjective_run();
end $$;
revoke all on function public.start_scoped_adjective_run(uuid) from public,anon;
grant execute on function public.start_scoped_adjective_run(uuid) to authenticated;
