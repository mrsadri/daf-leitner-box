# Reward recovery and release sequence

This release implements the owner-approved rules in the November 18 request plan. Prepare a backup before applying SQL. Do not restore the whole database to the earlier snapshot: new activity must survive.

## Migration

Apply `supabase/migrations/20261118160000_restore_legacy_rewards.sql` before publishing this frontend. The migration is transactional when executed as one transaction, additive and safe to replay. The installed CLI exited 137 even outside the sandbox; the migration filename was created locally after that failure.

The production snapshot `release_backup_20261118_pr32` must still exist. Verify its manifest and row counts first:

```sql
select * from release_backup_20261118_pr32.manifest;
select count(*) from release_backup_20261118_pr32.review_events;
select count(*) from release_backup_20261118_pr32.review_events b
left join public.review_events c using(id) where c.id is null;
```

The investigation found 11,881 snapshot events and zero missing events. If either differs, stop to reconcile the source before treating historical events as accepted legacy activity. In clean installs there is no historical snapshot and no baseline is imported.

Run the migration with `begin;` before it and `commit;` after it. A failed statement must roll back the whole migration. It copies only snapshot event IDs into an inaccessible private schema; it does not mark arbitrary unverified activity as verified. Keep the snapshot for audit until recovery has been reviewed.

## Dry run and checks

Run `supabase/tests/recovery-report.sql` as the operator to obtain a per-account report including hidden profiles. Compare its accepted-review and silver counts to the snapshot and current history. Within the migration transaction, before commit, inspect `get_verified_leaderboard('all',500)` as the operator and compare card totals and silver with `get_leaderboard('all',500)`. Operator queries with no authenticated uid return visible accounts only. Audit hidden accounts directly with privileged SQL in addition to this comparison; do not expose their rows in a public report.

- Silver should reflect all accepted legacy and newly verified correct vocabulary days, at most one per day and 30 total. Do not add a fixed number to the local counter; server/device totals merge by maximum.
- Total score is current card boxes plus one catalog-sized reward per completed scene. Repeated quiz completion and migration replay do not duplicate rewards.
- The new streak intentionally differs from the old rule: positive Leitner movement, first scene completion and positive adjective runs count. Wrong-only review days do not count. Clients register their timezone on sign-in; historical timestamp-only activities use Asia/Tehran until the user registers a zone. Historic review_day is preserved.
- New balance events include card insertion, deletion and box changes. Historic review deltas before cutover are included by server receipt time in the last 168 hours. Historic manual/import/demotion timestamps cannot all be reconstructed exactly; this limitation must be shown in the release notes until the first 168 hours after cutover have elapsed. There is no fabricated historical movement.
- The balance ledger is private and has no browser grants. Migration backfills reward records without generating current-day balance or streak activity.
- Adjective legacy runs remain available, rankings use the first, second and third best scores, with shared ranks for equal tuples.

After committing, publish the preview and verify a returning account and a new account: restored silver, rank, scene reward once, and a positive/negative balance movement. Refresh and repeat on another device. Retain the pre-change function definitions in the snapshot for recovery; rolling the frontend back alone does not roll back database semantics.

## Publication

Run lint, unit tests, story tests/freshness, SQL replay/authorization tests, clean/upgrade equivalence, type freshness, production build and phone/desktop browser acceptance. Review the demo preview. Merge and deploy follow the repository's owner release authorization. This task prepares a candidate; production data changes and deployment have not been executed by the candidate build.
