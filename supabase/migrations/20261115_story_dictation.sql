-- =====================================================================
-- Story dictation (see docs/dictation/09-data-model.md)
--   * story_progress and story_sentence_progress: per-user progress, written only through
--     save_dictation_progress (monotonic merge, idempotent, safe with two devices).
--   * app_flags: a remote kill switch ('dictation_enabled'), read by the app, written in the SQL editor.
--   * dictation_events: insert-only beta monitoring without any text content.
-- Additive only: four new tables, three functions, two triggers. Nothing existing is altered.
-- Safe to run twice.
-- =====================================================================

create table if not exists public.story_progress (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id         text not null check (char_length(story_id) between 1 and 40),
  finished_count   integer not null default 0 check (finished_count >= 0),
  total_count      integer not null default 0 check (total_count >= 0),
  last_sentence_id text check (char_length(last_sentence_id) <= 40),
  content_version  text check (char_length(content_version) <= 40),
  started_at       timestamptz not null default now(),
  last_active_at   timestamptz not null default now(),
  completed_at     timestamptz,
  primary key (user_id, story_id)
);

create table if not exists public.story_sentence_progress (
  user_id          uuid not null default auth.uid() references auth.users (id) on delete cascade,
  story_id         text not null check (char_length(story_id) between 1 and 40),
  sentence_id      text not null check (char_length(sentence_id) between 1 and 40),
  sentence_order   integer not null check (sentence_order >= 0),
  status           text not null default 'heard' check (status in ('heard', 'attempted', 'moved', 'skipped', 'correct')),
  attempts         integer not null default 0 check (attempts between 0 and 100000),
  mistakes         integer not null default 0 check (mistakes between 0 and 100000),
  skips            smallint not null default 0 check (skips >= 0),
  listens          integer not null default 0 check (listens between 0 and 100000),
  leitner_actions  smallint not null default 0 check (leitner_actions >= 0),
  content_hash     text check (char_length(content_hash) <= 24),
  first_correct_at timestamptz,
  last_attempt_at  timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (user_id, sentence_id)
);
create index if not exists story_sentence_progress_story_idx
  on public.story_sentence_progress (user_id, story_id, sentence_order);

create table if not exists public.app_flags (
  key        text primary key check (char_length(key) <= 60),
  value      jsonb not null default 'true'::jsonb,
  updated_at timestamptz not null default now()
);
-- seeded OFF: the owner flips it on at release time (docs/supabase-dictation-setup.md)
insert into public.app_flags (key, value) values ('dictation_enabled', 'false'::jsonb) on conflict (key) do nothing;

create table if not exists public.dictation_events (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  event       text not null check (event in ('audio_fallback', 'audio_failed', 'save_failed', 'content_load_failed')),
  mode        text check (mode in ('A', 'B', 'C')),
  sentence_id text check (char_length(sentence_id) <= 40),
  detail      text check (char_length(detail) <= 120),
  client      text check (char_length(client) <= 60),
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Row level security: own rows only, same predicate as cards
-- ---------------------------------------------------------------------
alter table public.story_progress enable row level security;
alter table public.story_sentence_progress enable row level security;
alter table public.app_flags enable row level security;
alter table public.dictation_events enable row level security;

drop policy if exists "story_progress: select own" on public.story_progress;
create policy "story_progress: select own" on public.story_progress
  for select using (auth.uid() = user_id and (select public.is_active_user()));
drop policy if exists "story_progress: insert own" on public.story_progress;
create policy "story_progress: insert own" on public.story_progress
  for insert with check (auth.uid() = user_id and (select public.is_active_user()));
drop policy if exists "story_progress: update own" on public.story_progress;
create policy "story_progress: update own" on public.story_progress
  for update using (auth.uid() = user_id and (select public.is_active_user()))
  with check (auth.uid() = user_id and (select public.is_active_user()));

drop policy if exists "story_sentence_progress: select own" on public.story_sentence_progress;
create policy "story_sentence_progress: select own" on public.story_sentence_progress
  for select using (auth.uid() = user_id and (select public.is_active_user()));
drop policy if exists "story_sentence_progress: insert own" on public.story_sentence_progress;
create policy "story_sentence_progress: insert own" on public.story_sentence_progress
  for insert with check (auth.uid() = user_id and (select public.is_active_user()));
drop policy if exists "story_sentence_progress: update own" on public.story_sentence_progress;
create policy "story_sentence_progress: update own" on public.story_sentence_progress
  for update using (auth.uid() = user_id and (select public.is_active_user()))
  with check (auth.uid() = user_id and (select public.is_active_user()));
-- no delete policy: rows go away with the account (on delete cascade, also on the admin delete path)

drop policy if exists "app_flags: read" on public.app_flags;
create policy "app_flags: read" on public.app_flags for select to authenticated using (true);
-- no write policy: the owner edits flags in the SQL editor

drop policy if exists "dictation_events: insert own" on public.dictation_events;
create policy "dictation_events: insert own" on public.dictation_events
  for insert with check (auth.uid() = user_id and (select public.is_active_user()));
-- no select policy: the owner reads events in the SQL editor

revoke all on public.story_progress, public.story_sentence_progress, public.app_flags, public.dictation_events from anon, authenticated;
grant select, insert, update on public.story_progress, public.story_sentence_progress to authenticated;
grant select on public.app_flags to authenticated;
grant insert on public.dictation_events to authenticated;

-- ---------------------------------------------------------------------
-- Size limits, like limit_cards_per_user. The cap check skips rows that already exist, so a user at the
-- cap can still update their progress through the upsert (BEFORE INSERT triggers also fire for upserts).
-- ---------------------------------------------------------------------
create or replace function public.limit_story_sentence_progress()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from public.story_sentence_progress p
             where p.user_id = new.user_id and p.sentence_id = new.sentence_id) then
    return new;
  end if;
  if (select count(*) from public.story_sentence_progress p where p.user_id = new.user_id) >= 20000 then
    raise exception 'story progress limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;
