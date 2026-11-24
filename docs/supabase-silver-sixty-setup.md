# Silver cards: 30 → 60 (owner guide)

The app now has 60 silver cards. The server counts silver cards in two functions and still caps them at 30. This migration raises the cap to 60 and changes nothing else: same rule (more than 15 correct vocabulary answers on a day, one card per day), same data, same permissions.

**File:** `supabase/migrations/20261124150000_silver_sixty.sql`

- It is idempotent (`create or replace`), and the SQL tests run it twice.
- It doesn't touch any table or row.
- It replaces only `get_verified_leaderboard` and `get_verified_silver_status`. Their signatures and grants are unchanged.

## Order

The new frontend and this migration can be released in either order:

- **Frontend first, migration not yet run:** the server keeps reporting at most 30, and learners stop at card 30 until the migration runs.
- **Migration first, old frontend:** the old app limits the count to its own 30, so nothing breaks.

The recommended order is: merge and deploy the frontend, then run the migration the same day.

## Steps (Claude Desktop, Supabase SQL editor)

1. **Check the current cap (read only).** This should return `30` for any learner who has more than 30 earning days. Today no one can have more than about 25, because cards started on 2026-10-31.
   ```sql
   select count(*) as earning_days_max from (
     select user_id, review_day from public.review_events
     where correct and card_type = 'vocab' and review_day >= date '2026-10-31'
     group by user_id, review_day having count(*) > 15
   ) d group by user_id order by 1 desc limit 1;
   ```
2. **Run the migration in one transaction.** Paste `begin;`, then the whole file, then `commit;`.
3. **Verify:**
   ```sql
   select position('least(60' in pg_get_functiondef('public.get_verified_silver_status(date)'::regprocedure)) > 0 as status_60,
          position('least(60' in pg_get_functiondef('public.get_verified_leaderboard(text,integer)'::regprocedure)) > 0 as board_60;
   ```
   Both should be `true`.

## Rollback

Run the two function definitions from `20261118160000_restore_legacy_rewards.sql` (`get_verified_silver_status`) and `20261118161029_local_streak_day_bounds.sql` (`get_verified_leaderboard`) again. No data needs to be restored.
