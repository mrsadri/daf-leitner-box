# Supabase setup: adjective declension contest (صرف صفت)

For the Supabase dashboard of the **daf-leitner-box** project, done in the browser by Claude Desktop with
the owner. Nothing here is run from the development machine.

**What changes:**
- **One new table**, `adjective_drill_runs`: one row per run (own rows only, row-level security). No card,
  review event, or Leitner score is touched — this feature's scores are entirely separate.
- **Four new functions:** `start_adjective_run`, `finish_adjective_run`, `get_adjective_board`,
  `get_my_adjective_bests`. All `SECURITY DEFINER`; the table has no insert/update policy, so writes only
  happen through them. Suspended accounts can neither start nor finish a run.
- **Flag:** `adjective_drill_enabled = true` is added (seeded **on**). It is the kill switch for the drill:
  while off, the app shows no home card, `?go=adjective` falls back to the home page, and the «صفت‌ها» tab
  in «رقابت» is hidden. Until this migration runs, the app already works fine — every run is practice only
  and the «صفت‌ها» tab shows its error state (the functions don't exist yet).
- **When to run it:** any time after the PR is merged, before or after the deploy. It only adds objects
  that the current live app never touches, so running it first is harmless and means the very first runs
  are recorded.
- **Account deletion:** `adjective_drill_runs.user_id` cascades with `auth.users`, so the existing
  `admin_delete_user` already removes a deleted user's runs. No change needed there.

**Rules for whoever does this:**
- Run only the SQL given here.
- Never run anything from `supabase/tests/`.
- Stop and report if a step shows an error.

**Migration file** (GitHub, public; after the merge it is on `main`):
https://raw.githubusercontent.com/mrsadri/daf-leitner-box/main/supabase/migrations/20261117_adjective_drill.sql

## 0. Before running (read-only)

Check that the file on GitHub `main` is the reviewed one: it must contain `for update` and
`'account suspended'` twice (once in `start_adjective_run`, once in `finish_adjective_run`).

```sql
select
  to_regclass('public.app_flags')            is not null as app_flags_exists,     -- expected: true
  to_regclass('public.adjective_drill_runs') is null     as drill_table_is_new;   -- expected: true (false only if run before)
```

If `app_flags_exists` is false, **stop** and report: the migration needs that table.

## 1. Database migration

SQL Editor → New query → paste the **full** contents of the migration file → Run.

Expected: no error. Notices such as "already exists, skipping" are fine.

Check (should return 4 rows):

```sql
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('start_adjective_run', 'finish_adjective_run', 'get_adjective_board', 'get_my_adjective_bests');
```

Check the flag (should return `true`):

```sql
select value from public.app_flags where key = 'adjective_drill_enabled';
```

Check the table (should return `true`, `0`):

```sql
select (select relrowsecurity from pg_class where oid = 'public.adjective_drill_runs'::regclass) as rls_on,
       (select count(*) from public.adjective_drill_runs) as runs;
```

Nothing else changed: the counts of `cards`, `review_events` and `profiles` are the same as before.

## 2. Live check

1. Open the live app, sign in.
2. The home card for the adjective drill should appear under the Stories card.
3. Start a run; it should **not** show the "practice only" banner any more (that only showed before this
   migration was run, or when offline).
4. Let the 5-minute timer run out (or come back after 5 minutes), then check «رقابت» → «صفت‌ها»: the run
   should appear with today's score.

## Turning the drill off and on (any time, no deploy)

```sql
update public.app_flags set value = 'false'::jsonb where key = 'adjective_drill_enabled';   -- off
update public.app_flags set value = 'true'::jsonb  where key = 'adjective_drill_enabled';   -- on
```

The app reads the flag when it starts. A missing flag means on. A run already in progress when the flag
turns off is allowed to finish; the next start is not offered.

## Deleting a single run by hand (e.g. an obviously faked score)

First look it up:

```sql
select r.id, p.display_name, r.score, r.answered, r.started_at, r.finished_at
from public.adjective_drill_runs r
join public.profiles p on p.id = r.user_id
where p.display_name ilike '%NAME HERE%'
order by r.score desc
limit 20;
```

Then delete it by its `id`:

```sql
delete from public.adjective_drill_runs where id = 'PASTE-THE-UUID-HERE';
```

This is the only way to remove a result — the server checks timing and score ranges, but rounds are
generated in the browser, so a determined user could still fake one; this is the backstop.