drop trigger if exists story_sentence_progress_limit on public.story_sentence_progress;
create trigger story_sentence_progress_limit
  before insert on public.story_sentence_progress
  for each row execute function public.limit_story_sentence_progress();

create or replace function public.limit_dictation_events()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.dictation_events e where e.user_id = new.user_id) >= 2000 then
    raise exception 'event limit reached' using errcode = '54000';
  end if;
  return new;
end;
$$;
drop trigger if exists dictation_events_limit on public.dictation_events;
create trigger dictation_events_limit
  before insert on public.dictation_events
  for each row execute function public.limit_dictation_events();

-- ---------------------------------------------------------------------
-- Merge rules
-- ---------------------------------------------------------------------
create or replace function public.dictation_status_rank(p_status text)
returns integer
language sql
immutable
as $$
  select case p_status
    when 'heard' then 1
    when 'attempted' then 2
    when 'moved' then 3
    when 'skipped' then 3
    when 'correct' then 4
    else 0
  end;
$$;

-- The only write path of the client. SECURITY INVOKER, so RLS and the active-user check still apply.
-- The client sends absolute totals (server baseline plus local increments); greatest() makes a retry
-- idempotent and two devices harmless. Status and finished counts never go backwards.
create or replace function public.save_dictation_progress(p_story jsonb, p_sentences jsonb)
returns void
language plpgsql
security invoker
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  if p_sentences is not null and jsonb_typeof(p_sentences) <> 'array' then
    raise exception 'sentences must be an array';
  end if;
  if p_sentences is not null and jsonb_array_length(p_sentences) > 500 then
    raise exception 'batch too large';
  end if;

  if p_sentences is not null and jsonb_array_length(p_sentences) > 0 then
    insert into public.story_sentence_progress as t
      (user_id, story_id, sentence_id, sentence_order, status, attempts, mistakes, skips, listens,
       leitner_actions, content_hash, first_correct_at, last_attempt_at, updated_at)
    select auth.uid(), r.story_id, r.sentence_id, coalesce(r.sentence_order, 0), coalesce(r.status, 'heard'),
           coalesce(r.attempts, 0), coalesce(r.mistakes, 0), coalesce(r.skips, 0), coalesce(r.listens, 0),
           coalesce(r.leitner_actions, 0), r.content_hash, r.first_correct_at, r.last_attempt_at, now()
      from jsonb_to_recordset(p_sentences) as r(story_id text, sentence_id text, sentence_order int, status text,
           attempts int, mistakes int, skips int, listens int, leitner_actions int, content_hash text,
           first_correct_at timestamptz, last_attempt_at timestamptz)
    on conflict (user_id, sentence_id) do update set
      sentence_order   = excluded.sentence_order,
      status           = case when public.dictation_status_rank(excluded.status) >= public.dictation_status_rank(t.status)
                              then excluded.status else t.status end,
      attempts         = greatest(t.attempts, excluded.attempts),
      mistakes         = greatest(t.mistakes, excluded.mistakes),
      skips            = greatest(t.skips, excluded.skips),
      listens          = greatest(t.listens, excluded.listens),
      leitner_actions  = greatest(t.leitner_actions, excluded.leitner_actions),
      content_hash     = coalesce(excluded.content_hash, t.content_hash),
      first_correct_at = least(t.first_correct_at, excluded.first_correct_at),   -- least() ignores NULLs
      last_attempt_at  = greatest(t.last_attempt_at, excluded.last_attempt_at),
      updated_at       = now();
  end if;

  if p_story is not null and p_story ->> 'story_id' is not null then
    insert into public.story_progress as s
      (user_id, story_id, finished_count, total_count, last_sentence_id, content_version, last_active_at, completed_at)
    values (auth.uid(), p_story ->> 'story_id',
            coalesce((p_story ->> 'finished_count')::int, 0), coalesce((p_story ->> 'total_count')::int, 0),
            p_story ->> 'last_sentence_id', p_story ->> 'content_version', now(),
            case when coalesce((p_story ->> 'total_count')::int, 0) > 0
                  and coalesce((p_story ->> 'finished_count')::int, 0) >= (p_story ->> 'total_count')::int
                 then now() end)
    on conflict (user_id, story_id) do update set
      -- a new content version means the client recomputed the counts against the current ids: take them as sent
      finished_count   = case when excluded.content_version is distinct from s.content_version
                              then excluded.finished_count else greatest(s.finished_count, excluded.finished_count) end,
      total_count      = excluded.total_count,
      last_sentence_id = coalesce(excluded.last_sentence_id, s.last_sentence_id),
      content_version  = coalesce(excluded.content_version, s.content_version),
      last_active_at   = now(),
      completed_at     = coalesce(s.completed_at, excluded.completed_at);
  end if;
end;
$$;

revoke all on function public.save_dictation_progress(jsonb, jsonb) from public, anon;
grant execute on function public.save_dictation_progress(jsonb, jsonb) to authenticated;
revoke all on function public.dictation_status_rank(text) from public, anon;
grant execute on function public.dictation_status_rank(text) to authenticated;
