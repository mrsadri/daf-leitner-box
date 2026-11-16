-- =====================================================================
-- Clean-up after the 2026-11 refactor: public insight sharing and story dictation are gone.
-- Run it in steps, in the SQL editor, AFTER the new app is live (docs/supabase-cleanup-setup.md). Old open tabs
-- may still call the functions dropped here; the new app no longer does.
--
--   Step 1  back up the copies of other users' public insight cards ('shared_…' ids)
--   Step 2  delete those copies; the cards trigger now ignores any 'shared_…' write, so phones with an old cache
--           or sync queue can neither bring them back nor get stuck; drop the sharing tables and functions
--   Step 3  drop what only dictation used; keep story_progress (Stories use it); flags
--   Step 5  (a week later, separately) drop the backup table
--
-- Review events are not touched: points and the leaderboard stay as they are.
-- Safe to run twice.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Step 1: backup (readable only by the owner in the SQL editor)
-- ---------------------------------------------------------------------
create table if not exists public.backup_shared_copies_20261117 as
  select * from public.cards where left(id, 7) = 'shared_';
alter table public.backup_shared_copies_20261117 enable row level security;
revoke all on public.backup_shared_copies_20261117 from anon, authenticated;

-- ---------------------------------------------------------------------
-- Step 2: copies and sharing
-- ---------------------------------------------------------------------
-- From now on any insert of a 'shared_…' card is skipped silently (return null), also inside an upsert.
create or replace function public.guard_shared_copies()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if left(new.id, 7) = 'shared_' then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.guard_shared_copies() from public, anon, authenticated;
drop trigger if exists cards_guard_shared_copies on public.cards;
create trigger cards_guard_shared_copies
  before insert on public.cards
  for each row execute function public.guard_shared_copies();

delete from public.cards where left(id, 7) = 'shared_';

drop function if exists public.publish_insight(text);
drop function if exists public.unpublish_insight(uuid);
drop function if exists public.get_public_insights(integer, timestamptz);
drop function if exists public.adopt_insight(uuid, date);
drop function if exists public.report_insight(uuid, text);
drop function if exists public.insight_attribution(uuid[]);
drop function if exists public.my_insights();
drop function if exists public.share_quota();
drop function if exists public.admin_list_insights();
drop function if exists public.admin_remove_insight(uuid);
drop function if exists public.admin_keep_insight(uuid);
drop function if exists public.insight_open_reports(uuid);
drop function if exists public.insight_is_live(uuid);
drop table if exists public.insight_reports;
drop table if exists public.shared_insights;
drop index if exists public.cards_shared_copy_idx;

-- ---------------------------------------------------------------------
-- Step 3: dictation leftovers; Stories keep public.story_progress (one row per story, own rows only)
-- ---------------------------------------------------------------------
drop function if exists public.save_dictation_progress(jsonb, jsonb);
drop function if exists public.dictation_status_rank(text);
drop table if exists public.story_sentence_progress;     -- its limit trigger goes with it
drop table if exists public.dictation_events;            -- likewise
drop function if exists public.limit_story_sentence_progress();
drop function if exists public.limit_dictation_events();

-- Rows from the dictation test phase (story ids like 'story-01'); Stories use 'S01-Q1' … 'S10-Q6'
delete from public.story_progress where story_id !~ '^S[0-9]{2}-Q[1-6]$';

-- Kill switch for Stories: on. Turn off with: update public.app_flags set value = 'false' where key = 'stories_enabled';
insert into public.app_flags (key, value) values ('stories_enabled', 'true'::jsonb) on conflict (key) do nothing;
delete from public.app_flags where key = 'dictation_enabled';

-- ---------------------------------------------------------------------
-- Step 5 (later, separately, not part of this file's first run):
--   drop table if exists public.backup_shared_copies_20261117;
-- ---------------------------------------------------------------------
