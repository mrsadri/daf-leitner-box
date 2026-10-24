-- =====================================================================
-- DaF Leitner Box — Supabase schema
-- Run this once in: Supabase Dashboard → SQL Editor → New query → Run
-- It is idempotent, so running it again is safe.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Profiles (one row per Google account)
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                  uuid primary key references auth.users (id) on delete cascade,
  display_name        text not null default 'کاربر' check (char_length(display_name) between 1 and 40),
  avatar_url          text,
  show_on_leaderboard boolean not null default true,
  onboarded           boolean not null default false,
  settings            jsonb not null default '{}'::jsonb,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles: read own" on public.profiles;
create policy "profiles: read own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles: insert own" on public.profiles;
create policy "profiles: insert own" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "profiles: update own" on public.profiles;
create policy "profiles: update own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- Create a profile automatically when a user signs in for the first time.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(new.raw_user_meta_data ->> 'name', ''),
      split_part(new.email, '@', 1),
      'کاربر'
    ), 40),
    new.raw_user_meta_data ->> 'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Presence and suspension (managed by the admin functions in section 5).
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists suspended_at timestamptz;

-- Users may only write the columns the app edits, so nobody can lift their own suspension.
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, display_name, avatar_url) on public.profiles to authenticated;
grant update (display_name, show_on_leaderboard, onboarded, settings, updated_at) on public.profiles to authenticated;

-- False while the caller's account is suspended; used by the RLS policies below.
create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.suspended_at is not null
  );
$$;

-- ---------------------------------------------------------------------
-- 2. Cards (each user's Leitner cards and their progress)
-- ---------------------------------------------------------------------
create table if not exists public.cards (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  id               text not null check (char_length(id) <= 200),
  type             text not null check (type in ('vocab', 'reflection')),
  box              smallint not null check (box between 0 and 6),
  next_review_date date not null,
  last_reviewed_at timestamptz,
  review_count     integer not null default 0 check (review_count >= 0),
  correct_count    integer not null default 0 check (correct_count >= 0),
  wrong_count      integer not null default 0 check (wrong_count >= 0),
  data             jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  primary key (user_id, id)
);

alter table public.cards enable row level security;

drop policy if exists "cards: owner full access" on public.cards;
create policy "cards: owner full access" on public.cards
  for all using (auth.uid() = user_id and (select public.is_active_user()))
  with check (auth.uid() = user_id and (select public.is_active_user()));

-- Size limits, so a single account can't fill the database.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'cards_data_size') then
    alter table public.cards add constraint cards_data_size check (octet_length(data::text) <= 16384);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'profiles_settings_size') then
    alter table public.profiles add constraint profiles_settings_size check (octet_length(settings::text) <= 16384);
  end if;
end;
$$;

create or replace function public.limit_cards_per_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.cards c where c.user_id = new.user_id) >= 10000 then
    raise exception 'card limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;

drop trigger if exists cards_limit_per_user on public.cards;
create trigger cards_limit_per_user
  before insert on public.cards
  for each row execute function public.limit_cards_per_user();

-- ---------------------------------------------------------------------
-- 3. Review events (append-only log, used for streaks and weekly ranking)
-- ---------------------------------------------------------------------
create table if not exists public.review_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  card_id     text not null,
  card_type   text not null check (card_type in ('vocab', 'reflection')),
  correct     boolean not null,
  from_box    smallint not null check (from_box between 0 and 6),
  to_box      smallint not null check (to_box between 0 and 6),
  -- The user's local calendar day (validated by the trigger below).
  review_day  date not null,
  created_at  timestamptz not null default now()
);

-- One review moves a card at most one box (see leitnerEngine.ts), which caps the weekly score.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'review_events_one_step') then
    alter table public.review_events add constraint review_events_one_step
      check (abs(to_box - from_box) <= 1) not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'review_events_card_id_len') then
    alter table public.review_events add constraint review_events_card_id_len
      check (char_length(card_id) <= 200) not valid;
  end if;
end;
$$;

create index if not exists review_events_user_day_idx on public.review_events (user_id, review_day);

-- review_day must be within ±1 day of the server's day, so streaks can't be backfilled.
create or replace function public.validate_review_event()
returns trigger
language plpgsql
as $$
begin
  if new.review_day < (now() at time zone 'utc')::date - 1
     or new.review_day > (now() at time zone 'utc')::date + 1 then
    raise exception 'review_day % is out of range', new.review_day;
  end if;
  new.created_at := now();
  return new;
end;
$$;

drop trigger if exists review_events_validate on public.review_events;
create trigger review_events_validate
  before insert on public.review_events
  for each row execute function public.validate_review_event();

