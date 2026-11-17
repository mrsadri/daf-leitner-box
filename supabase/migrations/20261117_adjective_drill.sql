-- =====================================================================
-- Adjective declension contest (docs/adjective-drill/plan-checklist.md)
--   * adjective_drill_runs: one row per run, own rows only. No direct insert or update: writes go only
--     through start_adjective_run() and finish_adjective_run(), both SECURITY DEFINER.
--   * get_adjective_board() / get_my_adjective_bests(): the «صفت‌ها» records tab, modelled on
--     get_leaderboard(). This score is entirely separate from the Leitner score.
--   * app_flags: a remote kill switch ('adjective_drill_enabled'), seeded on.
-- Additive only: one new table, four new functions. Nothing existing is altered.
-- Safe to run twice. Account deletion: adjective_drill_runs.user_id cascades with auth.users, so
-- admin_delete_user() already removes a deleted user's runs; there is no separate self-delete path yet.
-- =====================================================================

create table if not exists public.adjective_drill_runs (
  id          uuid not null default gen_random_uuid() primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  score       integer not null default 0 check (score >= 0),
  answered    integer not null default 0 check (answered >= 0),
  started_at  timestamptz not null default now(),
  finished_at timestamptz,
  client      text check (char_length(client) <= 60),
  check (score <= answered),
  check (answered <= 150)
);

create index if not exists adjective_drill_runs_user_finished_idx on public.adjective_drill_runs (user_id, finished_at);
create index if not exists adjective_drill_runs_finished_idx on public.adjective_drill_runs (finished_at);

alter table public.adjective_drill_runs enable row level security;

drop policy if exists "adjective_drill_runs: select own" on public.adjective_drill_runs;
create policy "adjective_drill_runs: select own" on public.adjective_drill_runs
  for select using (auth.uid() = user_id and (select public.is_active_user()));
-- no insert/update/delete policy: all writes go through the SECURITY DEFINER functions below

revoke all on public.adjective_drill_runs from anon, authenticated;
grant select on public.adjective_drill_runs to authenticated;

-- Seeded ON: the drill ships enabled. The owner can flip it off with one SQL statement, without a deploy.
insert into public.app_flags (key, value) values ('adjective_drill_enabled', 'true'::jsonb) on conflict (key) do nothing;

