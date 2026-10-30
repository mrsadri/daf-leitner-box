# Supabase setup: overdue rule, leaderboard notification, silver cards (no more class reminder)

For the Supabase dashboard of the **daf-leitner-box** project, done in the browser.

**What changes:**
- **Additive objects:**
  - one table `overdue_demotions`;
  - four functions: `apply_overdue_demotions`, `mark_overdue_demotions_seen`, `leaderboard_ranks`, `get_silver_status`;
  - two columns on `push_state`;
  - one scheduled job.
- **`get_leaderboard`:** recreated with one extra column (`silver`, the number of silver cards). For a second during the migration the leaderboard may not load.
- **Edge Function `send-reminders`:** gets new code. The class-break reminder is removed and the leaderboard notification is added.
- **Card data:** changes only in step 3, by the agreed rule:
  - a card not reviewed within 3 days of its due date moves to the start of the previous box;
  - this is applied retroactively to everyone.

**Rules for whoever does this:**
- Run only the SQL given here.
- Never run anything from `supabase/tests/`.
- Stop and report if a step shows an error.

Files are on GitHub (public), branch `main`. Raw URLs:
- Migration: https://raw.githubusercontent.com/mrsadri/daf-leitner-box/main/supabase/migrations/20261030_overdue_overtake.sql
- Edge Function: https://raw.githubusercontent.com/mrsadri/daf-leitner-box/main/supabase/functions/send-reminders/index.ts

## 1. Database migration (changes no card)

SQL Editor → New query → paste the **full** contents of the migration file → Run.

Expected:
- no error;
- the last result shows a number, the id of the new cron job.

Notices such as "already exists, skipping" are fine.

Check (should return 5 rows):

```sql
select routine_name from information_schema.routines
where routine_schema = 'public'
  and routine_name in ('apply_overdue_demotions', 'mark_overdue_demotions_seen', 'leaderboard_ranks',
                       'get_silver_status', 'get_leaderboard');
```

## 2. Dry run (shows the effect, changes nothing)

```sql
select * from public.apply_overdue_demotions(true);
```

The result has three columns:
- `users_affected`;
- `cards_moved`;
- `moves`, for example `{"3→2": 40, "5→1": 3}`.

**Write these numbers down and report them.**

## 3. Apply the rule now

```sql
select * from public.apply_overdue_demotions();
```

Expected: the same numbers as the dry run, or very close to them.

Check:

```sql
select count(*) as log_rows, count(distinct user_id) as users from public.overdue_demotions;
```

From now on the job `daf-overdue-demotions` runs every night at 00:05 Tehran time.

Check the job:

```sql
select jobname, schedule, active from cron.job order by jobname;
```

Expected: `daf-overdue-demotions | 35 20 * * * | true`, next to the existing `daf-send-reminders`.

## 4. Edge Function `send-reminders`: new code

1. Edge Functions → `send-reminders` → Code (editor).
2. Replace **all** the code with the full contents of the Edge Function file (raw URL above) → Deploy.
3. Keep "Enforce JWT verification" **off**, as before.
4. Secrets and the 15-minute cron job stay as they are.

## 5. Check the function (after the next 15-minute run)

```sql
select status_code, left(content::text, 300) as content
from net._http_response order by created desc limit 3;
```

Expected: `status_code` 200, and JSON with `"overtakeSent"`, not `"classSent"`.

Also check the ranks function:

```sql
select count(*) from public.leaderboard_ranks();
```

Expected: the number of users visible on the leaderboard.

## Undo / stop (only if something goes wrong)

- Stop the nightly rule: `select cron.unschedule('daf-overdue-demotions');`
- Notifications: `select cron.unschedule('daf-send-reminders');` stops all push notifications.

Cards already moved are not moved back automatically. The log `overdue_demotions` keeps `card_id`,
`from_box`, `to_box` and `demoted_on` for every move (for 60 days after the user has seen it), so the boxes
could be restored if ever needed.
