# Release candidate: readiness and hold points

Branch: `codex/production-readiness`. Baseline: `5d9f576758fe5ec93837916a7793d04aa88081f3`.

**Status: production database rollout complete; final CI, merge and publication in progress.** After initially selecting local testing only, the owner explicitly authorized a production release and override of the repository access/wording restrictions on 18 November 2026. No staging resources were created.

## Verified locally

- 220 Node unit/integration tests; 60 Playwright tests on phone/desktop in Persian/English.
- 28 Python story tests and generated-content freshness.
- TypeScript/oxlint: zero warnings; configured production build succeeds with public placeholders.
- Twelve isolated SQL suites, migration replay and a negative RLS mutation control.
- Native PostgreSQL assertions and two-connection revision/quota/story races, including replacement at quota.
- Clean-install versus legacy-fixture upgrade equivalence, including permissions, functions, policies, triggers and jobs.
- Deno worker type-check and two real web-push crypto/transport-boundary tests, using synthetic keys and a fake fetch. No browser push provider was contacted.
- Generated database types, 1,422 server questions and single-file worker helpers are current.

These checks run in CI as well; see the PR for the exact head and hosted job results.

## Required database sequence

The owner must apply the following additive migrations through the documented operator workflow **before** the new frontend/worker is deployed:

1. `20261118055307_reliability_guards.sql`
2. `20261118062503_sync_protocol.sql`
3. `20261118063937_verified_adjective.sql`
4. `20261118065033_reminder_delivery.sql`
5. `20261118093910_verified_overdue_points.sql`

Follow `docs/supabase-reliability-setup.md`. New clients require the new RPCs. An automatic production deployment before this sequence can break signed-in startup/saves. The final migration preserves the existing server-run overdue penalty in verified totals; it does not change learning intervals or the penalty rule.

## Not verified / not closed

- Installed hosted-schema comparison, Auth refresh/PostgREST, real provider delivery and a measured hosted restore rehearsal.
- Independent security review, human screen-reader/usability review and the owner's preview review.
- Actual deployed security headers, OAuth/resource compatibility and CSP enforcement. CSP remains report-only.
- Five high dependency audit findings from the picomatch advisory remain. Latest queried picomatch is 4.0.7; no compatible reviewed patch was established. See `docs/dependency-security.md`.
- Competitive totals intentionally exclude legacy/imported unverified credit and can decrease at rollout; communicate this change.

Cold-offline reopening remains the owner's accepted deferral. Local checks do not establish recovery objectives or production backup retention.

Do not remove these holds by checking boxes without evidence. Merge/deploy authorization and production SQL execution follow `CLAUDE.md`; this document does not grant them.

## Production database evidence

Snapshot captured 18 November 2026 at 10:57 CET. Before/after counts match: profiles 32, cards 5,937, reviews 11,881, story progress 13, drill runs 17. Six recorded operations comprise the private snapshot and five release migrations. Verified API signatures, quota trigger, 3,460 canonical IDs, 1,422 active questions and restricted verification/delivery privileges all pass. The snapshot remains private and no learner data was exported to Git.
