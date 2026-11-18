# Reliability and verified-results rollout — owner execution guide

Status: implemented and tested locally; not applied to any hosted database. Repository rules prohibit this coding agent from accessing production. The owner executes hosted SQL through the established workflow.

## Migration order

Apply all previously unapplied migrations in lexical order. The five additions in this change are:

1. `20261118055307_reliability_guards.sql`: atomic story merge, quota locks, supported push destinations, review operation IDs, reminder-user leases.
2. `20261118062503_sync_protocol.sql`: revisioned atomic card/event/settings transactions, durable receipts, personal unverified history, canonical vocabulary registry, verified competitive totals.
3. `20261118063937_verified_adjective.sql`: versioned question bank, issued questions, immutable answer submissions, server-derived timed results and verified records board.
4. `20261118065033_reminder_delivery.sql`: per-device notification claims, attempt tokens, bounded retries and uncertain-delivery outcomes.
5. `20261118093910_verified_overdue_points.sql`: apply existing server-run overdue penalties to verified totals, without creating credit for personal-only history.

For clean installations use `supabase/schema.sql` then all migrations, as defined in `scripts/database-schema.mjs`. Existing projects apply only unapplied migrations. Never replay historical cleanup against live data without a separate review.

Apply server additions **before** the new frontend and reminder worker. The new client requires `apply_sync_batch`, verified leaderboard/silver/drill RPCs and story `quiz_score`; the worker requires both user leases and delivery RPCs. Deploying it first will fail saves.

## Owner-approved behavior

Review intervals and personal learning points remain unchanged. Competitive scores now count server-validated canonical vocabulary transitions and server-scored drill answers. Existing reviews, imported snapshots, custom cards and legacy raw-score submissions do not create competitive credit. Existing historical personal data is retained. Previously displayed competitive totals can therefore decrease at rollout; communicate this before releasing. Do not fabricate a backfill from unverified historical scores.

The client supplies `p_expected_user`; the sync RPC rejects a mismatch with `auth.uid()` so a request prepared for one account cannot accidentally apply under a subsequently changed session. Identity and ownership still derive from `auth.uid()`, never from this guard parameter. A saved batch receipt makes retries after a lost response idempotent. A stale revision causes reconciliation: independent changes survive; conflicting local cards/settings/events are retained under `daf_sync_conflicts_<uid>` for recovery while the server copy is displayed. Older queues without trustworthy baselines are conservatively quarantined. Download conflicts from Settings. Old clients retain their direct personal-save paths, but do not gain verified credit. Keep compatibility paths until adoption is reviewed.

Story saves use an ownership-protected atomic merge trigger rather than an extra RPC: this also protects already-open older clients. Highest page and earliest completion survive. Content-version changes do not reset completed stories; any future reset needs an explicit content migration.

## Staging checklist — owner, assisted by Astra High

- [ ] Restore/copy only approved synthetic or sanitized fixtures to a separate staging project; disable reminders initially.
- [ ] Record installed schema/migration history; compare grants, policies, functions and jobs with the repository. Apply the five new migrations in order and replay them in staging.
- [ ] Exercise hosted Auth refresh, suspended accounts, user A/B isolation, PostgREST RPC signatures and RLS. Local Auth stubs do not prove hosted configuration.
- [ ] Submit a batch, lose its response, retry its operation UUID, then verify one receipt/event and unchanged second result.
- [ ] Open two clients, review/change/delete the same card and independently edit settings; confirm conflict recovery and no deleted-card resurrection.
- [ ] Test a legacy pending queue and an old open client. Confirm personal history is retained and competitive credit follows the policy above.
- [ ] Check new verified leaderboard, silver totals, hidden users, ties, demotions and server deadlines with synthetic data.
- [ ] Start a timed drill, submit answers, replay an answer, try another user's run and a fabricated legacy score; only the server-derived result appears in the verified board.
- [ ] Test valid browser push providers used by the audience; reject unsupported hosts/redirects. Test overlapping cron runs, failed devices and expired subscriptions.
- [ ] Check actual deployed headers and OAuth/resource loading under the report-only CSP. Review violations before deciding to enforce it.
- [ ] Rehearse a staging database restore and record retention, operator, recovery time and lost-data window using `docs/offline-and-recovery.md`.

## Reminder outcomes and observability

Each user has a five-minute worker lease. Each subscription/job key has its own attempt token and claim. Concurrency is capped at three device requests per user, each with a ten-second timeout. Explicit HTTP failures retry at most three times. Sent and expired devices are terminal; other failed devices can retry without resending successful devices.

A timeout/network loss or crash after claiming can leave delivery uncertain. Those attempts become terminal `unknown` and are not automatically resent: a missed notification is preferred to repeated notifications. This is not an exactly-once guarantee from the external push provider. `delivered` counts confirmed HTTP success; `uncertain` counts current uncertain outcomes. Historical `overtakeSent`/`inactivitySent` fields count completed logical jobs, including terminal outcomes, rather than guaranteed user-visible delivery. Never log endpoint bodies or private card contents.

Retain operation receipts while clients may replay them; no automatic receipt deletion is introduced. Monitor table growth and oldest pending queues before defining a retention window. Retain delivery terminal records for at least the full notification retry/replay window; do not clear them during a running job. Any future pruning job requires separate owner review and replay tests.

## Release and recovery

Local code and test results are review evidence, not production authorization. Prepare a PR and demo preview, obtain owner review in both languages, then follow `CLAUDE.md`'s exact PR-specific merge/deploy authorization. Record the frontend/worker revisions and migration versions.

An older frontend can continue personal saves against the additive schema. Rolling it back does not undo verified scoring, triggers, receipts or history. Keep these data protections during a UI rollback. Correct database defects with a reviewed forward migration. Restore deleted data only through the documented operator recovery procedure; preserve original card IDs and per-user queues.
