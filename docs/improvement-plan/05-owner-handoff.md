# Remaining gates and owner handoff

Updated 18 November 2026. 13 tasks remain incomplete overall; see [corrected remaining requirements](06-incomplete-tasks.md). Some remaining verification is locally actionable; this file focuses on owner/environment gates. Suggested models remain advisory assignments, not evidence of a separate Astra review.

## Decisions used

- **D1/D2/D3 — explicitly approved by owner:** preserve Leitner intervals/personal points; old offline reviews remain personal history without competitive credit; server revisions resolve conflicts; only server-validated results enter competitive rankings.
- **D5 — explicitly approved by owner:** backup preview with merge/replace confirmation; versioned export includes local story progress. Ranked history and contest results are excluded and cannot be restored as verified results.
- **D6 — explicitly approved by owner:** explain offline limits; defer cold-offline reopening. Recovery objectives/hosted backup retention still require the operator's decision.
- **D4 — compatible implementation choice:** synchronize quiz score, retain highest page and earliest completion; content-version changes do not erase completion. A future reset needs an explicit migration/owner decision.
- **D7 — implementation choice awaiting usability review:** scrollable mobile navigation with labels and URL-backed destinations/book/story/page. Human usability and screen-reader review remain open.

## Required before release

- [ ] **Independent security/data-integrity review — suggested AI: Astra High, with human reviewer.** Review revision/receipt transactions, ranked scoring, grants/RLS, challenge deadlines, queue recovery and worker delivery semantics. No independent reviewer is claimed.
- [ ] **Hosted CI at the review revision — suggested AI: Sol High.** Run the committed workflow, preserve artifacts and record the PR head. Local checks pass; there is no pushed/committed review revision yet.
- [ ] **Installed-schema comparison and staging upgrade — owner, assisted by Astra High.** Local clean/legacy-upgrade equivalence now passes. Compare actual hosted functions/grants/policies/jobs/migrations to Git. Follow `docs/supabase-reliability-setup.md`; local stubs cannot validate hosted Supabase configuration.
- [ ] **Hosted integration — owner, assisted by Astra High.** OAuth/session refresh, suspended users, PostgREST RPC grants/signatures, two-device conflicts, old clients/queues, verified totals and actual browser push providers.
- [ ] **Representative hosted performance — owner, assisted by Sol High.** Repeat `scripts/benchmark-leaderboard.mjs` methodology with sanitized representative distributions. Local synthetic evidence found only a small candidate-index improvement; no extra index was shipped.
- [ ] **Human UI/accessibility review — owner/tester, assisted by Sol High.** Persian/English, 320/390px, large text, reading controls, nested dialogs, keyboard and an actual screen reader. Automation checks focus behavior; it cannot establish human usability.
- [ ] **Deployed headers/CSP review — owner, assisted by Astra High.** Confirm actual response headers, OAuth/assets/push and report-only violations. Enforcement is a separate decision after this evidence.
- [ ] **Dependency finding disposition — maintainer, assisted by Sol Medium.** Five high audit findings remain. Weekly npm/Actions Dependabot proposals are configured for when this change is pushed. Review from 25 November 2026 and before releases; see `docs/dependency-security.md`.
- [ ] **Staging restore rehearsal — owner/operator, assisted by Astra High.** Record backup retention, responsible operator, recovery time/data-loss targets and measured results. No production recovery or database access is authorized here.
- [ ] **Preview/release approval — owner.** Review a demo preview, communicate the verified-ranking transition and follow the exact PR-specific authorization in `CLAUDE.md`. Apply compatible migrations before deploying frontend/worker.

## Accepted deferral

Cold-offline reopening is deferred. Current support is offline use after loading plus local queued saves; browser eviction/restart may make the app unavailable. Review caching when the owner prioritizes this feature. This is an accepted scope decision, not a passing cold-offline test.

## Operational semantics to review

Pending card/story data stays on the same device for the same account. Conflicting local proposals are downloadable. Invalid storage is retained rather than overwritten, with a raw local recovery download; that recovery file contains private local data and should be handled as a backup. Signing out explicitly explains that pending contest finishes/current contests are discarded.

Reminder timeouts and crash outcomes can be uncertain. Automatic retries stop for uncertain delivery to avoid repeated notifications; some reminders can be missed. Retain receipts/delivery keys through replay windows and define any pruning separately. Personal histories remain available; verified rankings exclude historical unverified credit and may be lower at rollout.

## Files and status

Canonical checkout: `/Users/masih/Documents/Codex/2026-11-18/i-x20/daf-leitner-box`.
Deliverable copies: `/Users/masih/Documents/Codex/2026-11-18/i-x20/outputs`.
Changes are prepared on `codex/production-readiness`; see the PR for the review head. Nothing has been merged, deployed or applied to production.

The owner explicitly selected local testing only for this pass. Hosted staging was not provisioned, so its acceptance items remain unverified. See `docs/release-readiness.md` for the production deployment hold and five-migration sequence.
