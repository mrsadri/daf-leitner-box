-- =====================================================================
-- 1. Overdue rule: a card that is not reviewed within 3 days of its due date moves to the start of
--    the previous box (box 3 → box 2, next review 4 days later). Runs every night on the server.
-- 2. Leaderboard "someone passed you" notification: ranks for the sending function, per-user baseline.
--
-- Additive: one new table, new functions, two new columns, one cron job. Running this file changes no
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
-- 3. Nightly run at 00:05 Tehran time (20:35 UTC; pg_cron uses UTC)
-- ---------------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname = 'daf-overdue-demotions';
select cron.schedule('daf-overdue-demotions', '35 20 * * *', $$select public.apply_overdue_demotions()$$);
