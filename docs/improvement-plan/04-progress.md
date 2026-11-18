# Implementation progress — 18 November 2026

All current changes are in `/Users/masih/Documents/Codex/2026-11-18/i-x20/daf-leitner-box`.
The earlier `/Users/masih/Documents/ChatGPT/daf/daf-leitner-box` checkout is stale.
Baseline: `5d9f576758fe5ec93837916a7793d04aa88081f3`. Changes are prepared on `codex/production-readiness`; see the PR for the review head. Nothing is deployed.

Work has addressed all 25 review areas, but **12 tasks remain incomplete overall: 7, 8, 11, 13, 14, 16, 19, 20, 21, 22, 23 and 25**. Further local verification also remains. This does **not** close staging, independent review, upstream remediation or release gates. Unchecked tasks remain explicit in the to-do/checklist; see [owner handoff](05-owner-handoff.md).

## Local verification

- 220 unit/integration tests pass.
- TypeScript and oxlint pass with zero warnings.
- Eleven SQL suites pass with baseline installation and migration replay in isolated PostgreSQL; a deliberate disabled-RLS negative control is detected.
- Native PostgreSQL 16 passes the SQL suites and actual two-connection revision, quota and story-merge races, plus atomic replacement at quota.
- 60 demo browser tests pass across desktop/phone, Persian/English, 320/390px large text, backups, content failures, story URLs, word traversal and nested dialogs.
- 28 Python content tests and generated-story check pass.
- Database type drift and 1,422-question server-bank drift checks pass.
- Clean-install/legacy-upgrade equivalence passes for schema/default/column/relation grants, views, sequences, constraints, indexes, policies, functions, triggers and jobs; legacy cards/stories are preserved.
- Configured production build (placeholder public Supabase URL/key) succeeds. No real hosted credentials are used.
- Fresh dependency audit: five high findings remain, tracked in `docs/dependency-security.md`.

“Implemented locally” means the code exists with the stated evidence. It does not mean production data, Auth/PostgREST, push delivery or owner usability checks were verified.

## Coverage register

| ID | State | Evidence / remaining work |
|---|---|---|
| 01 | Implemented locally | Atomic batches archive expired/unverified events without dropping valid events; mixed-batch and receipt regressions. |
| 02 | Implemented locally | apply_sync_batch commits card/event/settings together with durable operation receipts; SQL rollback and client lost-response tests. |
| 03 | Implemented locally | Serialized revision-aware story saves, bounded retries, reload replay and visible save status; delayed-save tests. |
| 04 | Implemented locally | Atomic ownership-protected merge trigger covers new and legacy clients; two-connection native story tests pass in both submission orders. |
| 05 | Implemented locally | Server revisions; card/delete/settings conflict quarantine and downloadable recovery; stale-card and independent-settings tests. |
| 06 | Implemented locally | Server-issued versioned drill questions, immutable timed answers, server-derived results; canonical review transitions and verified-only rankings/silver. |
| 07 | Partial — acceptance pending | Provider allowlist, registration guard, redirect refusal, ten-second timeout; mocked request-boundary, pure and SQL validation tests. Real provider/runtime tests remain owner staging. |
| 08 | Partial — acceptance pending | Generation barriers and account-scoped queues/callbacks; delayed-start, old-save/new-account and delayed-sign-out regressions. Sign-out explains preserved cards/stories and discarded pending contests. |
| 09 | Implemented locally | Native two-connection quota race, existing upsert at limit and atomic delete/insert replacement pass. Quota-specific bilingual feedback preserves pending work. |
| 10 | Verified locally and in GitHub CI | Hosted build and database jobs passed at `33f0583`; negative RLS control and migration/concurrency checks run in CI. |
| 11 | Partial — acceptance pending | Shared baseline plus lexical migrations, replay, generated-type drift and clean-install/legacy-upgrade equivalence checks. Historical overlap retained for compatibility; owner compares installed schema before upgrade. |
| 12 | Implemented locally; hosted data audit pending | Constrained story IDs/counters, atomic page/completion merge, quiz-score synchronization and version compatibility policy. |
| 13 | Partial — acceptance pending | Verified leaderboard measured with 100 users, 10k cards, 200k events; candidate index p50 59.18→58.60ms, p95 65.08→60.63ms. Plans recorded; no speculative index shipped. |
| 14 | Partial — acceptance pending | Per-user leases plus per-device job keys/attempt tokens, concurrency 3, timeout 10s, explicit failure retry cap 3; uncertain delivery terminal to avoid duplicate retries. |
| 15 | Implemented locally | Generated Database types, typed Supabase client and runtime validation for cards/settings/backups/card queues/story queues/drill queues; invalid data retained with recovery export. |
| 16 | Partial — acceptance pending | Recoverable session/catalog/content startup, retry and application boundary; bilingual story-network fault browser tests pass. |
| 17 | Implemented locally | Lint has zero warnings and fails new warnings. Story transport/store, queue validators, review helper and cloud read/admin APIs separated; regressions pass. |
| 18 | Implemented locally | 10MB/10k-card import bounds, preview counts, merge/replace confirmation, pre-import recovery snapshot; engine round trips and browser cancellation pass. |
| 19 | Partial — acceptance pending | Card/review/drill pending/error/retry signals, last successful card/story save, story pending counts, conflict history and sign-out explanation; storage-full card/story tests; durable-write confirmation before every network retry, with visible storage warning. |
| 20 | Partial — acceptance pending | URL-backed main tabs and validated book/story/page routes; Back/Forward/reload/locked-link browser tests, roomier mobile labels. 320px/large-text human review remains. |
| 21 | Partial — acceptance pending | Reader word roving navigation, page focus and shared modal stack/inertness; automated focus/keyboard tests. Human screen-reader review remains. |
| 22 | Partial — acceptance pending | nosniff/frame/referrer/permissions headers and report-only CSP in vercel.json. Hosted OAuth/header/violation review and CSP enforcement are release gates. |
| 23 | Open — dependency remediation pending | Fresh audit still reports five high findings; proposed automatic fixes are major toolchain downgrades. Exposure/mitigation documented; weekly npm/Actions Dependabot PR configuration added. Compatible upstream remediation remains open. |
| 24 | Implemented locally | Version 2 backup includes cards/settings/local stories; exclusions explained; legacy/current engine round trips pass. Ranked history cannot be imported. |
| 25 | Partial — restore pending; offline feature deferred | Owner accepted offline-after-load scope; cold-offline restart deferred. Operator restore rehearsal and recovery targets require owner staging workflow. |