alter table public.review_events enable row level security;

drop policy if exists "review_events: read own" on public.review_events;
create policy "review_events: read own" on public.review_events
  for select using (auth.uid() = user_id);

drop policy if exists "review_events: insert own" on public.review_events;
create policy "review_events: insert own" on public.review_events
  for insert with check (auth.uid() = user_id and (select public.is_active_user()));

-- ---------------------------------------------------------------------
-- 4. Leaderboard
--    Users can't read each other's cards (RLS), so the leaderboard is a
--    SECURITY DEFINER function that exposes only aggregated, public fields.
--
--    Score      = Σ over boxes (number of cards in the box × box index)
--                 = sum of `box` over all of the user's cards (Box 0 = 0 … Mastered = 6)
--    Week score = change in that score from reviews in the last 7 days (Σ to_box − from_box)
--    Only aggregates are exposed; card contents (e.g. private reflections) never are.
-- ---------------------------------------------------------------------
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
           (p.id = auth.uid())                                     as is_me,
           p.show_on_leaderboard                                   as visible
    from public.profiles p
    left join card_stats cs on cs.user_id = p.id
    left join week_stats ws on ws.user_id = p.id
    left join streaks st   on st.user_id = p.id
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
         r.reviews_7d, r.streak, r.rank, r.is_me
  from ranked r
  where r.rank <= greatest(1, least(p_limit, 500)) or r.is_me
  order by r.rank, r.is_me desc, r.display_name;
$$;

revoke all on function public.get_leaderboard(text, integer) from public, anon;
grant execute on function public.get_leaderboard(text, integer) to authenticated;

-- ---------------------------------------------------------------------
-- 5. Admin: user list, presence, suspension and permanent deletion
--    Only accounts listed in public.app_admins can call the admin_* functions.
--    Make yourself admin once (SQL Editor), after signing in to the app at least once:
--      insert into public.app_admins (user_id)
--      select id from auth.users where email = 'YOUR-EMAIL@example.com'
--      on conflict do nothing;
-- ---------------------------------------------------------------------
create table if not exists public.app_admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: the table is reachable only through SECURITY DEFINER functions.
alter table public.app_admins enable row level security;
revoke all on public.app_admins from anon, authenticated;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.app_admins a where a.user_id = auth.uid());
$$;

-- Called by the app on start and every few minutes; returns true if the caller is suspended.
create or replace function public.touch_presence()
returns boolean
language sql
volatile
security definer
set search_path = public
as $$
  update public.profiles
     set last_seen_at = now()
   where id = auth.uid();
  select exists (select 1 from public.profiles where id = auth.uid() and suspended_at is not null);
$$;

drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  user_id      uuid,
  email        text,
  display_name text,
  avatar_url   text,
  first_seen   timestamptz,
  last_seen    timestamptz,
  suspended_at timestamptz,
  cards        bigint,
  reviews      bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  return query
    select u.id,
           u.email::text,
           coalesce(p.display_name, split_part(u.email, '@', 1))::text,
           p.avatar_url,
           u.created_at,
           greatest(p.last_seen_at, u.last_sign_in_at, ev.last_event),
           p.suspended_at,
           coalesce(c.n, 0)::bigint,
           coalesce(ev.n, 0)::bigint
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join (select cc.user_id, count(*) as n from public.cards cc group by cc.user_id) c on c.user_id = u.id
    left join (select e.user_id, count(*) as n, max(e.created_at) as last_event
               from public.review_events e group by e.user_id) ev on ev.user_id = u.id
    order by greatest(p.last_seen_at, u.last_sign_in_at, ev.last_event) desc nulls last;
end;
$$;

-- Temporary removal: the account and its data stay, but the user is locked out until restored.
create or replace function public.admin_set_suspended(p_user uuid, p_suspended boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot suspend yourself';
  end if;
  update public.profiles
     set suspended_at = case when p_suspended then now() else null end,
         updated_at = now()
   where id = p_user;
  if not found then
    raise exception 'user % not found', p_user;
  end if;
end;
$$;

-- Permanent removal: deletes the Google login and (via ON DELETE CASCADE) the profile, cards and review history.
create or replace function public.admin_delete_user(p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  if p_user = auth.uid() then
    raise exception 'cannot delete yourself';
  end if;
  delete from auth.users where id = p_user;
  if not found then
    raise exception 'user % not found', p_user;
  end if;
end;
$$;

revoke all on function public.is_active_user() from public, anon;
revoke all on function public.is_admin() from public, anon;
revoke all on function public.touch_presence() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_suspended(uuid, boolean) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.is_active_user() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.touch_presence() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_suspended(uuid, boolean) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
