# Supabase: clean-up after the 2026-11 refactor

For the Supabase dashboard of the **daf-leitner-box** project, done in the browser by Claude Desktop with the owner. Nothing here is run from the development machine.

**When:** only **after** the new app (Stories, «کارت‌های من», no public insights) is live and the live check has passed. Phones that still have an old tab open may call the functions dropped here; the new app does not.

**What changes:**
- **Public insight sharing is removed.**
  - Copies of other users' public cards (`shared_…` ids) are **backed up** in a table only the owner can read, and then **deleted** from users' boxes.
  - Their review history (`review_events`) stays, so **points and the leaderboard do not change**.
  - The tables `shared_insights` and `insight_reports` and 13 functions are dropped.
- **The `cards` trigger `cards_guard_shared_copies` stays but becomes simpler.** It silently skips any write of a `shared_…` card, so a phone with an old cache or an unsent sync queue can neither bring a copy back nor get stuck.
- **What only dictation used is dropped:**
  - the tables `story_sentence_progress` and `dictation_events`;
  - the functions `save_dictation_progress`, `dictation_status_rank` and the two limit functions.
- **`story_progress` stays**, because Stories use it. Only the rows from the dictation test phase (`story-01` and similar) are deleted. These are the owner's test rows.
- **Flags:**
  - `stories_enabled = true` is added. It is the kill switch for Stories.
  - `dictation_enabled` is removed.

**Rules for whoever does this:**
- Run only the SQL given here.
- Never run anything from `supabase/tests/`.
- **Stop after step 0 and show the numbers to the owner.** Go on only after the owner says so.
- Stop and report if any step shows an error.

**Migration file** (GitHub, public; after the merge it is on `main`):
https://raw.githubusercontent.com/mrsadri/daf-leitner-box/main/supabase/migrations/20261117_cleanup_insights_dictation.sql

## 0. Before: what will change (read only)

```sql
select
  (select count(*) from public.cards) as cards,
  (select count(*) from public.cards where left(id, 7) = 'shared_') as shared_copies,
  (select count(distinct user_id) from public.cards where left(id, 7) = 'shared_') as users_with_copies,
  (select count(*) from public.review_events where left(card_id, 7) = 'shared_') as review_events_of_copies_kept,
  (select count(*) from public.shared_insights) as published_insights,
  (select count(*) from public.story_progress where story_id !~ '^S[0-9]{2}-Q[1-6]$') as old_dictation_rows,
  (select count(*) from public.story_progress where story_id ~ '^S[0-9]{2}-Q[1-6]$') as stories_rows,
  (select count(*) from public.profiles) as profiles;
```

Write every number down and **show them to the owner.**
- `shared_copies` cards in the boxes of `users_with_copies` users will be deleted. They are backed up first.
- `review_events_of_copies_kept` stays.

**STOP. Continue only when the owner confirms.**

## 1 to 3. Migration

SQL Editor → New query → paste the **full** contents of the migration file → Run.

What it does, in order:
1. backs up the copies in `backup_shared_copies_20261117`;
2. sets the new trigger, deletes the copies, and drops the sharing tables and functions;
3. drops the dictation leftovers and sets the flags.

Expected: no error. Notices such as "does not exist, skipping" are fine.

## 4. Checks (read only)

```sql
select
  (select count(*) from public.backup_shared_copies_20261117) as backed_up,          -- = shared_copies from step 0
  (select count(*) from public.cards where left(id, 7) = 'shared_') as copies_left,  -- 0
  (select count(*) from public.cards) as cards,                                      -- = cards − shared_copies
  (select count(*) from public.review_events where left(card_id, 7) = 'shared_') as events_kept,  -- unchanged
  to_regclass('public.shared_insights') is null as sharing_tables_gone,              -- true
  to_regclass('public.story_sentence_progress') is null as dictation_tables_gone,    -- true
  to_regclass('public.story_progress') is not null as story_progress_kept,           -- true
  (select value from public.app_flags where key = 'stories_enabled') as stories_flag,  -- true
  (select count(*) from public.app_flags where key = 'dictation_enabled') as old_flag, -- 0
  (select count(*) from public.profiles) as profiles;                                -- unchanged
```

Every value must match its comment. Then open the live app, sign in, and check:
- Stories open, and a page turn is saved;
- «کارت‌های من» opens in the word bank;
- the review works.

Paste the results back to the owner.

## 5. A week later (separately)

When nobody has reported a problem:

```sql
drop table if exists public.backup_shared_copies_20261117;
```

## Turning Stories off and on (any time, no deploy)

```sql
update public.app_flags set value = 'false'::jsonb where key = 'stories_enabled';   -- off
update public.app_flags set value = 'true'::jsonb  where key = 'stories_enabled';   -- on
```

The app reads the flag when it starts. A missing flag means on.