-- ---------------------------------------------------------------------
-- start_adjective_run(): refuses suspended users and more than 30 starts per UTC day.
-- ---------------------------------------------------------------------
create or replace function public.start_adjective_run()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  if not public.is_active_user() then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  if (select count(*) from public.adjective_drill_runs r
      where r.user_id = auth.uid()
        and r.started_at >= date_trunc('day', now() at time zone 'utc')
        and r.started_at <  date_trunc('day', now() at time zone 'utc') + interval '1 day') >= 30 then
    raise exception 'daily start limit reached' using errcode = '54000';
  end if;
  insert into public.adjective_drill_runs (user_id) values (auth.uid()) returning id into v_id;
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------
-- finish_adjective_run(): refuses suspended users; accepted only for the caller's own, not-yet-finished run, at least 295s
-- after it started and within 24h of starting. A repeated call with the same score/answered that was
-- already recorded returns success instead of raising, so sending the result twice is harmless.
-- ---------------------------------------------------------------------
create or replace function public.finish_adjective_run(p_id uuid, p_score integer, p_answered integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  if not public.is_active_user() then
    raise exception 'account suspended' using errcode = '42501';
  end if;
  -- locked, so two finishes of the same run at the same moment can't both pass the checks below
  select * into r from public.adjective_drill_runs where id = p_id and user_id = auth.uid() for update;
  if not found then
    raise exception 'run not found' using errcode = '42501';
  end if;
  if r.finished_at is not null then
    if r.score = p_score and r.answered = p_answered then
      return;
    end if;
    raise exception 'run already finished with a different result';
  end if;
  if p_score < 0 or p_answered < p_score or p_answered > 150 then
    raise exception 'score out of range';
  end if;
  if now() - r.started_at < interval '295 seconds' then
    raise exception 'finished too early';
  end if;
  if now() - r.started_at > interval '24 hours' then
    raise exception 'too late to finish this run';
  end if;
  update public.adjective_drill_runs
     set score = p_score, answered = p_answered, finished_at = now()
   where id = p_id;
end;
$$;

-- ---------------------------------------------------------------------
-- get_adjective_board(): only finished runs; week = finished in the last 7 days. Per person: best score,
-- the three highest individual scores (top3, descending), and the finished_at of their best run
-- (best_at, earliest on a tie). Ranked by best desc, ties broken by the earlier best_at, as on
-- get_leaderboard(). A hidden caller still sees their own row and where they would rank.
-- ---------------------------------------------------------------------
drop function if exists public.get_adjective_board(text, integer);
create function public.get_adjective_board(p_period text default 'all', p_limit integer default 100)
returns table (
  user_id      uuid,
  display_name text,
  avatar_url   text,
  best         integer,
  top3         integer[],
  best_at      timestamptz,
  rank         bigint,
  is_me        boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with scoped as (
    select r.user_id, r.score, r.finished_at
    from public.adjective_drill_runs r
    where r.finished_at is not null
      and (p_period <> 'week' or r.finished_at >= now() - interval '7 days')
  ),
  per_user as (
    select s.user_id, max(s.score) as best
    from scoped s
    group by s.user_id
  ),
  best_runs as (
    select pu.user_id, min(s.finished_at) as best_at
    from per_user pu
    join scoped s on s.user_id = pu.user_id and s.score = pu.best
    group by pu.user_id
  ),
  top3s as (
    select x.user_id, array_agg(x.score order by x.score desc) as top3
    from (
      select s.user_id, s.score, row_number() over (partition by s.user_id order by s.score desc) as rn
      from scoped s
    ) x
    where x.rn <= 3
    group by x.user_id
  ),
  board as (
    select p.id                        as user_id,
           p.display_name,
           p.avatar_url,
           pu.best                     as best,
           t.top3                      as top3,
           br.best_at                  as best_at,
           (p.id = auth.uid())         as is_me,
           p.show_on_leaderboard       as visible
    from public.profiles p
    join per_user pu   on pu.user_id = p.id
    join best_runs br   on br.user_id = p.id
    join top3s t         on t.user_id = p.id
    where p.suspended_at is null
      and (p.show_on_leaderboard or p.id = auth.uid())
  ),
  ranked as (
    select b.*, rank() over (order by b.best desc, b.best_at asc) as rank
    from board b
    where b.visible
    union all
    select b.*, 1 + (
      select count(*) from board v
      where v.visible and (v.best > b.best or (v.best = b.best and v.best_at < b.best_at))
    ) as rank
    from board b
    where not b.visible
  )
  select r.user_id, r.display_name, r.avatar_url, r.best, r.top3, r.best_at, r.rank, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(p_limit, 500)) or r.is_me
  order by r.rank, r.is_me desc, r.display_name;
$$;

-- ---------------------------------------------------------------------
-- get_my_adjective_bests(): the caller's own best-ever and best-this-week, independent of any period
-- the board is currently showing (and of whether they are visible to others).
-- ---------------------------------------------------------------------
create or replace function public.get_my_adjective_bests()
returns table (best_all integer, best_week integer)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select max(score) from public.adjective_drill_runs where user_id = auth.uid() and finished_at is not null),
    (select max(score) from public.adjective_drill_runs where user_id = auth.uid() and finished_at is not null
       and finished_at >= now() - interval '7 days');
$$;

revoke all on function public.start_adjective_run() from public, anon;
revoke all on function public.finish_adjective_run(uuid, integer, integer) from public, anon;
revoke all on function public.get_adjective_board(text, integer) from public, anon;
revoke all on function public.get_my_adjective_bests() from public, anon;
grant execute on function public.start_adjective_run() to authenticated;
grant execute on function public.finish_adjective_run(uuid, integer, integer) to authenticated;
grant execute on function public.get_adjective_board(text, integer) to authenticated;
grant execute on function public.get_my_adjective_bests() to authenticated;
