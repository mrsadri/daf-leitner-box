# DaF & Mind — application review and improvement backlog

Reviewed: **18 November 2026**  
Repository: **mrsadri/daf-leitner-box**  
Revision: **5d9f576758fe5ec93837916a7793d04aa88081f3**

## Overall assessment

The existing React/Vite application has a sensible feature-based structure, shared UI primitives, bilingual RTL/LTR support, server-side ownership policies, and a substantial fast test suite. Keep these foundations. The highest-value work is reliable synchronization and recovery, followed by verification of competitive scores and database behavior. A framework rewrite is not justified by this review.

This is a source-backed review and improvement plan, not a certification of the live deployment. “Verified in source” identifies an observable implementation condition; it does not imply a production incident occurred. P1 means address in the next reliability/security cycle; P2 means schedule next. Effort: S = focused change, M = several coordinated changes, L = design and integration work. These are relative sizes, not delivery promises.

## Scope and evidence limits

- Inspected backend integration, Supabase schema and migrations, the reminder Edge Function, frontend architecture, UI implementation, and security-sensitive paths.
- **Production Supabase was not connected to or queried.** The repository's [CLAUDE.md](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/CLAUDE.md#L16) states: “Never connect to, query or change the production Supabase database from this machine.” Database findings describe the repository's intended structure; installed migrations, actual grants, Auth settings, scheduled jobs, backups, query plans, and platform controls remain to be verified by the owner or in staging.
- UI recommendations are based on source and existing test definitions. The in-app browser timed out twice; Playwright's Chrome process aborted before tests could run. No screenshot-based visual inspection, screen-reader check, or measured contrast assessment is claimed.
- No production writes, deployment, commits, or pushes were performed. Application source remains unchanged. Dependencies were installed locally, and a demo server responds at `http://127.0.0.1:3000/`.

## Checks performed

| Check | Result |
|---|---|
| `npm ci --no-audit --no-fund` | Succeeded |
| `npm run lint` | Succeeded, with 19 warnings |
| `npm test` | 190 passed, 0 failed |
| Python story tests | 28 passed |
| Story content `--check` | Succeeded |
| `npm run build` | Succeeded; unconfigured production build, not a validation of live Auth/database behavior |
| Demo HTTP preview | HTTP 200 at localhost port 3000 |
| `npm run e2e` using installed Chrome | Blocked before assertions by browser launch failure (`SIGABRT`, `kill EPERM`); not evidence of app test failures |
| Local SQL harness | Blocked during `initdb` by OS shared-memory permission error; SQL assertions did not run |
| Controlled story-store race reproduction | Confirmed a newer in-flight save loses its pending marker; transport and browser storage mocked, no database access |
| `npm audit --json` | Six high-severity affected packages from one underlying picomatch advisory; no automatic fix reported |

## Architecture and database map

```text
React feature screens → Leitner engine → per-user local cache / pending writes
                                      → Supabase Auth + PostgREST/RPC + PostgreSQL RLS
Story reader → separate story-progress store → story_progress
Adjective drill → separate result queue → start/finish RPCs
Scheduled work → overdue database job / reminder Edge Function → push providers
Vercel → static app, vocabulary CSV, story JSON, fonts and images
```

| Data area | Repository objects | Review focus |
|---|---|---|
| Accounts | `auth.users`, `profiles`, `app_admins` | Ownership, suspension, restricted profile columns, session lifecycle |
| Learning | `cards`, `review_events` | Composite card identity, retries, quotas, event validity and atomicity |
| Stories | `story_progress`, `app_flags` | Concurrent merges, legacy field names, validation and quiz data |
| Adjective contest | `adjective_drill_runs`, start/finish/board RPCs | Server timing, ownership, idempotent finish, client-asserted score |
| Notifications | `push_subscriptions`, `push_state`, reminder worker | Destination validation, retries, concurrency, timeout bounds |
| Scheduled demotion | `overdue_demotions`, overdue job | Conflicts with delayed client writes |
| Removed features | Cleanup migration, temporary backup table | Reproducible installation and owner-managed retention |

