-- =====================================================================
-- 1. Overdue rule: a card that is not reviewed within 3 days of its due date moves to the start of
--    the previous box (box 3 → box 2, next review 4 days later). Runs every night on the server.
-- 2. Leaderboard "someone passed you" notification: ranks for the sending function, per-user baseline.
-- 3. Silver cards: status for the app and a "silver" column on the leaderboard.
--
-- Additive: one new table, new functions, two new columns, one cron job; get_leaderboard gets one more column. Running this file changes no
-- card; cards change only when public.apply_overdue_demotions() runs (the cron job, or by hand).
-- Safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1a. Log of moves, read by the app to explain them once (popup)
-- ---------------------------------------------------------------------
create table if not exists public.overdue_demotions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  card_id     text not null check (char_length(card_id) <= 200),
  from_box    smallint not null check (from_box between 1 and 5),
  to_box      smallint not null check (to_box between 0 and 4),
  demoted_on  date not null,
  seen_at     timestamptz,
  created_at  timestamptz not null default now()
);

create index if not exists overdue_demotions_unseen_idx on public.overdue_demotions (user_id) where seen_at is null;

alter table public.overdue_demotions enable row level security;

drop policy if exists "overdue_demotions: read own" on public.overdue_demotions;
create policy "overdue_demotions: read own" on public.overdue_demotions
  for select using (auth.uid() = user_id);
-- No insert / update / delete policies: written by apply_overdue_demotions, marked seen by the function below.

