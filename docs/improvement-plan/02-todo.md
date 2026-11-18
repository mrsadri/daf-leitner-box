> Latest four-task follow-up: [task 21/22/23/25 fixes, tests and remaining requirements](13-four-task-follow-up.md).

> Current release: PR #35 is published. See [publication and recovery](10-publication-and-recovery.md) for current acceptance evidence and remaining operator/human/upstream gates. Earlier implementation notes remain historical.

# DaF & Mind — actionable to-do list

[Plan](01-implementation-plan.md) · [Verification checklist](03-verification-checklist.md) · [Original review](00-original-review.md)

Prepared 18 November 2026. IDs 01–25 correspond exactly to the review. Current status is tracked in [04-progress.md](04-progress.md). Unchecked boxes are not claimed complete. Dependencies below distinguish shared design from hard implementation prerequisites; related contracts can be designed together without creating a circular work order. G0 and D1–D7 are defined in the plan.

## AI model guide

These are suggested assignments, not guarantees of correctness. Use the newest available **GPT-6.2 Sol** for focused work and **GPT-6.2 Astra** for complex concurrency, database/security design, and high-risk review. “Medium” and “High” refer to reasoning effort; use the nearest available setting. If only GPT-6.1 Sol is available, it can handle bounded tasks with the same acceptance checks; use Astra to review sensitive changes. Model labels do not replace owner decisions or release authorization. For owner-only actions, the named model assists with preparation or review while the owner performs the action.

