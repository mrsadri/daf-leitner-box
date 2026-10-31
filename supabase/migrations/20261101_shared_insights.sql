-- =====================================================================
-- Public insight cards (see docs/shared-insights-plan.md)
--   * For every 256 points (leaderboard score = sum of boxes) a user may publish one of their
--     insight cards. Every publication uses a slot for good (unpublishing doesn't give it back).
--   * The public version is a fixed copy. Others add it to their own boxes as a card with the id
--     'shared_<public id>'; the author sees who did. While public the author can't change it.
--   * Unpublishing keeps the copies (without the author's name). An admin takedown removes them.
-- Additive only: new tables, functions, one trigger and one partial index. Safe to run twice.
-- =====================================================================

create table if not exists public.shared_insights (
  id              uuid primary key default gen_random_uuid(),
  author_id       uuid not null references auth.users (id) on delete cascade,
  source_card_id  text not null check (char_length(source_card_id) <= 200),
  title           text not null check (char_length(btrim(title)) between 1 and 120),
  content         text not null default '' check (char_length(content) <= 1500),
  category        text not null check (category in ('decision', 'motivation', 'habit', 'goal', 'note')),
  published_at    timestamptz not null default now(),
  unpublished_at  timestamptz,
  removed_at      timestamptz,   -- admin takedown
  reviewed_at     timestamptz    -- admin kept it: earlier reports no longer hide it
);

-- One live publication per card
create unique index if not exists shared_insights_one_live_idx
  on public.shared_insights (author_id, source_card_id)
  where unpublished_at is null and removed_at is null;
create index if not exists shared_insights_published_idx on public.shared_insights (published_at desc);

create table if not exists public.insight_reports (
  insight_id  uuid not null references public.shared_insights (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reason      text not null default '' check (char_length(reason) <= 300),
  created_at  timestamptz not null default now(),
  primary key (insight_id, reporter_id)
);

-- Reachable only through the functions below
alter table public.shared_insights enable row level security;
alter table public.insight_reports enable row level security;
revoke all on public.shared_insights from anon, authenticated;
revoke all on public.insight_reports from anon, authenticated;

-- Counting the copies of a public card (cards is keyed by user first)
create index if not exists cards_shared_copy_idx on public.cards (id) where left(id, 7) = 'shared_';

-- Reports that count: from different people, after the last time an admin kept the card
create or replace function public.insight_open_reports(p_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)
  from public.insight_reports r
  join public.shared_insights s on s.id = r.insight_id
  where r.insight_id = p_id
    and (s.reviewed_at is null or r.created_at > s.reviewed_at);
$$;

-- Public and visible: not unpublished, not removed, author not suspended, fewer than 3 open reports
create or replace function public.insight_is_live(p_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.shared_insights s
    join public.profiles p on p.id = s.author_id
    where s.id = p_id
      and s.unpublished_at is null
      and s.removed_at is null
      and p.suspended_at is null
      and public.insight_open_reports(s.id) < 3
  );
$$;

-- ---------------------------------------------------------------------
-- Quota
-- ---------------------------------------------------------------------
create or replace function public.share_quota()
returns table (score bigint, allowed integer, used integer, points_per_slot integer)
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((select sum(c.box) from public.cards c where c.user_id = auth.uid()), 0)::bigint,
         (coalesce((select sum(c.box) from public.cards c where c.user_id = auth.uid()), 0) / 256)::integer,
         (select count(*) from public.shared_insights s where s.author_id = auth.uid())::integer,
         256;
$$;

-- ---------------------------------------------------------------------
-- Publish / unpublish (author)
-- Errors carry a short code in the message, which the app translates.
-- ---------------------------------------------------------------------
create or replace function public.publish_insight(p_card_id text)
returns uuid
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid   uuid := auth.uid();
  v_card  public.cards%rowtype;
  v_title text;
  v_body  text;
  v_cat   text;
  v_q     record;
  v_id    uuid;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'share:not_allowed' using errcode = '42501';
  end if;
  -- One publish at a time per user, so two taps can't both pass the quota check
  perform pg_advisory_xact_lock(hashtext('share:' || v_uid::text));

  select * into v_card from public.cards c where c.user_id = v_uid and c.id = p_card_id;
  if not found then
    raise exception 'share:not_found';
  end if;
  if v_card.type <> 'reflection' or left(v_card.id, 7) = 'shared_' then
    raise exception 'share:not_allowed';
  end if;

  v_title := btrim(coalesce(v_card.data ->> 'title', ''), E' \t\r\n');
  v_body  := btrim(coalesce(v_card.data ->> 'content', ''), E' \t\r\n');
  v_cat   := coalesce(nullif(v_card.data ->> 'category', ''), 'decision');
  if v_cat not in ('decision', 'motivation', 'habit', 'goal', 'note') then v_cat := 'note'; end if;
  if char_length(v_title) = 0 then
    raise exception 'share:empty';
  end if;
  if char_length(v_title) > 120 or char_length(v_body) > 1500 then
    raise exception 'share:too_long';
  end if;

  if exists (select 1 from public.shared_insights s
             where s.author_id = v_uid and s.source_card_id = p_card_id
               and s.unpublished_at is null and s.removed_at is null) then
    raise exception 'share:already_public';
  end if;

  select * into v_q from public.share_quota();
  if v_q.used >= v_q.allowed then
    raise exception 'share:quota';
  end if;

  insert into public.shared_insights (author_id, source_card_id, title, content, category)
  values (v_uid, p_card_id, v_title, v_body, v_cat)
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.unpublish_insight(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  update public.shared_insights
     set unpublished_at = now()
   where id = p_id and author_id = auth.uid()
     and unpublished_at is null and removed_at is null;
  if not found then
    raise exception 'share:not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Browse / add / report (everyone)
-- ---------------------------------------------------------------------
drop function if exists public.get_public_insights(integer, timestamptz);
create function public.get_public_insights(p_limit integer default 30, p_before timestamptz default null)
returns table (
  id           uuid,
  title        text,
  content      text,
  category     text,
  author_name  text,
  author_avatar text,
  published_at timestamptz,
  adopters     bigint,
  is_mine      boolean,
  i_have       boolean,
  i_reported   boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.title, s.content, s.category, p.display_name, p.avatar_url, s.published_at,
         (select count(*) from public.cards c
           join public.profiles ap on ap.id = c.user_id
          where left(c.id, 7) = 'shared_' and c.id = 'shared_' || s.id::text and ap.suspended_at is null),
         s.author_id = auth.uid(),
         exists (select 1 from public.cards c where c.user_id = auth.uid() and c.id = 'shared_' || s.id::text),
         exists (select 1 from public.insight_reports r where r.insight_id = s.id and r.reporter_id = auth.uid())
  from public.shared_insights s
  join public.profiles p on p.id = s.author_id
  where auth.uid() is not null
    and public.is_active_user()
    and s.unpublished_at is null
    and s.removed_at is null
    and p.suspended_at is null
    and public.insight_open_reports(s.id) < 3
    and (p_before is null or s.published_at < p_before)
  order by s.published_at desc, s.id
  limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- Adds the public card to the caller's Box 0 (due p_today, the caller's local day).
-- Returns the card row; added = false when it was already there.
drop function if exists public.adopt_insight(uuid, date);
create function public.adopt_insight(p_id uuid, p_today date default null)
returns table (card_id text, data jsonb, next_review_date date, created_at timestamptz, added boolean)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_uid  uuid := auth.uid();
  v_s    public.shared_insights%rowtype;
  v_day  date := coalesce(p_today, (now() at time zone 'utc')::date);
  v_cid  text := 'shared_' || p_id::text;
  v_data jsonb;
  v_new  boolean := false;
begin
  if v_uid is null or not public.is_active_user() then
    raise exception 'share:not_allowed' using errcode = '42501';
  end if;
  select * into v_s from public.shared_insights s where s.id = p_id;
  if not found or not public.insight_is_live(p_id) then
    raise exception 'share:not_public';
  end if;
  if v_s.author_id = v_uid then
    raise exception 'share:own_card';
  end if;
  if v_day < (now() at time zone 'utc')::date - 1 or v_day > (now() at time zone 'utc')::date + 1 then
    v_day := (now() at time zone 'utc')::date;
  end if;

  v_data := jsonb_build_object('title', v_s.title, 'content', v_s.content, 'category', v_s.category, 'sharedId', p_id::text);
  -- Lets the guard trigger accept this new shared_ row
  perform set_config('app.insight_adopt', v_cid, true);
  insert into public.cards (user_id, id, type, box, next_review_date, data)
  values (v_uid, v_cid, 'reflection', 0, v_day, v_data)
  on conflict (user_id, id) do nothing;
  v_new := found;
  perform set_config('app.insight_adopt', '', true);

  return query
    select c.id, c.data, c.next_review_date, c.created_at, v_new
    from public.cards c where c.user_id = v_uid and c.id = v_cid;
end;
$$;

create or replace function public.report_insight(p_id uuid, p_reason text default '')
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not public.is_active_user() then
    raise exception 'share:not_allowed' using errcode = '42501';
  end if;
  if not exists (select 1 from public.shared_insights s where s.id = p_id and s.removed_at is null) then
    raise exception 'share:not_found';
  end if;
  if exists (select 1 from public.shared_insights s where s.id = p_id and s.author_id = auth.uid()) then
    raise exception 'share:own_card';
  end if;
  insert into public.insight_reports (insight_id, reporter_id, reason)
  values (p_id, auth.uid(), left(btrim(coalesce(p_reason, '')), 300))
  on conflict (insight_id, reporter_id) do nothing;
end;
$$;

-- Author names for copies the caller has; only while the card is public and visible
create or replace function public.insight_attribution(p_ids uuid[])
returns table (id uuid, author_name text)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, p.display_name
  from public.shared_insights s
  join public.profiles p on p.id = s.author_id
  where s.id = any ((coalesce(p_ids, '{}'::uuid[]))[1:500])
    and auth.uid() is not null
    and public.insight_is_live(s.id);
$$;

-- ---------------------------------------------------------------------
-- The author's publications, with who added each (only while not unpublished / removed)
-- ---------------------------------------------------------------------
drop function if exists public.my_insights();
create function public.my_insights()
returns table (
  id             uuid,
  source_card_id text,
  title          text,
  content        text,
  category       text,
  published_at   timestamptz,
  unpublished_at timestamptz,
  removed_at     timestamptz,
  hidden         boolean,
  adopters       jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select s.id, s.source_card_id, s.title, s.content, s.category, s.published_at, s.unpublished_at, s.removed_at,
         (s.unpublished_at is null and s.removed_at is null and public.insight_open_reports(s.id) >= 3),
         case when s.unpublished_at is null and s.removed_at is null then
           coalesce((
             select jsonb_agg(jsonb_build_object(
                      'name', case when ap.show_on_leaderboard then ap.display_name else null end,
                      'avatar', case when ap.show_on_leaderboard then ap.avatar_url else null end,
                      'at', c.created_at)
                    order by c.created_at desc)
             from public.cards c
             join public.profiles ap on ap.id = c.user_id
             where left(c.id, 7) = 'shared_' and c.id = 'shared_' || s.id::text and ap.suspended_at is null
           ), '[]'::jsonb)
         else '[]'::jsonb end
  from public.shared_insights s
  where s.author_id = auth.uid()
  order by s.published_at desc;
$$;

-- ---------------------------------------------------------------------
-- Guard: new 'shared_…' cards only come from adopt_insight, and copies of removed cards never come back.
-- Rows are skipped silently (return null), so an app's sync queue never gets stuck on them.
-- Fires on upserts too (before the conflict check).
-- ---------------------------------------------------------------------
create or replace function public.guard_shared_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sid uuid;
begin
  if left(new.id, 7) <> 'shared_' then
    return new;
  end if;
  begin
    v_sid := substr(new.id, 8)::uuid;
  exception when others then
    return null;   -- not a real shared id
  end;
  if exists (select 1 from public.shared_insights s where s.id = v_sid and s.removed_at is not null) then
    return null;
  end if;
  if coalesce(current_setting('app.insight_adopt', true), '') = new.id then
    return new;
  end if;
  if exists (select 1 from public.cards c where c.user_id = new.user_id and c.id = new.id) then
    return new;    -- an update of a copy the user already has (review progress)
  end if;
  return null;
end;
$$;

drop trigger if exists cards_guard_shared_copies on public.cards;
create trigger cards_guard_shared_copies
  before insert on public.cards
  for each row execute function public.guard_shared_copies();

-- ---------------------------------------------------------------------
-- Admin
-- ---------------------------------------------------------------------
drop function if exists public.admin_list_insights();
create function public.admin_list_insights()
returns table (
  id            uuid,
  title         text,
  content       text,
  category      text,
  author_name   text,
  author_email  text,
  published_at  timestamptz,
  unpublished_at timestamptz,
  hidden        boolean,
  open_reports  bigint,
  reports       jsonb,
  adopters      bigint
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
    select s.id, s.title, s.content, s.category,
           coalesce(p.display_name, '')::text, u.email::text,
           s.published_at, s.unpublished_at,
           (s.unpublished_at is null and public.insight_open_reports(s.id) >= 3),
           public.insight_open_reports(s.id),
           coalesce((select jsonb_agg(jsonb_build_object('reason', r.reason, 'at', r.created_at,
                                                         'by', coalesce(rp.display_name, '')) order by r.created_at desc)
                     from public.insight_reports r
                     left join public.profiles rp on rp.id = r.reporter_id
                     where r.insight_id = s.id
                       and (s.reviewed_at is null or r.created_at > s.reviewed_at)), '[]'::jsonb),
           (select count(*) from public.cards c where left(c.id, 7) = 'shared_' and c.id = 'shared_' || s.id::text)
    from public.shared_insights s
    left join public.profiles p on p.id = s.author_id
    left join auth.users u on u.id = s.author_id
    where s.removed_at is null
    order by public.insight_open_reports(s.id) desc, s.published_at desc;
end;
$$;

-- Takedown: unpublished for good and every copy removed from everyone's boxes. Returns the number of copies removed.
create or replace function public.admin_remove_insight(p_id uuid)
returns integer
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.shared_insights
     set removed_at = now(), unpublished_at = coalesce(unpublished_at, now())
   where id = p_id and removed_at is null;
  if not found then
    raise exception 'share:not_found';
  end if;
  delete from public.cards c where left(c.id, 7) = 'shared_' and c.id = 'shared_' || p_id::text;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- The admin checked the reports and keeps the card: earlier reports stop counting
create or replace function public.admin_keep_insight(p_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'not authorized' using errcode = '42501';
  end if;
  update public.shared_insights set reviewed_at = now() where id = p_id and removed_at is null;
  if not found then
    raise exception 'share:not_found';
  end if;
end;
$$;

-- ---------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------
revoke all on function public.insight_open_reports(uuid) from public, anon, authenticated;
revoke all on function public.insight_is_live(uuid) from public, anon, authenticated;
revoke all on function public.guard_shared_copies() from public, anon, authenticated;
revoke all on function public.share_quota() from public, anon;
revoke all on function public.publish_insight(text) from public, anon;
revoke all on function public.unpublish_insight(uuid) from public, anon;
revoke all on function public.get_public_insights(integer, timestamptz) from public, anon;
revoke all on function public.adopt_insight(uuid, date) from public, anon;
revoke all on function public.report_insight(uuid, text) from public, anon;
revoke all on function public.insight_attribution(uuid[]) from public, anon;
revoke all on function public.my_insights() from public, anon;
revoke all on function public.admin_list_insights() from public, anon;
revoke all on function public.admin_remove_insight(uuid) from public, anon;
revoke all on function public.admin_keep_insight(uuid) from public, anon;
grant execute on function public.share_quota() to authenticated;
grant execute on function public.publish_insight(text) to authenticated;
grant execute on function public.unpublish_insight(uuid) to authenticated;
grant execute on function public.get_public_insights(integer, timestamptz) to authenticated;
grant execute on function public.adopt_insight(uuid, date) to authenticated;
grant execute on function public.report_insight(uuid, text) to authenticated;
grant execute on function public.insight_attribution(uuid[]) to authenticated;
grant execute on function public.my_insights() to authenticated;
grant execute on function public.admin_list_insights() to authenticated;
grant execute on function public.admin_remove_insight(uuid) to authenticated;
grant execute on function public.admin_keep_insight(uuid) to authenticated;
