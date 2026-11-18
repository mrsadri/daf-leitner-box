\set ON_ERROR_STOP on
begin;
-- Reproduce the manually installed production schema's missing quota trigger/function.
drop trigger if exists cards_limit_per_user on public.cards;
drop function public.limit_cards_per_user();
\ir ../migrations/20261118055307_reliability_guards.sql
do $$ begin
 if not exists(select 1 from pg_trigger where tgname='cards_limit_per_user' and tgrelid='public.cards'::regclass) then raise exception 'FAILED: missing production quota trigger not repaired'; end if;
 if has_schema_privilege('authenticated','release_backup_20261118_pr32','USAGE') or has_schema_privilege('anon','release_backup_20261118_pr32','USAGE') then raise exception 'FAILED: private backup schema exposed'; end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='release_backup_20261118_pr32' and c.relkind='r' and not c.relrowsecurity) then raise exception 'FAILED: backup table lacks RLS'; end if;
 if has_function_privilege('anon','public.handle_new_user()','EXECUTE') then raise exception 'FAILED: internal auth trigger publicly executable'; end if;
 raise notice 'ok: production trigger drift repaired and recovery snapshot is private';
end $$;
rollback;
