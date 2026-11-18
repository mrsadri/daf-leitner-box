# Backlog acceptance follow-up — 18 November 2026

Branch: `codex/backlog-acceptance`, based on published PR #32 (`1f38dc2`). This candidate is not deployed. No production database changes or notifications were made during this pass; the public release checker used anonymous GET requests only.

## Current scope and outcome

| Task | Outcome in this pass | Remaining requirement |
|---|---|---|
| 8 | Local acceptance passes: initial Auth races, unsubscribe/stale callbacks, expired token, delayed drill start/finish and account-scoped queues. New RPC guards expected account before startup. | Review/release this candidate and apply its additive migration before the frontend. Full interactive Google sign-in is not claimed. |
| 13 | Verified board visibility, ties, streaks, silver, and candidate-index result equivalence pass. Synthetic 100-user/10k-card/200k-event benchmark and plans recorded. | Representative hosted/staging performance evidence. |
| 14 | Full handler test uses real Supabase SDK and push encryption with fake HTTP. It overlaps invocations, caps concurrency at 3, retries only failed devices, then loses a receipt after provider success and fails bookkeeping; the repeat sends no duplicates. | Real provider/device delivery belongs to provider acceptance; no notification was sent by these tests. |
| 16 | Session load failure/retry and stale-read handling tested in controller; catalog and lazy-chunk failure recovery tested in both languages in browsers. | Candidate review/release. |
| 19 | Storage-full/offline/rejected/partial/concurrent drill finishes tested alongside existing card/story fault tests; sign-out warning/cancellation verified in both languages. Cleared sessions cannot resurrect finishes. | Candidate review/release. |
| 20 | 320/390px, large text, history/deep links and drill-abandon guard tested; screenshots inspected. Fixed a Persian install-banner layout defect and added a width/stacking regression. | Candidate review/release; no human usability study is claimed. |
| 21 | Nested dialogs in both languages tested for topmost Escape, focus trapping/restoration and inert background; reader word navigation tested. Lookup group is named and UI instructions have the correct language instead of inheriting German. | Actual assistive-technology/screen-reader observation. |
| 22 | Reproducible public release checker verifies live headers, same-origin scripts/styles/fonts, story index, privacy page and worker asset. | Interactive OAuth, real push/provider checks and CSP enforcement decision. Policy remains report-only. |
| 23 | Fresh audit still reports 5 high findings; current queried picomatch is 4.0.7. Existing maintenance configuration retained. | Compatible reviewed upstream remediation; no force downgrade or advisory suppression. |
| 25 | Synthetic native dump/restore rehearsal passes with data/schema/grants/policies/triggers/jobs preserved and post-snapshot write excluded. | Hosted/independent disaster restore, owner-approved retention and a hosted test against the agreed 24-hour RPO / 4-hour RTO. Cold-offline reopening remains deferred. |

Passing local acceptance is not the same as deployment. Tasks 13, 21, 22, 23 and 25 retain substantive staging/human/upstream/operator requirements. The scoped startup migration is documented in `docs/supabase-scoped-drill-setup.md`.

## Evidence

- 227 Node tests; 68 demo browser tests; 14 SQL suites; 3 Deno tests.
- TypeScript/oxlint: zero warnings. Configured production build and schema/type/question/helper checks pass.
- Native restore fixture: 10,011 cards, 5 users, 705 reviews, 1 story row. Backup 239,464 bytes; dump 0.081s; restore 0.118s; validation 0.08s. This is same-cluster synthetic evidence, not a production RTO/RPO.
- Candidate-index benchmark p50: 60.26 → 59.45ms; p95: 63.99 → 60.52ms. No production index was added.
- Machine-readable restore, benchmark and anonymous release reports accompany the output Markdown files.

The owner accepted a 24-hour maximum data-loss window and 4-hour recovery target on 18 November 2026. Hosted validation is still pending. CI prefers the runner’s installed Chrome (the same PW_EXE path mechanism used locally) and falls back to Playwright Chromium installation if Chrome is absent.
