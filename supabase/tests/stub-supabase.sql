-- Minimal stand-ins for what Supabase provides, so the SQL can be tested on a plain local PostgreSQL.
-- Never run this on the real project.
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;  -- as in Supabase

create schema auth;
create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb not null default '{}');
-- The signed-in user comes from a setting: set test.uid = '<uuid>'
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;

create schema cron;
create table cron.job (jobid bigserial primary key, jobname text unique, schedule text, command text, active boolean default true);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as
  $$ insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command) returning jobid $$;
create function cron.unschedule(p_jobid bigint) returns boolean language sql as
  $$ delete from cron.job where jobid = p_jobid returning true $$;

grant usage on schema public, auth to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