Existing strengths include per-user RLS, column-restricted profile updates, restricted admin tables, PKCE login, idempotent adjective finishing, a shared modal component, and demo-mode isolation. Preserve and extend these controls. RLS must be validated with real roles in a disposable environment; it is not a substitute for validating business rules. [Supabase RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Prioritized backlog

| ID | Priority | Area | Improvement | Effort |
|---|---|---|---|---|
| 01 | P1 | Backend / data integrity | [Preserve valid reviews when an offline batch contains an expired event](#item-01) | M |
| 02 | P1 | Backend / data integrity | [Make review submission idempotent and transactional](#item-02) | L |
| 03 | P1 | Backend / story sync | [Keep newer changes pending while a story save is in flight](#item-03) | S |
| 04 | P1 | Database / story sync | [Merge story progress atomically in PostgreSQL](#item-04) | M |
| 05 | P1 | Backend / card sync | [Define conflict handling for cards and settings across devices](#item-05) | L |
| 06 | P1 | Security / scoring | [Make competitive results server-verifiable](#item-06) | L |
| 07 | P1 | Security / reminders | [Validate push destinations before the privileged worker fetches them](#item-07) | M |
| 08 | P1 | Security / session lifecycle | [Bind sync state and pending requests to a single user session](#item-08) | M |
| 09 | P1 | Database | [Allow updates at the card quota and make limits concurrency-safe](#item-09) | M |
| 10 | P1 | Database / testing | [Run database authorization and migration tests in CI](#item-10) | M |
| 11 | P2 | Database | [Create one reproducible, versioned schema installation path](#item-11) | M |
| 12 | P2 | Database | [Give story progress a current, constrained data model](#item-12) | M |
| 13 | P2 | Database / performance | [Measure and reduce leaderboard aggregation cost](#item-13) | M |
| 14 | P2 | Backend / operations | [Make reminder delivery bounded and safe to retry](#item-14) | M |
| 15 | P2 | Code architecture | [Generate database types and validate persisted/imported data](#item-15) | M |
| 16 | P2 | Code architecture / resilience | [Add recoverable startup and screen error states](#item-16) | M |
| 17 | P2 | Code architecture / quality | [Close lint warnings and split responsibilities at unstable boundaries](#item-17) | M |
| 18 | P1 | UI / data safety | [Preview backup imports before replacing current cards](#item-18) | M |
| 19 | P2 | UI / reliability | [Make unsynced work visible and actionable](#item-19) | M |
| 20 | P2 | UI / navigation | [Simplify mobile navigation and preserve location in the URL](#item-20) | M |
| 21 | P2 | UI / accessibility | [Reduce reader tab stops and test nested dialog behavior](#item-21) | M |
| 22 | P2 | Security / browser hardening | [Version browser security headers and verify deployed responses](#item-22) | M |
| 23 | P2 | Security / dependencies | [Track the current picomatch advisory and harden dependency maintenance](#item-23) | S |
| 24 | P2 | UI / backup completeness | [Clarify or expand what the backup actually contains](#item-24) | M |
| 25 | P2 | Operations / offline UX | [Define offline availability and recovery expectations](#item-25) | M/L |

<a id="item-01"></a>

### 01. Preserve valid reviews when an offline batch contains an expired event

**P1 · Backend / data integrity · Effort M**  
**Evidence level:** Verified in source.

- **Short description:** The server rejects review dates outside its ±1-day window. The client sends all queued events in one insert and removes the entire batch when the error contains “out of range.” One old event therefore discards recent, valid events too.
- **Why it matters:** Users can lose streak, weekly-score, and silver-card credit even though their card updates were already uploaded.
- **Suggested improvement:** Classify errors by stable codes; isolate invalid records, preserve valid ones, and explicitly define how genuinely old offline reviews should count. Do not silently change learning rules.
- **Acceptance check:** Queue one expired review plus one valid review; the valid review must be stored exactly once and the rejected review must be explained.
- **Source:** [src/core/cloudSync.ts:220](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L220), [supabase/schema.sql:176](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L176).

<a id="item-02"></a>

### 02. Make review submission idempotent and transactional

**P1 · Backend / data integrity · Effort L**  
**Evidence level:** Verified design gap.

- **Short description:** Cards and review events are separate requests. Review events receive only a server identity ID; the queued client event has no persistent deduplication key. A committed insert whose response is lost can be repeated.
- **Why it matters:** Retries can inflate ranking and rewards; a partial failure can leave card state and review history inconsistent.
- **Suggested improvement:** Assign an operation UUID before enqueueing, enforce uniqueness per user, and submit the card transition and event through one transaction/RPC.
- **Acceptance check:** Simulate response loss after commit and retry; assert one event and one state transition. Simulate a failed event validation and verify atomic behavior.
- **Source:** [src/core/cloudSync.ts:206](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L206), [supabase/schema.sql:146](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L146).

<a id="item-03"></a>

### 03. Keep newer changes pending while a story save is in flight

**P1 · Backend / story sync · Effort S**  
**Evidence level:** Reproduced with actual store logic and a mocked transport.

- **Short description:** flush() snapshots a story, awaits its upsert, then unconditionally deletes the story ID from pending. A newer save of the same story during that request is also cleared. The controlled reproduction confirmed that a subsequent flush sends nothing.
- **Why it matters:** A learner can advance a page or complete a quiz and see the update locally without it reaching another device.
- **Suggested improvement:** Serialize flushes and attach a revision to each pending change; clear only the revision actually acknowledged. Add bounded retries and a visible failure state.
- **Acceptance check:** Delay the first response, save a newer page, release it, then flush again: the newer progress must be sent.
- **Source:** [src/features/stories/storiesSync.ts:95](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L95).

<a id="item-04"></a>

### 04. Merge story progress atomically in PostgreSQL

**P1 · Database / story sync · Effort M**  
**Evidence level:** Verified design gap; cross-device behavior inferred.

- **Short description:** The client pulls once per store and then performs ordinary upserts. Local mergeProgress uses maxima, but the database has no equivalent merge on this write path. Two devices can pull the same old row and later overwrite one another.
- **Why it matters:** The documented guarantee that progress never goes backwards does not hold across concurrent devices.
- **Suggested improvement:** Use an ownership-checked RPC that merges page progress and completion atomically, with an explicit content-version policy. Revoke the direct update path if it would bypass that guarantee.
- **Acceptance check:** Two independent clients submit page 5 and page 2 in both orders; the row must retain page 5 and an existing completion.
- **Source:** [src/features/stories/storiesSync.ts:64](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L64), [supabase/migrations/20261115_story_dictation.sql:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261115_story_dictation.sql#L11).

<a id="item-05"></a>

### 05. Define conflict handling for cards and settings across devices

**P1 · Backend / card sync · Effort L**  
**Evidence level:** Verified design gap.

- **Short description:** Pending local cards overwrite the freshly fetched server cards by ID; uploads replace whole rows without an expected revision. updated_at is generated during upload, rather than identifying the original change. Settings are also replaced as one object.
- **Why it matters:** A stale offline device can undo newer reviews, settings, or server-side overdue demotions.
- **Suggested improvement:** Add server revisions and an explicit conflict policy, or replay validated operations. Merge independent setting fields. Decide learning-rule conflicts with the owner.
- **Acceptance check:** Exercise offline edits from two devices plus a nightly demotion; assert the agreed resolution and explain conflicts to the user.
- **Source:** [src/core/cloudSync.ts:210](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L210), [src/core/cloudSync.ts:344](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L344).

<a id="item-06"></a>

### 06. Make competitive results server-verifiable

**P1 · Security / scoring · Effort L**  
**Evidence level:** Verified trust-boundary gap.

- **Short description:** Owners may directly set card boxes and insert plausible-looking review events. The adjective RPC checks ownership, timing, and numeric bounds, but accepts the client’s score without validating answers. These controls protect other users’ rows, not score authenticity.
- **Why it matters:** A signed-in user can fabricate their own competitive results and distort everyone’s rankings.
- **Suggested improvement:** For ranked modes, issue server-bound challenges and validate submitted answers/transitions. Keep unrestricted self-study or imports separate from verified competitive credit. Add reasonable operation limits.
- **Acceptance check:** In a disposable environment, attempt an impossible transition and an unsupported score; neither should receive ranked credit.
- **Source:** [supabase/schema.sql:108](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L108), [supabase/schema.sql:202](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L202), [supabase/migrations/20261117_adjective_drill.sql:72](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261117_adjective_drill.sql#L72).

<a id="item-07"></a>

### 07. Validate push destinations before the privileged worker fetches them

**P1 · Security / reminders · Effort M**  
**Evidence level:** Potential SSRF risk from source; not exploited.

- **Short description:** The registration RPC accepts a caller-provided endpoint with a length bound. The service-role worker later fetches that destination without an explicit provider allowlist, timeout, or redirect policy in application code.
- **Why it matters:** The worker can become an outbound-request surface. Actual reachability depends on the web-push library and platform network controls; private-network access or secret disclosure was not demonstrated.
- **Suggested improvement:** Validate HTTPS destinations against supported push-provider hosts, reject private/link-local destinations and unexpected redirects, and apply request timeouts. Validate at registration and at send time.
- **Acceptance check:** Use a mocked fetch/isolated test server to verify that disallowed destinations and redirects are rejected; never test against production internal addresses.
- **Source:** [supabase/migrations/20261027_push_reminders.sql:41](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261027_push_reminders.sql#L41), [supabase/functions/send-reminders/index.ts:344](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L344).

<a id="item-08"></a>

### 08. Bind sync state and pending requests to a single user session

**P1 · Security / session lifecycle · Effort M**  
**Evidence level:** Source-derived risk requiring an integration test.

- **Short description:** The shared CloudSync singleton is reset by explicit stop(), but the hook cleanup only unsubscribes. Auth-triggered unmounts do not necessarily take the explicit sign-out path. start() changes userId without first clearing all queue state or cancelling earlier starts.
- **Why it matters:** Account changes or expired sessions could leave stale operations or startup results attached to the next session. This is a lifecycle risk, not a demonstrated cross-account breach.
- **Suggested improvement:** Create a per-session sync instance or generation token; cancel stale startup work and detach on every auth transition. Preserve each user’s queue under its own identity.
- **Acceptance check:** Switch A→signed-out→B while A has pending writes and a delayed startup request; no A content may enter B’s engine or outgoing queue.
- **Source:** [src/app/useLeitnerData.ts:27](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/useLeitnerData.ts#L27), [src/core/cloudSync.ts:271](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L271), [src/core/cloudSync.ts:422](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L422).

<a id="item-09"></a>

### 09. Allow updates at the card quota and make limits concurrency-safe

**P1 · Database · Effort M**  
**Evidence level:** Verified trigger defect.

- **Short description:** limit_cards_per_user runs BEFORE INSERT and rejects whenever the user has 10,000 cards. PostgreSQL upserts execute this trigger before conflict resolution, so an update to an existing card is rejected at the cap. A count-only check also does not serialize concurrent new inserts.
- **Why it matters:** Reaching the supported limit can prevent ordinary progress synchronization.
- **Suggested improvement:** Permit existing IDs before applying the insertion quota and serialize quota checks per account. Keep quotas server-enforced.
- **Acceptance check:** At the cap, updating an existing card succeeds and inserting a new one fails; parallel inserts cannot exceed the quota.
- **Source:** [supabase/schema.sql:124](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L124).

<a id="item-10"></a>

### 10. Run database authorization and migration tests in CI

**P1 · Database / testing · Effort M**  
**Evidence level:** Verified coverage gap.

- **Short description:** A useful SQL test harness exists, including migration replay, but the CI workflow never invokes it. Browser tests run in demo mode and therefore cannot validate RLS or real sync.
- **Why it matters:** Frontend tests can stay green while a database migration breaks permissions or data integrity.
- **Suggested improvement:** Add a disposable PostgreSQL/Supabase job. Test anonymous access, owner A versus B, suspended users, RPC grants, migrations, and concurrent sync. Retain the fast demo tests.
- **Acceptance check:** A deliberately broken owner policy or non-replayable migration causes CI to fail.
- **Source:** [.github/workflows/ci.yml:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/.github/workflows/ci.yml#L11), [scripts/test-sql.sh:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/scripts/test-sql.sh#L1).

<a id="item-11"></a>

### 11. Create one reproducible, versioned schema installation path

**P2 · Database · Effort M**  
**Evidence level:** Verified maintainability gap.

- **Short description:** The base schema duplicates adjective objects also defined in a migration; several other features exist only in migrations. The README’s first setup step points at schema.sql. Manual feature guides and migration replay add another source of ordering knowledge.
- **Why it matters:** A new environment can differ from a long-lived deployment, and editing duplicate definitions can introduce drift.
- **Suggested improvement:** Choose a documented baseline plus ordered migrations as the source of truth; track applied versions and verify the final schema in CI. Keep destructive historical cleanup separate from a fresh bootstrap where appropriate.
- **Acceptance check:** A clean environment gains every current table/RPC, and an upgraded environment has an equivalent schema.
- **Source:** [supabase/schema.sql:464](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L464), [supabase/migrations/20261117_adjective_drill.sql:13](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261117_adjective_drill.sql#L13), [README.md:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/README.md#L1).

<a id="item-12"></a>

### 12. Give story progress a current, constrained data model

**P2 · Database · Effort M**  
**Evidence level:** Verified schema gap.

- **Short description:** Stories reuse dictation fields such as last_sentence_id. The database accepts arbitrary short story IDs and independent nonnegative counters; the client’s stricter story-ID filter is not a server constraint. Quiz score is retained locally but omitted from toRow/fromRow.
- **Why it matters:** The schema is harder to understand, accepts inconsistent rows, and does not synchronize all locally represented quiz information.
- **Suggested improvement:** Migrate to page-oriented names or a clear compatibility view; validate known story IDs, sensible counter bounds, and content versions. Decide whether quiz score should sync and encode that decision.
- **Acceptance check:** Malformed IDs/counts are rejected and an intended complete story record survives a cross-device round trip.
- **Source:** [src/features/stories/progressRow.ts:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/progressRow.ts#L1), [supabase/migrations/20261115_story_dictation.sql:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261115_story_dictation.sql#L11).

<a id="item-13"></a>

### 13. Measure and reduce leaderboard aggregation cost

**P2 · Database / performance · Effort M**  
**Evidence level:** Optimization candidate; no production timings collected.

- **Short description:** The leaderboard aggregates all cards, recent events, up to 400 days of streak data, and silver-card history. The reviewed event index begins with user_id, while several global scans filter primarily by review_day.
- **Why it matters:** Latency and database cost may grow with historical events, even though the returned leaderboard is small.
- **Suggested improvement:** Use EXPLAIN ANALYZE on representative staging data before choosing date-led/partial indexes or daily per-user aggregates. Preserve hidden-user and tie semantics.
- **Acceptance check:** Record p50/p95 timings and query plans at realistic volumes; demonstrate improvement without changing ranking results.
- **Source:** [supabase/migrations/20261030_overdue_overtake.sql:201](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261030_overdue_overtake.sql#L201), [supabase/schema.sql:173](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L173).

<a id="item-14"></a>

### 14. Make reminder delivery bounded and safe to retry

**P2 · Backend / operations · Effort M**  
**Evidence level:** Verified design gap.

- **Short description:** The worker processes subscriptions sequentially, does not set a fetch timeout, and writes bookkeeping after delivery. Overlapping invocations or a crash between delivery and state update can repeat notifications.
- **Why it matters:** One slow endpoint can delay the run; retries can annoy learners or increase delivery cost.
- **Suggested improvement:** Claim per-user notification jobs atomically, use bounded concurrency and timeouts, and record per-device delivery outcomes with retry limits.
- **Acceptance check:** Overlap two invocations and inject a timeout/crash; verify bounded duration and controlled duplicate behavior.
- **Source:** [supabase/functions/send-reminders/index.ts:358](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L358), [supabase/functions/send-reminders/index.ts:423](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L423).

<a id="item-15"></a>

### 15. Generate database types and validate persisted/imported data

**P2 · Code architecture · Effort M**  
**Evidence level:** Verified maintainability gap.

- **Short description:** SupabaseClient is unparameterized and several results are cast into handwritten types. Persisted queues use JSON casts; imported settings are spread into defaults without a runtime schema.
- **Why it matters:** Schema drift and malformed cached/backed-up settings can reach runtime despite TypeScript checks.
- **Suggested improvement:** Generate Database types from the authoritative schema and use typed query adapters. Validate queue, backup, and settings payloads at their boundaries with versioned migrations.
- **Acceptance check:** A renamed database column fails type checking; malformed settings and unsupported backup versions fail safely before mutation.
- **Source:** [src/shared/lib/supabase.ts:13](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/lib/supabase.ts#L13), [src/core/cloudSync.ts:20](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L20), [src/core/leitnerEngine.ts:499](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L499).

<a id="item-16"></a>

### 16. Add recoverable startup and screen error states

**P2 · Code architecture / resilience · Effort M**  
**Evidence level:** Verified gap.

- **Short description:** The startup promises have no visible failure/retry path, and the app has no React error boundary. Catalog failure is converted to an empty list. Lazy-feature chunk failures also lack a dedicated recovery boundary.
- **Why it matters:** A transient failure can look like an empty catalog, a stuck loader, or a blank app.
- **Suggested improvement:** Model loading/ready/error states, add retry controls and per-feature boundaries, and distinguish an unavailable catalog from a valid empty result.
- **Acceptance check:** Fail session initialization, catalog loading, and a lazy chunk independently; users receive a clear retry path and other screens remain usable where possible.
- **Source:** [src/app/App.tsx:36](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/App.tsx#L36), [src/app/useLeitnerData.ts:29](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/useLeitnerData.ts#L29), [src/main.tsx:15](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/main.tsx#L15).

<a id="item-17"></a>

### 17. Close lint warnings and split responsibilities at unstable boundaries

**P2 · Code architecture / quality · Effort M**  
**Evidence level:** Observed: lint succeeds with 19 warnings.

- **Short description:** ReviewSession is 719 lines; cloudSync combines persistence, session bootstrap, ranking/admin adapters, and demo fixtures. Lint reports effect-dependency, state-in-effect, and render-purity warnings. Size alone is not a defect, but these boundaries complicate testing.
- **Why it matters:** Behavior changes are harder to isolate and effect regressions are easy to miss.
- **Suggested improvement:** First resolve or justify the 19 warnings. Extract transport adapters, session ownership, and pure review transitions without rewriting the feature layout. Prevent new warnings in CI.
- **Acceptance check:** Focused tests cover extracted boundaries and CI rejects new warnings after the baseline is clean.
- **Source:** [src/features/review/ReviewSession.tsx:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/review/ReviewSession.tsx#L1), [src/core/cloudSync.ts:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L1), [.github/workflows/ci.yml:21](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/.github/workflows/ci.yml#L21).

<a id="item-18"></a>

### 18. Preview backup imports before replacing current cards

**P1 · UI / data safety · Effort M**  
**Evidence level:** Verified destructive UX path.

- **Short description:** Selecting a backup immediately imports it. importData replaces the current card set and queues deletion of cards absent from the file; there is no intermediate comparison or confirmation. An empty cards array can clear the set.
- **Why it matters:** Choosing an old or wrong file can remove current progress and propagate that change to the cloud.
- **Suggested improvement:** Show counts of added, changed, removed, and rejected cards; offer merge versus replace explicitly, require confirmation for replace, and create a recovery snapshot. Add a file-size limit.
- **Acceptance check:** Selecting an old or empty backup changes nothing until confirmation, and the previous state can be recovered.
- **Source:** [src/features/settings/SettingsBackupModal.tsx:90](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/settings/SettingsBackupModal.tsx#L90), [src/core/leitnerEngine.ts:499](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L499).

<a id="item-19"></a>

### 19. Make unsynced work visible and actionable

**P2 · UI / reliability · Effort M**  
**Evidence level:** Verified UI limitation.

- **Short description:** Main sync state is a small colored account dot with a title/accessible label. Story saves silently return on error and are not represented by that indicator.
- **Why it matters:** Users can assume work is synchronized when a feature’s queue is still failing, particularly on touch devices without hover.
- **Suggested improvement:** Show pending count, last successful sync, feature-specific errors, and a retry action. Announce meaningful status changes accessibly and explain what signing out does to pending results.
- **Acceptance check:** Simulated offline and rejected saves produce visible, accurate feedback for cards, stories, and drills.
- **Source:** [src/app/Navbar.tsx:31](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/Navbar.tsx#L31), [src/features/stories/storiesSync.ts:102](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L102).

<a id="item-20"></a>

### 20. Simplify mobile navigation and preserve location in the URL

**P2 · UI / navigation · Effort M**  
**Evidence level:** Source-based UX recommendation; visual validation pending.

- **Short description:** The mobile row distributes seven normal-user destinations (eight for admins) across the width and truncates labels. Active screens live in React state; only initial ?go= links are parsed, so ordinary navigation does not update history.
- **Why it matters:** Labels may be hard to scan on small screens, and browser Back/refresh cannot reliably restore a learner’s location.
- **Suggested improvement:** Test a smaller primary navigation plus More, and add URL-backed screen/story state. Preserve drill-leave guards and provide focus management when the screen changes.
- **Acceptance check:** At 320/390px and large text, primary destinations are clear; Back, forward, refresh, and a shared story link behave predictably.
- **Source:** [src/app/Navbar.tsx:35](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/Navbar.tsx#L35), [src/app/LeitnerApp.tsx:51](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/LeitnerApp.tsx#L51).

<a id="item-21"></a>

### 21. Reduce reader tab stops and test nested dialog behavior

**P2 · UI / accessibility · Effort M**  
**Evidence level:** Verified implementation patterns; usability impact needs browser testing.

- **Short description:** Every story word is a separate tab stop. Every mounted dialog independently installs a window key handler; there is no explicit topmost-dialog manager or background inertness. The existing dialog tests cover single dialogs.
- **Why it matters:** Keyboard readers can face dozens of stops per paragraph; nested dialogs can compete for Escape/focus handling.
- **Suggested improvement:** Offer a reading mode with an intentional word-navigation interaction, a skip route to controls, and a single active dialog stack. Test with keyboard and screen readers in both languages.
- **Acceptance check:** A reader can reach page controls efficiently; Escape closes only the topmost dialog and focus returns correctly.
- **Source:** [src/features/stories/StoryText.tsx:15](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/StoryText.tsx#L15), [src/shared/ui/Dialog.tsx:67](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/ui/Dialog.tsx#L67).

<a id="item-22"></a>

### 22. Version browser security headers and verify deployed responses

**P2 · Security / browser hardening · Effort M**  
**Evidence level:** Repository configuration gap; live headers unverified.

- **Short description:** The repository’s header configuration defines caching only. It does not define CSP, frame-ancestors, Referrer-Policy, or Permissions-Policy. Hosting settings may supply additional headers; they were not inspected.
- **Why it matters:** Explicit headers reduce the impact of script injection and unwanted embedding for an app with browser-held sessions and private cards.
- **Suggested improvement:** Inventory actual response headers; introduce a tested report-only CSP and then enforce a policy compatible with Supabase, fonts, images, OAuth, and workers. Set other relevant headers deliberately.
- **Acceptance check:** Validate login, stories, push, and assets under the policy; confirm frame protection and policy headers on deployed HTML.
- **Source:** [vercel.json:17](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/vercel.json#L17), [src/shared/lib/supabase.ts:14](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/lib/supabase.ts#L14).

<a id="item-23"></a>

### 23. Track the current picomatch advisory and harden dependency maintenance

**P2 · Security / dependencies · Effort S**  
**Evidence level:** Confirmed by npm audit and upstream advisory.

- **Short description:** npm audit reports six high-severity affected packages, all stemming from one picomatch ReDoS advisory through Vite/globbing dependencies. The advisory and audit currently report no patched/automatic fix. No browser-production exploit path was established.
- **Why it matters:** Build/development tools still need security maintenance, but six affected packages should not be mistaken for six independent application vulnerabilities.
- **Suggested improvement:** Track the advisory, avoid attacker-controlled glob patterns, isolate untrusted builds, and update the lockfile when a reviewed fix is available. Add scheduled dependency review; do not use blind force upgrades.
- **Acceptance check:** Document exposure and mitigation, rerun audit after upstream fixes, and run the full build/test suite after updates.
- **Source:** [package-lock.json:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/package-lock.json#L1), [package.json:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/package.json#L1).

<a id="item-24"></a>

### 24. Clarify or expand what the backup actually contains

**P2 · UI / backup completeness · Effort M**  
**Evidence level:** Verified scope mismatch risk.

- **Short description:** The export includes cards and settings only. Stories and adjective results live in separate stores and are not included; cloud review history is also outside the export.
- **Why it matters:** A user may interpret a general backup as a complete copy and discover missing progress during recovery.
- **Suggested improvement:** Label it explicitly as a cards/settings backup or provide a versioned complete export with an import strategy that respects ranked-history integrity.
- **Acceptance check:** A documented round-trip test demonstrates exactly which data is restored, and the UI states exclusions before download.
- **Source:** [src/core/leitnerEngine.ts:486](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L486), [src/features/stories/storiesSync.ts:20](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L20), [src/features/adjective/drillSync.ts:22](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/adjective/drillSync.ts#L22).

<a id="item-25"></a>

### 25. Define offline availability and recovery expectations

**P2 · Operations / offline UX · Effort M/L**  
**Evidence level:** Verified design limitation; deployment checks pending.

- **Short description:** Local queues support temporary disconnection, but the service worker intentionally caches no app shell and the catalog is fetched on each page load. Offline reopening therefore is not guaranteed. Production backup/restore settings were not reviewed.
- **Why it matters:** Learners may confuse offline persistence with being able to reopen the app offline; operators also need a tested recovery path.
- **Suggested improvement:** State the supported offline contract. If reopening offline is required, add versioned shell/content caching with safe update behavior. Separately document and rehearse database restoration in staging.
- **Acceptance check:** Test a cold offline launch separately from disconnection after launch, and record a successful staging restore drill.
- **Source:** [public/sw.js:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/public/sw.js#L1), [src/core/leitnerEngine.ts:234](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L234).

## Suggested implementation order

1. **Protect progress:** items 01–05, 09, and 18. Add regression cases before changing sync or import behavior.
2. **Verify the trust boundaries:** items 06–08 and 10. Use disposable identities and databases, never production experiments.
3. **Improve operability:** items 11–17, 22–23 and 25. Measure before adding performance infrastructure.
4. **Refine the experience:** items 19–21 and 24, with actual phone, keyboard, screen-reader, Persian and English review.

## Follow-up evidence needed from staging / owner

- Applied migrations and sanitized schema/grant export to compare against this revision.
- Auth redirect configuration, role policies, function grants, and relevant database security/performance advisor results.
- Representative query plans and data volumes for leaderboard and startup reads.
- Reminder scheduler settings, deployment JWT verification configuration, and delivery/error metrics.
- Actual deployed HTTP security headers and a backup/restore exercise.
- Working browser runs covering both languages, narrow screens, enlarged text, keyboard focus, nested dialogs, offline transitions, two-device sync, and switching users.

## External references

- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security): ownership, policies, and security boundaries.
- [Supabase database functions](https://supabase.com/docs/guides/database/functions): invoker/definer execution and function permissions. Review privileged RPC grants and search paths as part of item 10; a definer function is not inherently a vulnerability when deliberately constrained.
- [Supabase changelog](https://supabase.com/changelog.md): consulted for current behavior; the recent CLI v3 change matters if the migration/test workflow is updated.
- [picomatch advisory GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): affects versions through 4.0.7; no patched version listed when checked. Relevant to item 23, not proof of a reachable production exploit.