-- ---------------------------------------------------------------------
-- 1b. The rule
--   A card in box b (1–5) due on day D that is still unreviewed on day D+3 moves to box b-1, due on
--   (D+3) + 2^(b-1) days. Long absences repeat this (box 5 due 40 days ago ends in box 1). The result
--   depends only on box, due date and today, so running it again the same day changes nothing.
--   Box 0 cards stay due; the archive (box 6) has no due date. Suspended accounts are left alone.
--   A card is written only if its box and due date are still what this run read, so a review saved
--   in the meantime is never overwritten. No review events are written: weekly score and streaks are
--   unaffected; the all-time score (sum of boxes) drops with the cards.
--   "Today" is the date in Tehran (the class's time zone).
-- ---------------------------------------------------------------------
create or replace function public.apply_overdue_demotions(p_dry_run boolean default false, p_today date default null)
returns table (users_affected bigint, cards_moved bigint, moves jsonb)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_today date := coalesce(p_today, (now() at time zone 'Asia/Tehran')::date);
  v_changed integer;
begin
  create temp table if not exists _overdue_work (
    user_id uuid, id text, orig_box smallint, orig_due date, box smallint, due date
  ) on commit drop;
  truncate _overdue_work;

  insert into _overdue_work (user_id, id, orig_box, orig_due, box, due)
  select c.user_id, c.id, c.box, c.next_review_date, c.box, c.next_review_date
    from public.cards c
    join public.profiles p on p.id = c.user_id and p.suspended_at is null
   where c.box between 1 and 5
     and c.next_review_date + 3 <= v_today;

  -- At most five rounds: every round lowers the box of the cards it touches
  loop
    update _overdue_work w
       set box = w.box - 1,
           due = w.due + 3 + (1 << (w.box - 1))
     where w.box between 1 and 5
       and w.due + 3 <= v_today;
    get diagnostics v_changed = row_count;
    exit when v_changed = 0;
  end loop;

  if not p_dry_run then
    with moved as (
      update public.cards c
         set box = w.box,
             next_review_date = w.due,
             updated_at = now()
        from _overdue_work w
       where c.user_id = w.user_id
         and c.id = w.id
         and c.box = w.orig_box
         and c.next_review_date = w.orig_due
      returning c.user_id, c.id, w.orig_box, w.box
    )
    insert into public.overdue_demotions (user_id, card_id, from_box, to_box, demoted_on)
    select m.user_id, m.id, m.orig_box, m.box, v_today from moved m;

    -- Housekeeping: explained moves after 60 days, never-seen ones after a year
    delete from public.overdue_demotions
     where (seen_at is not null and seen_at < now() - interval '60 days')
        or created_at < now() - interval '365 days';
  end if;

  return query
    select count(distinct w.user_id)::bigint,
           count(*)::bigint,
           coalesce((select jsonb_object_agg(k, n) from (
              select w2.orig_box || '→' || w2.box as k, count(*) as n
                from _overdue_work w2 group by w2.orig_box, w2.box
           ) agg), '{}'::jsonb)
      from _overdue_work w;
end;
$$;

revoke all on function public.apply_overdue_demotions(boolean, date) from public, anon, authenticated;

-- The app marks the explained moves as seen (only the caller's own rows)
create or replace function public.mark_overdue_demotions_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.overdue_demotions set seen_at = now() where user_id = auth.uid() and seen_at is null;
$$;

revoke all on function public.mark_overdue_demotions_seen() from public, anon;
grant execute on function public.mark_overdue_demotions_seen() to authenticated;

-- ---------------------------------------------------------------------
-- 2. Leaderboard ranks for the send-reminders function (all-time table, as in get_leaderboard)
-- ---------------------------------------------------------------------
create or replace function public.leaderboard_ranks()
returns table (user_id uuid, score bigint, rank bigint)
language sql
stable
security definer
set search_path = public
as $$
  with s as (
    select p.id as user_id, coalesce(sum(c.box), 0)::bigint as score
      from public.profiles p
      left join public.cards c on c.user_id = p.id
     where p.suspended_at is null and p.show_on_leaderboard
     group by p.id
  )
  select s.user_id, s.score, rank() over (order by s.score desc) from s;
$$;

revoke all on function public.leaderboard_ranks() from public, anon, authenticated;
grant execute on function public.leaderboard_ranks() to service_role;

-- Per-user baseline for "someone passed you": the rank last notified about (or the best rank since)
alter table public.push_state add column if not exists overtake_rank integer;
alter table public.push_state add column if not exists last_overtake_at timestamptz;

-- ---------------------------------------------------------------------
-- 3. Silver cards
--   A day (the user's local review_day) with more than 15 correct vocabulary answers in review earns
--   one silver card, at most 30 in total, counted from 2026-10-31. Derived from review_events, so
--   nothing new is stored. The app asks for its own status; the leaderboard shows everyone's count.
-- ---------------------------------------------------------------------
create or replace function public.get_silver_status(p_day date)
returns table (total integer, today_correct integer, earned_today boolean)
language sql
stable
security definer
set search_path = public
as $$
  with days as (
    select e.review_day, count(*) filter (where e.correct and e.card_type = 'vocab') as correct
      from public.review_events e
     where e.user_id = auth.uid() and e.review_day >= date '2026-10-31'
     group by e.review_day
  )
  select least(30, (select count(*) from days where correct > 15))::integer,
         coalesce((select correct from days where review_day = p_day), 0)::integer,
         coalesce((select correct > 15 from days where review_day = p_day), false);
$$;

revoke all on function public.get_silver_status(date) from public, anon;
grant execute on function public.get_silver_status(date) to authenticated;

-- The leaderboard gets a "silver" column (same function as in schema.sql otherwise)
drop function if exists public.get_leaderboard(text, integer);
create function public.get_leaderboard(p_period text default 'all', p_limit integer default 100)
returns table (
  user_id     uuid,
  display_name text,
  avatar_url  text,
  score       bigint,
  score_7d    bigint,
  mastered    bigint,
  learning    bigint,
  reviews_7d  bigint,
  streak      integer,
  silver      bigint,
  rank        bigint,
  is_me       boolean
)
language sql
stable
security definer
set search_path = public
as $$
  with card_stats as (
    select c.user_id,
           coalesce(sum(c.box), 0)::bigint                  as box_sum,
           count(*) filter (where c.box >= 6)::bigint        as mastered,
           count(*)::bigint                                  as learning
    from public.cards c
    group by c.user_id
  ),
  week_stats as (
    select e.user_id,
           coalesce(sum(e.to_box - e.from_box), 0)::bigint as score_7d,
           count(*)::bigint                                as reviews_7d
    from public.review_events e
    where e.review_day >= (now() at time zone 'utc')::date - 6
    group by e.user_id
  ),
  days as (
    select distinct e.user_id, e.review_day
    from public.review_events e
    where e.review_day >= (now() at time zone 'utc')::date - 400
  ),
  islands as (
    select d.user_id, d.review_day,
           d.review_day - (row_number() over (partition by d.user_id order by d.review_day))::integer as grp
    from days d
  ),
  runs as (
    select i.user_id, count(*)::integer as len, max(i.review_day) as last_day
    from islands i
    group by i.user_id, i.grp
  ),
  streaks as (
    select r.user_id, max(r.len) as streak
    from runs r
    where r.last_day >= (now() at time zone 'utc')::date - 1
    group by r.user_id
  ),
  -- Silver cards: days (from the start date) with more than 15 correct vocabulary answers, at most 30
  silver_days as (
    select e.user_id, e.review_day
    from public.review_events e
    where e.review_day >= date '2026-10-31' and e.correct and e.card_type = 'vocab'
    group by e.user_id, e.review_day
    having count(*) > 15
  ),
  silver_stats as (
    select sd.user_id, least(30, count(*))::bigint as silver
    from silver_days sd
    group by sd.user_id
  ),
  board as (
    select p.id                                                    as user_id,
           p.display_name,
           p.avatar_url,
           coalesce(cs.box_sum, 0)                                 as score,
           coalesce(ws.score_7d, 0)                                as score_7d,
           coalesce(cs.mastered, 0)                                as mastered,
           coalesce(cs.learning, 0)                                as learning,
           coalesce(ws.reviews_7d, 0)                              as reviews_7d,
           coalesce(st.streak, 0)                                  as streak,
           coalesce(sv.silver, 0)                                  as silver,
           (p.id = auth.uid())                                     as is_me,
           p.show_on_leaderboard                                   as visible
    from public.profiles p
    left join card_stats cs on cs.user_id = p.id
    left join week_stats ws on ws.user_id = p.id
    left join streaks st   on st.user_id = p.id
    left join silver_stats sv on sv.user_id = p.id
    where p.suspended_at is null
      and (p.show_on_leaderboard or p.id = auth.uid())
  ),
  scored as (
    select b.*, case when p_period = 'week' then b.score_7d else b.score end as metric
    from board b
  ),
  -- Ranks are computed over visible users only, so everyone sees the same ranks.
  -- A hidden caller still sees where they would stand.
  ranked as (
    select s.*, rank() over (order by s.metric desc) as rank
    from scored s
    where s.visible
    union all
    select s.*, 1 + (select count(*) from scored v where v.visible and v.metric > s.metric) as rank
    from scored s
    where not s.visible
  )
  select r.user_id, r.display_name, r.avatar_url, r.score, r.score_7d, r.mastered, r.learning,
         r.reviews_7d, r.streak, r.silver, r.rank, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(p_limit, 500)) or r.is_me
  order by r.rank, r.is_me desc, r.display_name;
$$;

revoke all on function public.get_leaderboard(text, integer) from public, anon;
grant execute on function public.get_leaderboard(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 4. Nightly run at 00:05 Tehran time (20:35 UTC; pg_cron uses UTC)
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'daf-overdue-demotions';
select cron.schedule('daf-overdue-demotions', '35 20 * * *', $$select public.apply_overdue_demotions()$$);