Assignments are project-specific judgments based on [OpenAI’s model guidance](https://learn.chatgpt.com/docs/whats-new/gpt-62-astra-sol). A separate Astra review is recommended before merging data-integrity, authentication, permission, or scoring changes.

## Coverage and status register

**Current follow-up:** see [backlog acceptance evidence](09-backlog-acceptance.md). Five requested tasks pass local acceptance; the candidate still needs review/release. Tasks 13, 21, 22, 23 and 25 retain substantive external requirements.


| ID | Priority | Phase | Task | Effort | Status |
|---|---|---|---|---|---|
| 01 | P1 | B | [Preserve valid reviews when an offline batch contains an expired event](#task-01) | M | Implemented locally |
| 02 | P1 | C | [Make review submission idempotent and transactional](#task-02) | L | Implemented locally |
| 03 | P1 | B | [Keep newer changes pending while a story save is in flight](#task-03) | S | Implemented locally |
| 04 | P1 | C | [Merge story progress atomically in PostgreSQL](#task-04) | M | Implemented locally |
| 05 | P1 | C | [Define conflict handling for cards and settings across devices](#task-05) | L | Implemented locally |
| 06 | P1 | C | [Make competitive results server-verifiable](#task-06) | L | Implemented locally |
| 07 | P1 | D | [Validate push destinations before the privileged worker fetches them](#task-07) | M | Partial — acceptance pending |
| 08 | P1 | B | [Bind sync state and pending requests to a single user session](#task-08) | M | Published in PR #35; automated acceptance passed |
| 09 | P1 | B | [Allow updates at the card quota and make limits concurrency-safe](#task-09) | M | Implemented locally |
| 10 | P1 | A | [Run database authorization and migration tests in CI](#task-10) | M | Verified locally and in GitHub CI |
| 11 | P2 | A | [Create one reproducible, versioned schema installation path](#task-11) | M | Partial — acceptance pending |
| 12 | P2 | C | [Give story progress a current, constrained data model](#task-12) | M | Implemented locally; hosted data audit pending |
| 13 | P2 | E | [Measure and reduce leaderboard aggregation cost](#task-13) | M | Measured — synthetic and read-only production evidence; no new index justified |
| 14 | P2 | D | [Make reminder delivery bounded and safe to retry](#task-14) | M | Published in PR #35; automated acceptance passed |
| 15 | P2 | C | [Generate database types and validate persisted/imported data](#task-15) | M | Implemented locally |
| 16 | P2 | D | [Add recoverable startup and screen error states](#task-16) | M | Published in PR #35; automated acceptance passed |
| 17 | P2 | D | [Close lint warnings and split responsibilities at unstable boundaries](#task-17) | M | Implemented locally |
| 18 | P1 | B | [Preview backup imports before replacing current cards](#task-18) | M | Implemented locally |
| 19 | P2 | E | [Make unsynced work visible and actionable](#task-19) | M | Published in PR #35; automated acceptance passed |
| 20 | P2 | E | [Simplify mobile navigation and preserve location in the URL](#task-20) | M | Published in PR #35; automated acceptance passed |
| 21 | P2 | E | [Reduce reader tab stops and test nested dialog behavior](#task-21) | M | Partial — keyboard checks pass; screen-reader observation pending |
| 22 | P2 | D | [Version browser security headers and verify deployed responses](#task-22) | M | Partial — live headers/assets pass; OAuth/push/CSP disposition pending |
| 23 | P2 | A | [Track the current picomatch advisory and harden dependency maintenance](#task-23) | S | Open — runtime audit clean; five build-tool findings await upstream remediation |
| 24 | P2 | E | [Clarify or expand what the backup actually contains](#task-24) | M | Implemented locally |
| 25 | P2 | E | [Define offline availability and recovery expectations](#task-25) | M/L | Partial — encrypted backup prepared; activation and hosted recovery pending |

<a id="task-01"></a>

## 01. Preserve valid reviews when an offline batch contains an expired event

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** B · **Effort:** M  
**Depends on:** G0; D1 for policy changes  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified in source.

**Why:** Users can lose streak, weekly-score, and silver-card credit even though their card updates were already uploaded.

- [x] **01.1** Add a regression case containing one expired event and one valid event. **AI: GPT-6.2 Sol · High.**
- [x] **01.2** Replace error-message matching with structured error classification; isolate rejected records without dropping the entire batch. **AI: GPT-6.2 Sol · High.**
- [x] **01.3** Preserve valid events and show the rejected outcome; apply decision D1 only after it is recorded. **AI: GPT-6.2 Sol · High.**
- [x] **01.V** Pass and record [acceptance check V01](03-verification-checklist.md#v01). **AI: GPT-6.2 Sol · High.**

**Acceptance:** Queue one expired review plus one valid review; the valid review must be stored exactly once and the rejected review must be explained.

**Traceability:** [Review item 01](00-original-review.md#item-01); [src/core/cloudSync.ts:220](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L220), [supabase/schema.sql:176](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L176).

**Implementation notes / decisions / blockers:** Atomic batches archive expired/unverified events without dropping valid events; mixed-batch and receipt regressions. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-02"></a>

## 02. Make review submission idempotent and transactional

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** C · **Effort:** L  
**Depends on:** 10, 11; agreed contract with 05/06; D1–D3  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified design gap.

**Why:** Retries can inflate ranking and rewards; a partial failure can leave card state and review history inconsistent.

- [x] **02.1** Define a persisted operation UUID, per-user uniqueness constraint, and response contract. **AI: GPT-6.2 Astra · High.**
- [x] **02.2** Implement an ownership-checked transaction that validates the operation and writes the card transition plus event atomically. **AI: GPT-6.2 Astra · High.**
- [x] **02.3** Migrate existing pending queues safely; handle old clients through the compatibility plan instead of abruptly revoking their write path. **AI: GPT-6.2 Astra · High.**
- [x] **02.4** Test response loss after commit, duplicate requests, partial failure, and repeated retries. **AI: GPT-6.2 Astra · High.**
- [x] **02.V** Pass and record [acceptance check V02](03-verification-checklist.md#v02). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Simulate response loss after commit and retry; assert one event and one state transition. Simulate a failed event validation and verify atomic behavior.

**Traceability:** [Review item 02](00-original-review.md#item-02); [src/core/cloudSync.ts:206](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L206), [supabase/schema.sql:146](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L146).

**Implementation notes / decisions / blockers:** apply_sync_batch commits card/event/settings together with durable operation receipts; SQL rollback and client lost-response tests. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-03"></a>

## 03. Keep newer changes pending while a story save is in flight

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** B · **Effort:** S  
**Depends on:** G0  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Reproduced with actual store logic and a mocked transport.

**Why:** A learner can advance a page or complete a quiz and see the update locally without it reaching another device.

- [x] **03.1** Add the delayed-response reproduction as a regression test. **AI: GPT-6.2 Sol · High.**
- [x] **03.2** Serialize flushes and track a revision for each pending story save; acknowledge only the sent revision. **AI: GPT-6.2 Sol · High.**
- [x] **03.3** Add bounded retry behavior and a status signal for item 19; test reload with pending work. **AI: GPT-6.2 Sol · High.**
- [x] **03.V** Pass and record [acceptance check V03](03-verification-checklist.md#v03). **AI: GPT-6.2 Sol · High.**

**Acceptance:** Delay the first response, save a newer page, release it, then flush again: the newer progress must be sent.

**Traceability:** [Review item 03](00-original-review.md#item-03); [src/features/stories/storiesSync.ts:95](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L95).

**Implementation notes / decisions / blockers:** Serialized revision-aware story saves, bounded retries, reload replay and visible save status; delayed-save tests. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-04"></a>

## 04. Merge story progress atomically in PostgreSQL

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** C · **Effort:** M  
**Depends on:** 10, 11; agreed contract with 12; D4  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified design gap; cross-device behavior inferred.

**Why:** The documented guarantee that progress never goes backwards does not hold across concurrent devices.

- [x] **04.1** Specify page/completion merge semantics for each content version, coordinating with item 12. **AI: GPT-6.2 Astra · High.**
- [x] **04.2** Use an ownership-protected atomic merge trigger for direct upserts, covering old and new clients (selected compatibility design). **AI: GPT-6.2 Astra · High.**
- [x] **04.3** Test out-of-order updates from two devices; close bypass write paths only after compatible clients are deployed. **AI: GPT-6.2 Astra · High.**
- [x] **04.V** Pass and record [acceptance check V04](03-verification-checklist.md#v04). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Two independent clients submit page 5 and page 2 in both orders; the row must retain page 5 and an existing completion.

**Traceability:** [Review item 04](00-original-review.md#item-04); [src/features/stories/storiesSync.ts:64](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L64), [supabase/migrations/20261115_story_dictation.sql:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261115_story_dictation.sql#L11).

**Implementation notes / decisions / blockers:** Atomic ownership-protected merge trigger covers new and legacy clients; two-connection native story tests pass in both submission orders. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-05"></a>

## 05. Define conflict handling for cards and settings across devices

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** C · **Effort:** L  
**Depends on:** 10, 11; shared design with 02; D2  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified design gap.

**Why:** A stale offline device can undo newer reviews, settings, or server-side overdue demotions.

- [x] **05.1** Record D2: conflict rules for review, deletion, import, nightly demotion, and independent setting changes. **AI: GPT-6.2 Astra · High.**
- [x] **05.2** Implement server revisions or operation replay, coordinated with the transaction contract in item 02. **AI: GPT-6.2 Astra · High.**
- [x] **05.3** Handle stale-device updates and deleted-card resurrection explicitly; expose conflicts through item 19. **AI: GPT-6.2 Astra · High.**
- [x] **05.V** Pass and record [acceptance check V05](03-verification-checklist.md#v05). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Exercise offline edits from two devices plus a nightly demotion; assert the agreed resolution and explain conflicts to the user.

**Traceability:** [Review item 05](00-original-review.md#item-05); [src/core/cloudSync.ts:210](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L210), [src/core/cloudSync.ts:344](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L344).

**Implementation notes / decisions / blockers:** Server revisions; card/delete/settings conflict quarantine and downloadable recovery; stale-card and independent-settings tests. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-06"></a>

## 06. Make competitive results server-verifiable

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** C · **Effort:** L  
**Depends on:** 10, 11; shared design with 02; D3  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified trust-boundary gap.

**Why:** A signed-in user can fabricate their own competitive results and distort everyone’s rankings.

- [x] **06.1** Record D3: which actions earn verified ranking credit, including offline reviews, imports, and historical results. **AI: GPT-6.2 Astra · High.**
- [x] **06.2** Issue server-bound drill challenges and validate submitted answers, ownership, expiry, and replay. **AI: GPT-6.2 Astra · High.**
- [x] **06.3** Validate ranked review transitions and enforce bounded operation limits; retain the agreed self-study behavior. **AI: GPT-6.2 Astra · High.**
- [x] **06.4** Test impossible transitions, fabricated scores, repeated challenge submissions, and unauthorized access. **AI: GPT-6.2 Astra · High.**
- [x] **06.V** Pass and record [acceptance check V06](03-verification-checklist.md#v06). **AI: GPT-6.2 Astra · High.**

**Acceptance:** In a disposable environment, attempt an impossible transition and an unsupported score; neither should receive ranked credit.

**Traceability:** [Review item 06](00-original-review.md#item-06); [supabase/schema.sql:108](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L108), [supabase/schema.sql:202](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L202), [supabase/migrations/20261117_adjective_drill.sql:72](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261117_adjective_drill.sql#L72).

**Implementation notes / decisions / blockers:** Server-issued versioned drill questions, immutable timed answers, server-derived results; canonical review transitions and verified-only rankings/silver. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-07"></a>

## 07. Validate push destinations before the privileged worker fetches them

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** D · **Effort:** M  
**Depends on:** G0; isolated endpoint test setup  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — acceptance pending
**Original evidence:** Potential SSRF risk from source; not exploited.

**Why:** The worker can become an outbound-request surface. Actual reachability depends on the web-push library and platform network controls; private-network access or secret disclosure was not demonstrated.

- [x] **07.1** Map valid push providers and inspect actual library/runtime URL behavior in an isolated environment. **AI: GPT-6.2 Astra · High.**
- [x] **07.2** Validate HTTPS provider destinations at registration and delivery; reject unexpected redirects and disallowed addresses. **AI: GPT-6.2 Astra · High.**
- [x] **07.3** Add request timeouts and endpoint-validation tests without contacting private production destinations. **AI: GPT-6.2 Astra · High.**
- [x] **07.V** Pass and record [acceptance check V07](03-verification-checklist.md#v07). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Use a mocked fetch/isolated test server to verify that disallowed destinations and redirects are rejected; never test against production internal addresses.

**Traceability:** [Review item 07](00-original-review.md#item-07); [supabase/migrations/20261027_push_reminders.sql:41](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261027_push_reminders.sql#L41), [supabase/functions/send-reminders/index.ts:344](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L344).

**Implementation notes / decisions / blockers:** Provider allowlist, registration guard, redirect refusal, send timeout; pure/SQL validation tests. Real provider/runtime tests remain owner staging. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-08"></a>

## 08. Bind sync state and pending requests to a single user session

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** B · **Effort:** M  
**Depends on:** G0  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Published in PR #35; automated acceptance passed
**Original evidence:** Source-derived risk requiring an integration test.

**Why:** Account changes or expired sessions could leave stale operations or startup results attached to the next session. This is a lifecycle risk, not a demonstrated cross-account breach.

- [x] **08.1** Reproduce account switching, token expiry, delayed startup, and unmount with pending writes. **AI: GPT-6.2 Astra · High.**
- [x] **08.2** Bind queues, transport, and callbacks to a session instance or generation; cancel stale work. **AI: GPT-6.2 Astra · High.**
- [x] **08.3** Define sign-out handling per feature; preserve or intentionally discard pending work only with clear user-facing semantics. **AI: GPT-6.2 Astra · High.**
- [x] **08.V** Pass and record [acceptance check V08](03-verification-checklist.md#v08). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Switch A→signed-out→B while A has pending writes and a delayed startup request; no A content may enter B’s engine or outgoing queue.

**Traceability:** [Review item 08](00-original-review.md#item-08); [src/app/useLeitnerData.ts:27](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/useLeitnerData.ts#L27), [src/core/cloudSync.ts:271](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L271), [src/core/cloudSync.ts:422](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L422).

**Implementation notes / decisions / blockers:** Generation barriers and account-scoped queues/callbacks; delayed-account regression. Sign-out explains preserved cards/stories and discarded pending contests. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-09"></a>

## 09. Allow updates at the card quota and make limits concurrency-safe

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** B · **Effort:** M  
**Depends on:** 10; disposable SQL environment  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified trigger defect.

**Why:** Reaching the supported limit can prevent ordinary progress synchronization.

- [x] **09.1** Test an existing-card upsert at 10,000 cards and simultaneous inserts near the limit. **AI: GPT-6.2 Astra · High.**
- [x] **09.2** Permit updates to existing IDs while serializing the new-card quota check per user. **AI: GPT-6.2 Astra · High.**
- [x] **09.3** Verify normal progress saves still work at the limit and the client explains rejected new-card inserts. **AI: GPT-6.2 Astra · High.**
- [x] **09.V** Pass and record [acceptance check V09](03-verification-checklist.md#v09). **AI: GPT-6.2 Astra · High.**

**Acceptance:** At the cap, updating an existing card succeeds and inserting a new one fails; parallel inserts cannot exceed the quota.

**Traceability:** [Review item 09](00-original-review.md#item-09); [supabase/schema.sql:124](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L124).

**Implementation notes / decisions / blockers:** Native two-connection quota race, existing upsert at limit and atomic delete/insert replacement pass. Quota-specific bilingual feedback preserves pending work. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-10"></a>

## 10. Run database authorization and migration tests in CI

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** A · **Effort:** M  
**Depends on:** G0  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — acceptance pending
**Original evidence:** Verified coverage gap.

**Why:** Frontend tests can stay green while a database migration breaks permissions or data integrity.

- [x] **10.1** Enable a disposable PostgreSQL or Supabase job with deterministic fixtures and no production credentials. **AI: GPT-6.2 Sol · High.**
- [x] **10.2** Run the existing SQL harness and add role-based tests for anonymous users, owners A/B, suspended users, and admin RPCs. **AI: GPT-6.2 Sol · High.**
- [x] **10.3** Add migration replay, concurrency, and transport integration tests; prove an intentionally broken ownership rule fails CI. **AI: GPT-6.2 Sol · High.**
- [x] **10.V** Pass and record [acceptance check V10](03-verification-checklist.md#v10). **AI: GPT-6.2 Sol · High.**

**Acceptance:** A deliberately broken owner policy or non-replayable migration causes CI to fail.

**Traceability:** [Review item 10](00-original-review.md#item-10); [.github/workflows/ci.yml:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/.github/workflows/ci.yml#L11), [scripts/test-sql.sh:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/scripts/test-sql.sh#L1).

**Implementation notes / decisions / blockers:** Native/isolated CI jobs, ten SQL suites, actual multi-connection checks and a negative RLS mutation control. Hosted Actions run requires a pushed review revision. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-11"></a>

## 11. Create one reproducible, versioned schema installation path

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** A · **Effort:** M  
**Depends on:** G0; use 10 to verify the result  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — acceptance pending
**Original evidence:** Verified maintainability gap.

**Why:** A new environment can differ from a long-lived deployment, and editing duplicate definitions can introduce drift.

- [x] **11.1** Inventory schema.sql, migrations, manual setup guides, and duplicate object definitions. **AI: GPT-6.2 Astra · High.**
- [x] **11.2** Define one baseline plus ordered migrations and a record of applied versions; update setup documentation. **AI: GPT-6.2 Astra · High.**
- [x] **11.3** Compare clean installation and upgrade schemas, including functions, grants, policies, and scheduled jobs. **AI: GPT-6.2 Astra · High.**
- [x] **11.V** Pass and record [acceptance check V11](03-verification-checklist.md#v11). **AI: GPT-6.2 Astra · High.**

**Acceptance:** A clean environment gains every current table/RPC, and an upgraded environment has an equivalent schema.

**Traceability:** [Review item 11](00-original-review.md#item-11); [supabase/schema.sql:464](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L464), [supabase/migrations/20261117_adjective_drill.sql:13](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261117_adjective_drill.sql#L13), [README.md:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/README.md#L1).

**Implementation notes / decisions / blockers:** Shared baseline plus lexical migrations, replay, clean/legacy-upgrade equivalence and generated-type drift checks. Historical overlap retained for compatibility; owner compares installed schema before upgrade. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-12"></a>

## 12. Give story progress a current, constrained data model

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** C · **Effort:** M  
**Depends on:** 10, 11; D4; design together with 04  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally; hosted data audit pending
**Original evidence:** Verified schema gap.

**Why:** The schema is harder to understand, accepts inconsistent rows, and does not synchronize all locally represented quiz information.

- [x] **12.1** Record D4: whether quiz scores sync and how changed story content affects saved progress. **AI: GPT-6.2 Astra · High.**
- [x] **12.2** Introduce clear page-oriented fields or a documented compatibility view; constrain story IDs and counter relationships. **AI: GPT-6.2 Astra · High.**
- [x] **12.3** Migrate legacy rows without losing progress; test old/new client payloads and full intended round trips. **AI: GPT-6.2 Astra · High.**
- [x] **12.V** Pass and record [acceptance check V12](03-verification-checklist.md#v12). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Malformed IDs/counts are rejected and an intended complete story record survives a cross-device round trip.

**Traceability:** [Review item 12](00-original-review.md#item-12); [src/features/stories/progressRow.ts:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/progressRow.ts#L1), [supabase/migrations/20261115_story_dictation.sql:11](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261115_story_dictation.sql#L11).

**Implementation notes / decisions / blockers:** Constrained story IDs/counters, atomic page/completion merge, quiz-score synchronization and version compatibility policy. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-13"></a>

## 13. Measure and reduce leaderboard aggregation cost

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M  
**Depends on:** 10, 11; representative staging data  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Measured — synthetic and read-only production evidence; no new index justified
**Original evidence:** Optimization candidate; no production timings collected.

**Why:** Latency and database cost may grow with historical events, even though the returned leaderboard is small.

- [x] **13.1** Capture representative synthetic volumes and read-only production EXPLAIN ANALYZE plus p50/p95 timings (substitutes for paid staging). **AI: GPT-6.2 Sol · High.**
- [x] **13.2** Identify the actual scan cost before selecting date-led indexes, partial indexes, or daily aggregates. **AI: GPT-6.2 Sol · High.**
- [x] **13.3** Compare query plans and results before/after; verify hidden users, tie ranks, streaks, and silver counts. **AI: GPT-6.2 Sol · High.**
- [x] **13.V** Pass and record [acceptance check V13](03-verification-checklist.md#v13). **AI: GPT-6.2 Sol · High.**

**Acceptance:** Record p50/p95 timings and query plans at realistic volumes; demonstrate improvement without changing ranking results.

**Traceability:** [Review item 13](00-original-review.md#item-13); [supabase/migrations/20261030_overdue_overtake.sql:201](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/migrations/20261030_overdue_overtake.sql#L201), [supabase/schema.sql:173](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/schema.sql#L173).

**Implementation notes / decisions / blockers:** Verified leaderboard measured with 100 users, 10k cards, 200k events; candidate index p50 59.18→58.60ms, p95 65.08→60.63ms. Plans recorded; no speculative index shipped. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-14"></a>

## 14. Make reminder delivery bounded and safe to retry

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** D · **Effort:** M  
**Depends on:** 07, 10, 11  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Published in PR #35; automated acceptance passed
**Original evidence:** Verified design gap.

**Why:** One slow endpoint can delay the run; retries can annoy learners or increase delivery cost.

- [x] **14.1** Define notification job identity, claim ownership, retry policy, and per-device outcomes. **AI: GPT-6.2 Astra · High.**
- [x] **14.2** Add atomic claims, bounded concurrency, request timeouts, and privacy-safe operational metrics. **AI: GPT-6.2 Astra · High.**
- [x] **14.3** Simulate overlapping invocations and crashes around delivery/state updates; document any unavoidable duplicate-delivery window. **AI: GPT-6.2 Astra · High.**
- [x] **14.V** Pass and record [acceptance check V14](03-verification-checklist.md#v14). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Overlap two invocations and inject a timeout/crash; verify bounded duration and controlled duplicate behavior.

**Traceability:** [Review item 14](00-original-review.md#item-14); [supabase/functions/send-reminders/index.ts:358](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L358), [supabase/functions/send-reminders/index.ts:423](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/supabase/functions/send-reminders/index.ts#L423).

**Implementation notes / decisions / blockers:** Per-user leases plus per-device job keys/attempt tokens, concurrency 3, timeout 10s, explicit failure retry cap 3; uncertain delivery terminal to avoid duplicate retries. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-15"></a>

## 15. Generate database types and validate persisted/imported data

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** C · **Effort:** M  
**Depends on:** 11; agree evolving RPC contracts with 02/04/06  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified maintainability gap.

**Why:** Schema drift and malformed cached/backed-up settings can reach runtime despite TypeScript checks.

- [x] **15.1** Generate and check in database types from the chosen schema installation path. **AI: GPT-6.2 Sol · High.**
- [x] **15.2** Parameterize Supabase clients and centralize typed transport adapters. **AI: GPT-6.2 Sol · High.**
- [x] **15.3** Add versioned runtime validation for queues, backup files, and settings, including recovery for corrupt local data. **AI: GPT-6.2 Sol · High.**
- [x] **15.V** Pass and record [acceptance check V15](03-verification-checklist.md#v15). **AI: GPT-6.2 Sol · High.**

**Acceptance:** A renamed database column fails type checking; malformed settings and unsupported backup versions fail safely before mutation.

**Traceability:** [Review item 15](00-original-review.md#item-15); [src/shared/lib/supabase.ts:13](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/lib/supabase.ts#L13), [src/core/cloudSync.ts:20](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L20), [src/core/leitnerEngine.ts:499](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L499).

**Implementation notes / decisions / blockers:** Generated Database types, typed Supabase client and runtime validation for cards/settings/backups/card queues/story queues/drill queues; invalid data retained with recovery export. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-16"></a>

## 16. Add recoverable startup and screen error states

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** D · **Effort:** M  
**Depends on:** G0  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Published in PR #35; automated acceptance passed
**Original evidence:** Verified gap.

**Why:** A transient failure can look like an empty catalog, a stuck loader, or a blank app.

- [x] **16.1** Define loading, ready, recoverable-error, and retry states for session, catalog, and lazy screens. **AI: GPT-6.2 Sol · High.**
- [x] **16.2** Add feature error boundaries and startup rejection handling; distinguish missing catalog data from an empty list. **AI: GPT-6.2 Sol · High.**
- [x] **16.3** Inject failures and verify understandable Persian/English recovery controls without discarding queued progress. **AI: GPT-6.2 Sol · High.**
- [x] **16.V** Pass and record [acceptance check V16](03-verification-checklist.md#v16). **AI: GPT-6.2 Sol · High.**

**Acceptance:** Fail session initialization, catalog loading, and a lazy chunk independently; users receive a clear retry path and other screens remain usable where possible.

**Traceability:** [Review item 16](00-original-review.md#item-16); [src/app/App.tsx:36](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/App.tsx#L36), [src/app/useLeitnerData.ts:29](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/useLeitnerData.ts#L29), [src/main.tsx:15](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/main.tsx#L15).

**Implementation notes / decisions / blockers:** Recoverable session/catalog/content startup, retry and application boundary; bilingual story-network fault browser tests pass. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-17"></a>

## 17. Close lint warnings and split responsibilities at unstable boundaries

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** D · **Effort:** M  
**Depends on:** Passing baseline; stabilize 08 before sync refactoring  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Observed: lint succeeds with 19 warnings.

**Why:** Behavior changes are harder to isolate and effect regressions are easy to miss.

- [x] **17.1** Capture the current lint baseline and resolve or explicitly justify each of the 19 review-time warnings. **AI: GPT-6.2 Sol · Medium.**
- [x] **17.2** Extract sync transport/session responsibilities and pure review logic in small, behavior-preserving changes. **AI: GPT-6.2 Sol · Medium.**
- [x] **17.3** Add focused regression coverage and a no-new-warning CI policy; avoid unrelated framework changes. **AI: GPT-6.2 Sol · Medium.**
- [x] **17.V** Pass and record [acceptance check V17](03-verification-checklist.md#v17). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** Focused tests cover extracted boundaries and CI rejects new warnings after the baseline is clean.

**Traceability:** [Review item 17](00-original-review.md#item-17); [src/features/review/ReviewSession.tsx:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/review/ReviewSession.tsx#L1), [src/core/cloudSync.ts:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/cloudSync.ts#L1), [.github/workflows/ci.yml:21](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/.github/workflows/ci.yml#L21).

**Implementation notes / decisions / blockers:** Lint has zero warnings and fails new warnings. Story transport/store, queue validators, review helper and cloud read/admin APIs separated; regressions pass. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-18"></a>

## 18. Preview backup imports before replacing current cards

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P1 · **Phase:** B · **Effort:** M  
**Depends on:** G0; D5; shared validation contract with 15 (do not wait for all generated types)  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified destructive UX path.

**Why:** Choosing an old or wrong file can remove current progress and propagate that change to the cloud.

- [x] **18.1** Add file-size and payload validation before importing; reuse the validator designed in item 15 where available. **AI: GPT-6.2 Sol · Medium.**
- [x] **18.2** Display added/changed/removed/skipped counts and explicit merge/replace choices before mutation. **AI: GPT-6.2 Sol · Medium.**
- [x] **18.3** Require confirmation for replacement and store a recovery snapshot; test empty, malformed, old, and duplicate-card backups. **AI: GPT-6.2 Sol · Medium.**
- [x] **18.V** Pass and record [acceptance check V18](03-verification-checklist.md#v18). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** Selecting an old or empty backup changes nothing until confirmation, and the previous state can be recovered.

**Traceability:** [Review item 18](00-original-review.md#item-18); [src/features/settings/SettingsBackupModal.tsx:90](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/settings/SettingsBackupModal.tsx#L90), [src/core/leitnerEngine.ts:499](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L499).

**Implementation notes / decisions / blockers:** 10MB/10k-card import bounds, preview counts, merge/replace confirmation, pre-import recovery snapshot; engine round trips and browser cancellation pass. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-19"></a>

## 19. Make unsynced work visible and actionable

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M  
**Depends on:** 03, 08; status contracts for 02/04/05  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Published in PR #35; automated acceptance passed
**Original evidence:** Verified UI limitation.

**Why:** Users can assume work is synchronized when a feature’s queue is still failing, particularly on touch devices without hover.

- [x] **19.1** Expose pending count, last success, errors, and retry state consistently for cards, stories, and drills. **AI: GPT-6.2 Sol · Medium.**
- [x] **19.2** Add visible status and retry controls with meaningful accessible announcements. **AI: GPT-6.2 Sol · Medium.**
- [x] **19.3** Test storage-full, offline, rejected, and partially completed saves; explain pending work before sign-out. **AI: GPT-6.2 Sol · Medium.**
- [x] **19.V** Pass and record [acceptance check V19](03-verification-checklist.md#v19). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** Simulated offline and rejected saves produce visible, accurate feedback for cards, stories, and drills.

**Traceability:** [Review item 19](00-original-review.md#item-19); [src/app/Navbar.tsx:31](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/Navbar.tsx#L31), [src/features/stories/storiesSync.ts:102](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L102).

**Implementation notes / decisions / blockers:** Card/review/drill pending/error/retry signals, last successful card/story save, story pending counts, conflict history and sign-out explanation; storage-full story test. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-20"></a>

## 20. Simplify mobile navigation and preserve location in the URL

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M  
**Depends on:** Working browser validation; D7  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Published in PR #35; automated acceptance passed
**Original evidence:** Source-based UX recommendation; visual validation pending.

**Why:** Labels may be hard to scan on small screens, and browser Back/refresh cannot reliably restore a learner’s location.

- [x] **20.1** Review current mobile navigation at 320/390px, with large text, in Persian and English. **AI: GPT-6.2 Sol · Medium.**
- [x] **20.2** Choose a compact primary-navigation structure through observed usability; retain access to every destination. **AI: GPT-6.2 Sol · Medium.**
- [x] **20.3** Add URL-backed navigation and focus handling; preserve drill-abandon confirmation and validate Back/forward/reload/deep links. **AI: GPT-6.2 Sol · Medium.**
- [x] **20.V** Pass and record [acceptance check V20](03-verification-checklist.md#v20). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** At 320/390px and large text, primary destinations are clear; Back, forward, refresh, and a shared story link behave predictably.

**Traceability:** [Review item 20](00-original-review.md#item-20); [src/app/Navbar.tsx:35](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/Navbar.tsx#L35), [src/app/LeitnerApp.tsx:51](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/app/LeitnerApp.tsx#L51).

**Implementation notes / decisions / blockers:** URL-backed main tabs and validated book/story/page routes; Back/Forward/reload/locked-link browser tests, roomier mobile labels. 320px/large-text human review remains. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-21"></a>

## 21. Reduce reader tab stops and test nested dialog behavior

**Implementation AI:** GPT-6.2 Sol · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M  
**Depends on:** Working browser and screen-reader validation  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — keyboard checks pass; screen-reader observation pending
**Original evidence:** Verified implementation patterns; usability impact needs browser testing.

**Why:** Keyboard readers can face dozens of stops per paragraph; nested dialogs can compete for Escape/focus handling.

- [ ] **21.1** Observe reader keyboard traversal and screen-reader output before selecting the interaction. **AI: GPT-6.2 Sol · High.**
- [x] **21.2** Add a clear path to reading/page controls and intentional word navigation; keep word lookup keyboard accessible. **AI: GPT-6.2 Sol · High.**
- [x] **21.3** Manage the topmost modal, background interaction, Escape, and focus restoration; test nested dialogs in both languages. **AI: GPT-6.2 Sol · High.**
- [ ] **21.V** Pass and record [acceptance check V21](03-verification-checklist.md#v21). **AI: GPT-6.2 Sol · High.**

**Acceptance:** A reader can reach page controls efficiently; Escape closes only the topmost dialog and focus returns correctly.

**Traceability:** [Review item 21](00-original-review.md#item-21); [src/features/stories/StoryText.tsx:15](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/StoryText.tsx#L15), [src/shared/ui/Dialog.tsx:67](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/ui/Dialog.tsx#L67).

**Implementation notes / decisions / blockers:** Reader word roving navigation, page focus and shared modal stack/inertness; automated focus/keyboard tests. Human screen-reader review remains. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-22"></a>

## 22. Version browser security headers and verify deployed responses

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** D · **Effort:** M  
**Depends on:** Working staging deployment; resource inventory  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — live headers/assets pass; OAuth/push/CSP disposition pending
**Original evidence:** Repository configuration gap; live headers unverified.

**Why:** Explicit headers reduce the impact of script injection and unwanted embedding for an app with browser-held sessions and private cards.

- [x] **22.1** Inventory deployed/staging response headers and required resource origins. **AI: GPT-6.2 Astra · High.**
- [x] **22.2** Version a report-only CSP and other appropriate headers, then review violations before enforcement. **AI: GPT-6.2 Astra · High.**
- [ ] **22.3** Test OAuth, Supabase calls, images, fonts, workers, push, framing protection, and the policy rollback. **AI: GPT-6.2 Astra · High.**
- [ ] **22.V** Pass and record [acceptance check V22](03-verification-checklist.md#v22). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Validate login, stories, push, and assets under the policy; confirm frame protection and policy headers on deployed HTML.

**Traceability:** [Review item 22](00-original-review.md#item-22); [vercel.json:17](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/vercel.json#L17), [src/shared/lib/supabase.ts:14](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/shared/lib/supabase.ts#L14).

**Implementation notes / decisions / blockers:** nosniff/frame/referrer/permissions headers and report-only CSP in vercel.json. Hosted OAuth/header/violation review and CSP enforcement are release gates. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-23"></a>

## 23. Track the current picomatch advisory and harden dependency maintenance

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** A · **Effort:** S  
**Depends on:** G0; fresh advisory check  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Open — runtime audit clean; five build-tool findings await upstream remediation
**Original evidence:** Confirmed by npm audit and upstream advisory.

**Why:** Build/development tools still need security maintenance, but six affected packages should not be mistaken for six independent application vulnerabilities.

- [x] **23.1** Rerun the dependency audit and recheck the upstream advisory; the earlier no-fix result is a dated observation. **AI: GPT-6.2 Sol · Medium.**
- [x] **23.2** Document reachable exposure, build isolation, and interim mitigation; assign a review owner/date if upstream-blocked. **AI: GPT-6.2 Sol · Medium.**
- [ ] **23.3** Apply a reviewed dependency/lockfile update when available and verify the build/tests; add recurring dependency review to the team process. **AI: GPT-6.2 Sol · Medium.**
- [ ] **23.V** Pass and record [acceptance check V23](03-verification-checklist.md#v23). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** Document exposure and mitigation, rerun audit after upstream fixes, and run the full build/test suite after updates.

**Traceability:** [Review item 23](00-original-review.md#item-23); [package-lock.json:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/package-lock.json#L1), [package.json:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/package.json#L1).

**Implementation notes / decisions / blockers:** Fresh audit still reports five high findings; proposed automatic fixes are major toolchain downgrades. Exposure/mitigation and weekly maintainer review documented in dependency-security.md. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-24"></a>

## 24. Clarify or expand what the backup actually contains

**Implementation AI:** GPT-6.2 Sol · Medium · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M  
**Depends on:** 18; D5; schema decisions from 12  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Implemented locally
**Original evidence:** Verified scope mismatch risk.

**Why:** A user may interpret a general backup as a complete copy and discover missing progress during recovery.

- [x] **24.1** Record D5: clearly scoped cards/settings backup versus a broader export, and exclusions for ranked history. **AI: GPT-6.2 Sol · Medium.**
- [x] **24.2** Version the format and display included/excluded data before download; coordinate restore behavior with item 18. **AI: GPT-6.2 Sol · Medium.**
- [x] **24.3** Round-trip every promised data category and test compatibility with older backup versions. **AI: GPT-6.2 Sol · Medium.**
- [x] **24.V** Pass and record [acceptance check V24](03-verification-checklist.md#v24). **AI: GPT-6.2 Sol · Medium.**

**Acceptance:** A documented round-trip test demonstrates exactly which data is restored, and the UI states exclusions before download.

**Traceability:** [Review item 24](00-original-review.md#item-24); [src/core/leitnerEngine.ts:486](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L486), [src/features/stories/storiesSync.ts:20](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/stories/storiesSync.ts#L20), [src/features/adjective/drillSync.ts:22](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/features/adjective/drillSync.ts#L22).

**Implementation notes / decisions / blockers:** Version 2 backup includes cards/settings/local stories; exclusions explained; legacy/current engine round trips pass. Ranked history cannot be imported. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.

<a id="task-25"></a>

## 25. Define offline availability and recovery expectations

**Implementation AI:** GPT-6.2 Astra · High · **Review AI:** GPT-6.2 Astra · High


**Priority:** P2 · **Phase:** E · **Effort:** M/L  
**Depends on:** 10, 11; D6; coordinate cache policy with 22  
**Owner:** TBD · **Reviewer:** TBD · **PR/commit:** — · **Status:** Partial — encrypted backup prepared; activation and hosted recovery pending
**Original evidence:** Verified design limitation; deployment checks pending.

**Why:** Learners may confuse offline persistence with being able to reopen the app offline; operators also need a tested recovery path.

- [x] **25.1** Record D6: offline-after-load versus cold-offline reopening; communicate the supported behavior. **AI: GPT-6.2 Astra · High.**
- [x] **25.2** If cold-offline reopening is required, add versioned shell/content caching and a safe update strategy; otherwise document that limitation explicitly. **AI: GPT-6.2 Astra · High.**
- [ ] **25.3** Document backup retention and recovery responsibilities; rehearse a database restore in staging and measure recovery time/data loss against owner-agreed targets. **AI: GPT-6.2 Astra · High.**
- [ ] **25.V** Pass and record [acceptance check V25](03-verification-checklist.md#v25). **AI: GPT-6.2 Astra · High.**

**Acceptance:** Test a cold offline launch separately from disconnection after launch, and record a successful staging restore drill.

**Traceability:** [Review item 25](00-original-review.md#item-25); [public/sw.js:1](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/public/sw.js#L1), [src/core/leitnerEngine.ts:234](https://github.com/mrsadri/daf-leitner-box/blob/5d9f576758fe5ec93837916a7793d04aa88081f3/src/core/leitnerEngine.ts#L234).

**Implementation notes / decisions / blockers:** Owner accepted offline-after-load scope; cold-offline restart deferred. Operator restore rehearsal and recovery targets require owner staging workflow. See [evidence](04-progress.md).

**Evidence / rollout / recovery:** [Local evidence](04-progress.md); [owner handoff](05-owner-handoff.md); `docs/supabase-reliability-setup.md` for migration ordering and recovery.
