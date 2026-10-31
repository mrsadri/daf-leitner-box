# Supabase setup: public insight cards

For the Supabase dashboard of the **daf-leitner-box** project, done in the browser.

**What changes (additive only, no existing row is changed):**
- two new tables: `shared_insights` and `insight_reports`, closed to direct access;
- new functions:
  - `share_quota`, `publish_insight`, `unpublish_insight`;
  - `get_public_insights`, `adopt_insight`, `report_insight`;
  - `insight_attribution`, `my_insights`;
  - `admin_list_insights`, `admin_remove_insight`, `admin_keep_insight`;
  - helpers: `insight_open_reports`, `insight_is_live`, `guard_shared_copies`;
- **one trigger on `cards`** (`cards_guard_shared_copies`). It only looks at card ids starting with `shared_`, which don't exist yet. Every other card goes through unchanged.
- **one small index on `cards`**, covering only `shared_…` ids. It is built in well under a second; card saves wait for that moment.

The current app keeps working before and after. The new app needs this migration for the public cards; without it, only the public cards part shows a "couldn't load" message.

**Rules for whoever does this:**
- Run only the SQL given here.
- Never run anything from `supabase/tests/`.
- Stop and report if a step shows an error.

Migration file (GitHub, public):
https://raw.githubusercontent.com/mrsadri/daf-leitner-box/feature/shared-insights/supabase/migrations/20261101_shared_insights.sql
(after the merge it is also on `main`, same path).

## 0. Before: card count (read only)

```sql
select count(*) as cards, count(*) filter (where left(id, 7) = 'shared_') as shared_cards from public.cards;
```
Write both numbers down. `shared_cards` should be 0.

## 1. Migration

SQL Editor → New query → paste the **full** contents of the migration file → Run.

Expected: no error. Notices such as "does not exist, skipping" are fine.

## 2. Checks (read only)

```sql
-- a) 14 rows
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('share_quota', 'publish_insight', 'unpublish_insight', 'get_public_insights', 'adopt_insight',
                       'report_insight', 'insight_attribution', 'my_insights', 'admin_list_insights',
                       'admin_remove_insight', 'admin_keep_insight', 'insight_open_reports', 'insight_is_live',
                       'guard_shared_copies')
order by 1;

-- b) the trigger: 1 row
select tgname from pg_trigger where tgrelid = 'public.cards'::regclass and tgname = 'cards_guard_shared_copies';

-- c) new tables empty, RLS on: shared 0, reports 0, both rls true
select (select count(*) from public.shared_insights) as shared,
       (select count(*) from public.insight_reports) as reports,
       (select relrowsecurity from pg_class where oid = 'public.shared_insights'::regclass) as rls_shared,
       (select relrowsecurity from pg_class where oid = 'public.insight_reports'::regclass) as rls_reports;

-- d) the app's users can't read the tables directly: both false
select has_table_privilege('authenticated', 'public.shared_insights', 'select') as shared_readable,
       has_table_privilege('authenticated', 'public.insight_reports', 'select') as reports_readable;

-- e) card count unchanged (same numbers as step 0, apart from cards people saved in the meantime)
select count(*) as cards, count(*) filter (where left(id, 7) = 'shared_') as shared_cards from public.cards;
```

Report the results of steps 0 and 2.

## Undo (only if something is wrong)

This removes everything the migration added. Public cards and their copies are lost; nothing else is touched.

```sql
drop trigger if exists cards_guard_shared_copies on public.cards;
drop function if exists public.guard_shared_copies();
drop index if exists public.cards_shared_copy_idx;
drop function if exists public.admin_keep_insight(uuid), public.admin_remove_insight(uuid), public.admin_list_insights(),
  public.my_insights(), public.insight_attribution(uuid[]), public.report_insight(uuid, text), public.adopt_insight(uuid, date),
  public.get_public_insights(integer, timestamptz), public.unpublish_insight(uuid), public.publish_insight(text),
  public.share_quota(), public.insight_is_live(uuid), public.insight_open_reports(uuid);
drop table if exists public.insight_reports, public.shared_insights;
```