## Rollout and recovery

Five additive migrations are required **before** deploying the new frontend/worker. Follow `docs/supabase-reliability-setup.md`. Competitive totals deliberately exclude old unverified reviews/raw scores; personal learning data and intervals remain. Communicate the ranking change before release. Old clients retain personal save paths.

No hosted database was accessed; no migration was applied in production. No PR was merged and no deployment was attempted. Repository rules reserve production SQL for the owner and require the exact PR-specific merge/deploy sentence.

## Follow-up implementation pass

- An old in-flight request no longer delays the next account. Its completion cannot clear the new account's flush or delayed sign-out state.
- Synchronous storage failure no longer leaves a completed flush promise stuck in the coordinator. Every network attempt reconfirms local durability; repeated failures keep the batch in memory and show a warning. Sign-out text distinguishes durable local data from memory-only changes.
- Push destination, redirect and timeout policy now lives in a tested request boundary, including rejection before any fetch. The single-file Dashboard worker includes the generated helper.
- `npm run db:upgrade:check` compares a clean install with an upgraded legacy-fixture database, including replay. It runs in CI; hosted installed-schema inspection remains an owner gate.
- CI's production build now includes the signed-in application using public placeholders. Dependabot proposes weekly npm/Actions updates after the configuration is pushed; it does not auto-merge or deploy.

The sync client now also passes `p_expected_user`. The database compares it with `auth.uid()` before reading or applying the batch, rejecting an authentication switch during request preparation. The SQL regression verifies a mismatched account leaves the revision unchanged. This changes only the as-yet-unreleased additive sync migration; production remains untouched.

## Release-candidate follow-up

Catalog and lazy-screen failure/recovery tests now run in both languages; nested-dialog tests also cover both languages. Expired authentication retains the same durable batch for retry. Deno type-check and two real push crypto tests pass with fake transport; pinned Deno dependency checks run in CI. A fifth migration/test connects the existing server overdue penalty to verified points. Hosted and human gates remain open under the owner’s explicit local-testing-only choice. See `docs/release-readiness.md`.

PR [#32](https://github.com/mrsadri/daf-leitner-box/pull/32) is committed and pushed. [GitHub CI](https://github.com/mrsadri/daf-leitner-box/actions/runs/44278415253) passed at `33f0583`. The PR remains a draft because the production holds are not cleared.
