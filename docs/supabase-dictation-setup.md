# Supabase setup: story dictation

For the Supabase dashboard of the **daf-leitner-box** project, done in the browser.

**What changes (additive only, no existing row, column, policy or function is changed):**
- four new tables: `story_progress`, `story_sentence_progress`, `app_flags`, `dictation_events`;
- four new functions: `save_dictation_progress`, `dictation_status_rank`, and the two trigger functions
  `limit_story_sentence_progress` and `limit_dictation_events`;
- two new triggers, one on each of the two new tables that can grow (`story_sentence_progress`, `dictation_events`).
  No trigger is added to an existing table;
- one new row in `app_flags`: `dictation_enabled` = `false` (the feature stays **off** for everyone).

The current app keeps working before and after. The new app can run without this migration (dictation progress then stays on the device, with one notice), but the feature should not be switched on before the migration is applied.

**Rules for whoever does this:**
- Run only the SQL given here.
- Never run anything from `supabase/tests/`.
- Stop and report if a step shows an error.
- This is the **production** project: apply it only after the owner has said so, and do the "before" numbers first.

Migration file (GitHub, public):
https://raw.githubusercontent.com/mrsadri/daf-leitner-box/main/supabase/migrations/20261115_story_dictation.sql
(use the branch name instead of `main` until the pull request is merged).

## 0. Before: row counts (read only)

```sql
select (select count(*) from public.cards) as cards,
       (select count(*) from public.review_events) as review_events,
       (select count(*) from public.profiles) as profiles;
```
Write the three numbers down.

## 1. Migration

SQL Editor → New query → paste the **full** contents of the migration file → Run.

Expected: no error. Notices such as "does not exist, skipping" are fine. Running it a second time is safe.

## 2. Checks (read only)

```sql
-- a) 4 rows, all with rls = true
select c.relname, c.relrowsecurity as rls
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('story_progress', 'story_sentence_progress', 'app_flags', 'dictation_events')
order by 1;

-- b) 4 rows
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('save_dictation_progress', 'dictation_status_rank', 'limit_story_sentence_progress', 'limit_dictation_events')
order by 1;

-- c) 2 triggers
select tgname from pg_trigger
where tgname in ('story_sentence_progress_limit', 'dictation_events_limit') order by 1;

-- d) the flag is off: value = false
select key, value from public.app_flags where key = 'dictation_enabled';

-- e) the app's users cannot read events and cannot change flags: both false
select has_table_privilege('authenticated', 'public.dictation_events', 'select') as events_readable,
       has_table_privilege('authenticated', 'public.app_flags', 'update') as flags_writable;

-- f) anonymous visitors can use none of it: all false
select has_table_privilege('anon', 'public.story_progress', 'select') as anon_progress,
       has_function_privilege('anon', 'public.save_dictation_progress(jsonb, jsonb)', 'execute') as anon_save,
       has_table_privilege('anon', 'public.app_flags', 'select') as anon_flags;

-- g) existing data unchanged (same numbers as step 0, apart from what people saved in the meantime)
select (select count(*) from public.cards) as cards,
       (select count(*) from public.review_events) as review_events,
       (select count(*) from public.profiles) as profiles;
```

Report the results of steps 0 and 2.

## 3. Storage bucket `story-media` (Dashboard → Storage)

Create a **public** bucket named `story-media`:

| Setting | Value |
|---|---|
| Public bucket | on (read for everyone) |
| File size limit | 2 MB |
| Allowed MIME types | `audio/mpeg`, `image/webp` |
| Policies | none for insert, update or delete: only the service role (the owner's upload script) writes |

Then check, with any uploaded test file (`upload_media.py` dry run first, see `docs/dictation/05-audio.md`):
- a public URL plays in a browser and answers with `Cache-Control: public, max-age=31536000`;
- `fetch()` from `https://<your-production-origin>` is not blocked by CORS (a missing CORS header would stop the Cache API prefetch).

## 4. Release: turn the feature on, and off again

The feature is released by this one statement. It takes effect on the users' next page load; no deploy.

```sql
update public.app_flags set value = 'true', updated_at = now() where key = 'dictation_enabled';
```

**Kill switch** (instant, no deploy, data stays):

```sql
update public.app_flags set value = 'false', updated_at = now() where key = 'dictation_enabled';
```

If the flag cannot be read, the app falls back to the constant `DICTATION_ENABLED` in `src/config.ts`. That constant stays `false` until the release pull request changes it, so nothing is visible to users before the owner decides.

## 5. Monitoring queries (read only)

```sql
-- usage: stories started per day
select date_trunc('day', started_at) as day, count(*) as started from public.story_progress group by 1 order by 1 desc limit 14;

-- how far people get
select story_id, count(*) as users, round(avg(finished_count::numeric / nullif(total_count, 0)) * 100) as avg_percent_done
from public.story_progress group by 1;

-- hot sentences: the most skipped and the most attempted
select sentence_id, count(*) filter (where skips > 0) as skipped_by, sum(attempts) as attempts, sum(mistakes) as mistakes
from public.story_sentence_progress group by 1 order by skipped_by desc, attempts desc limit 30;

-- audio problems by mode and detail, last 3 days
select event, mode, detail, client, count(*) from public.dictation_events
where created_at > now() - interval '3 days' group by 1, 2, 3, 4 order by 5 desc;

-- sync problems
select date_trunc('hour', created_at) as hour, count(*) from public.dictation_events
where event = 'save_failed' and created_at > now() - interval '3 days' group by 1 order by 1 desc;

-- rows per user (the caps are 20000 sentence rows and 2000 events)
select user_id, count(*) from public.story_sentence_progress group by 1 order by 2 desc limit 5;
```

Prune the events table now and then (60 days):

```sql
delete from public.dictation_events where created_at < now() - interval '60 days';
```

## Undo (only if the feature is abandoned)

This removes everything the migration added and **deletes all dictation progress and events**. Nothing else is touched. For a normal rollback use the kill switch in step 4 instead: the tables are inert without the app.

```sql
drop trigger if exists story_sentence_progress_limit on public.story_sentence_progress;
drop trigger if exists dictation_events_limit on public.dictation_events;
drop function if exists public.save_dictation_progress(jsonb, jsonb), public.dictation_status_rank(text),
  public.limit_story_sentence_progress(), public.limit_dictation_events();
drop table if exists public.dictation_events, public.story_sentence_progress, public.story_progress, public.app_flags;
```
