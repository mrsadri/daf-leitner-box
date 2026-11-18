# DaF & Mind — verification and release checklist

[Plan](01-implementation-plan.md) · [To-do list](02-todo.md) · [Original review](00-original-review.md)

Prepared 18 November 2026. Checked boxes below have current local evidence; hosted, human and release checks remain unchecked. Earlier passing tests alone are not proof of future fixes. Record **commit, environment, command/scenario, result, evidence location, and reviewer** for each completed check. If a check is blocked, state why and assign the next action; do not tick it as passed.

## AI model guide

These are suggested assignments, not guarantees of correctness. Use the newest available **GPT-6.2 Sol** for focused work and **GPT-6.2 Astra** for complex concurrency, database/security design, and high-risk review. “Medium” and “High” refer to reasoning effort; use the nearest available setting. If only GPT-6.1 Sol is available, it can handle bounded tasks with the same acceptance checks; use Astra to review sensitive changes. Model labels do not replace owner decisions or release authorization. For owner-only actions, the named model assists with preparation or review while the owner performs the action.

Assignments are project-specific judgments based on [OpenAI’s model guidance](https://learn.chatgpt.com/docs/whats-new/gpt-62-astra-sol). A separate Astra review is recommended before merging data-integrity, authentication, permission, or scoring changes.

## Current evidence

See [progress](04-progress.md) for current counts/commands and [owner handoff](05-owner-handoff.md) for remaining gates. PR #32 release evidence is recorded separately; the new follow-up uses local acceptance and anonymous public HTTP checks. No independent human review is claimed.

## Environment and baseline

- [x] Current source revision and applicable repository instructions recorded. **AI: GPT-6.2 Sol · High.**
- [ ] Baseline npm dependencies installed reproducibly from the lockfile. **AI: GPT-6.2 Sol · High.**
- [x] `npm run lint` results recorded; review-time baseline was 19 warnings. **AI: GPT-6.2 Sol · High.**
- [x] `npm test` results recorded; review-time baseline was 190 passing tests. **AI: GPT-6.2 Sol · High.**
- [x] `python3 -m unittest discover scripts/stories/tests` results recorded; prior baseline was 28 passing tests. **AI: GPT-6.2 Sol · High.**
- [x] `python3 scripts/stories/build_stories.py --check` passes. **AI: GPT-6.2 Sol · High.**
- [x] Production build and demo build succeed; production test configuration actually includes the intended application code. An unconfigured build alone does not verify Auth or RPC behavior. **AI: GPT-6.2 Astra · High.**
- [x] Browser tests run to assertions. Local Chrome launch restriction resolved through the approved local test command. **AI: GPT-6.2 Sol · High.**
- [x] Disposable SQL tests run to assertions. Native local PostgreSQL now runs through the approved disposable test command. **AI: GPT-6.2 Astra · High.**
- [x] Synthetic users A/B/admin/suspended and deterministic data fixtures are available. **AI: GPT-6.2 Sol · High.**
- [x] Transport fault cases include delay, disconnect before commit, lost response after commit, and concurrent clients. **AI: GPT-6.2 Sol · High.**

## Item-by-item acceptance

<a id="v01"></a>

### V01 — Preserve valid reviews when an offline batch contains an expired event

**Verification AI:** GPT-6.2 Sol · High


- [x] Queue one expired review plus one valid review; the valid review must be stored exactly once and the rejected review must be explained. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified in source. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-01)

<a id="v02"></a>

### V02 — Make review submission idempotent and transactional

**Verification AI:** GPT-6.2 Astra · High


- [x] Simulate response loss after commit and retry; assert one event and one state transition. Simulate a failed event validation and verify atomic behavior. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified design gap. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-02)

<a id="v03"></a>

### V03 — Keep newer changes pending while a story save is in flight

**Verification AI:** GPT-6.2 Sol · High


- [x] Delay the first response, save a newer page, release it, then flush again: the newer progress must be sent. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Reproduced with actual store logic and a mocked transport. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-03)

<a id="v04"></a>

### V04 — Merge story progress atomically in PostgreSQL

**Verification AI:** GPT-6.2 Astra · High


- [x] Two independent clients submit page 5 and page 2 in both orders; the row must retain page 5 and an existing completion. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified design gap; cross-device behavior inferred. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-04)

<a id="v05"></a>

### V05 — Define conflict handling for cards and settings across devices

**Verification AI:** GPT-6.2 Astra · High


- [x] Exercise offline edits from two devices plus a nightly demotion; assert the agreed resolution and explain conflicts to the user. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified design gap. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-05)

<a id="v06"></a>

### V06 — Make competitive results server-verifiable

**Verification AI:** GPT-6.2 Astra · High


- [x] In a disposable environment, attempt an impossible transition and an unsupported score; neither should receive ranked credit. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified trust-boundary gap. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-06)

<a id="v07"></a>

### V07 — Validate push destinations before the privileged worker fetches them

**Verification AI:** GPT-6.2 Astra · High


- [x] Use a mocked fetch/isolated test server to verify that disallowed destinations and redirects are rejected; never test against production internal addresses. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Potential SSRF risk from source; not exploited. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic fixtures · **Evidence:** `tests/pushEndpoint.test.ts` (V07), `npm run db:upgrade:check` (V11) · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-07)

<a id="v08"></a>

### V08 — Bind sync state and pending requests to a single user session

**Verification AI:** GPT-6.2 Astra · High


- [x] Switch A→signed-out→B while A has pending writes and a delayed startup request; no A content may enter B’s engine or outgoing queue. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Source-derived risk requiring an integration test. **AI: GPT-6.2 Astra · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-08)

<a id="v09"></a>

### V09 — Allow updates at the card quota and make limits concurrency-safe

**Verification AI:** GPT-6.2 Astra · High


- [x] At the cap, updating an existing card succeeds and inserting a new one fails; parallel inserts cannot exceed the quota. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified trigger defect. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-09)

<a id="v10"></a>

### V10 — Run database authorization and migration tests in CI

**Verification AI:** GPT-6.2 Sol · High


- [x] A deliberately broken owner policy or non-replayable migration causes CI to fail. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified coverage gap. **AI: GPT-6.2 Sol · High.**

**Result:** Pass · **Commit/environment:** `33f0583`; local isolated/native PostgreSQL and GitHub CI · **Evidence:** [CI run](https://github.com/mrsadri/daf-leitner-box/actions/runs/44278415253) including RLS mutation detection · **Reviewer:** coding agent; independent security review remains a separate gate
[Implementation tasks](02-todo.md#task-10)

<a id="v11"></a>

### V11 — Create one reproducible, versioned schema installation path

**Verification AI:** GPT-6.2 Astra · High


- [x] A clean environment gains every current table/RPC, and an upgraded environment has an equivalent schema. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified maintainability gap. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic fixtures · **Evidence:** `tests/pushEndpoint.test.ts` (V07), `npm run db:upgrade:check` (V11) · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-11)

<a id="v12"></a>

### V12 — Give story progress a current, constrained data model

**Verification AI:** GPT-6.2 Astra · High


- [x] Malformed IDs/counts are rejected and an intended complete story record survives a cross-device round trip. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified schema gap. **AI: GPT-6.2 Astra · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-12)

<a id="v13"></a>

### V13 — Measure and reduce leaderboard aggregation cost

**Verification AI:** GPT-6.2 Sol · High


- [ ] Record p50/p95 timings and query plans at realistic volumes; demonstrate improvement without changing ranking results. **AI: GPT-6.2 Sol · High.**
- [ ] Evidence recorded and assessed against the original confidence level: Optimization candidate; no production timings collected. **AI: GPT-6.2 Sol · High.**

**Result:** Pending · **Commit/environment:** — · **Evidence:** — · **Reviewer:** —  
[Implementation tasks](02-todo.md#task-13)

<a id="v14"></a>

### V14 — Make reminder delivery bounded and safe to retry

**Verification AI:** GPT-6.2 Astra · High


- [x] Overlap two invocations and inject a timeout/crash; verify bounded duration and controlled duplicate behavior. **AI: GPT-6.2 Astra · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified design gap. **AI: GPT-6.2 Astra · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-14)

<a id="v15"></a>

### V15 — Generate database types and validate persisted/imported data

**Verification AI:** GPT-6.2 Sol · High


- [x] A renamed database column fails type checking; malformed settings and unsupported backup versions fail safely before mutation. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified maintainability gap. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-15)

<a id="v16"></a>

### V16 — Add recoverable startup and screen error states

**Verification AI:** GPT-6.2 Sol · High


- [x] Fail session initialization, catalog loading, and a lazy chunk independently; users receive a clear retry path and other screens remain usable where possible. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified gap. **AI: GPT-6.2 Sol · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-16)

<a id="v17"></a>

### V17 — Close lint warnings and split responsibilities at unstable boundaries

**Verification AI:** GPT-6.2 Sol · High


- [x] Focused tests cover extracted boundaries and CI rejects new warnings after the baseline is clean. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Observed: lint succeeds with 19 warnings. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-17)

<a id="v18"></a>

### V18 — Preview backup imports before replacing current cards

**Verification AI:** GPT-6.2 Sol · High


- [x] Selecting an old or empty backup changes nothing until confirmation, and the previous state can be recovered. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified destructive UX path. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-18)

<a id="v19"></a>

### V19 — Make unsynced work visible and actionable

**Verification AI:** GPT-6.2 Sol · High


- [x] Simulated offline and rejected saves produce visible, accurate feedback for cards, stories, and drills. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified UI limitation. **AI: GPT-6.2 Sol · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-19)

<a id="v20"></a>

### V20 — Simplify mobile navigation and preserve location in the URL

**Verification AI:** GPT-6.2 Sol · High


- [x] At 320/390px and large text, primary destinations are clear; Back, forward, refresh, and a shared story link behave predictably. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Source-based UX recommendation; visual validation pending. **AI: GPT-6.2 Sol · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-20)

<a id="v21"></a>

### V21 — Reduce reader tab stops and test nested dialog behavior

**Verification AI:** GPT-6.2 Sol · High


- [x] A reader can reach page controls efficiently; Escape closes only the topmost dialog and focus returns correctly. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified implementation patterns; usability impact needs browser testing. **AI: GPT-6.2 Sol · High.**

**Result:** Local acceptance pass · **Commit/environment:** candidate `codex/backlog-acceptance`; synthetic transports/PostgreSQL/demo browser · **Evidence:** [follow-up report](09-backlog-acceptance.md) · **Reviewer:** coding agent; not a human screen-reader review
[Implementation tasks](02-todo.md#task-21)

<a id="v22"></a>

### V22 — Version browser security headers and verify deployed responses

**Verification AI:** GPT-6.2 Astra · High


- [ ] Validate login, stories, push, and assets under the policy; confirm frame protection and policy headers on deployed HTML. **AI: GPT-6.2 Astra · High.**
- [ ] Evidence recorded and assessed against the original confidence level: Repository configuration gap; live headers unverified. **AI: GPT-6.2 Astra · High.**

**Result:** Pending · **Commit/environment:** — · **Evidence:** — · **Reviewer:** —  
[Implementation tasks](02-todo.md#task-22)

<a id="v23"></a>

### V23 — Track the current picomatch advisory and harden dependency maintenance

**Verification AI:** GPT-6.2 Sol · High


- [ ] Document exposure and mitigation, rerun audit after upstream fixes, and run the full build/test suite after updates. **AI: GPT-6.2 Sol · High.**
- [ ] Evidence recorded and assessed against the original confidence level: Confirmed by npm audit and upstream advisory. **AI: GPT-6.2 Sol · High.**

**Result:** Pending · **Commit/environment:** — · **Evidence:** — · **Reviewer:** —  
[Implementation tasks](02-todo.md#task-23)

<a id="v24"></a>

### V24 — Clarify or expand what the backup actually contains

**Verification AI:** GPT-6.2 Sol · High


- [x] A documented round-trip test demonstrates exactly which data is restored, and the UI states exclusions before download. **AI: GPT-6.2 Sol · High.**
- [x] Evidence recorded and assessed against the original confidence level: Verified scope mismatch risk. **AI: GPT-6.2 Sol · High.**

**Result:** Pass locally · **Commit/environment:** uncommitted canonical checkout; synthetic PostgreSQL/Node/demo fixtures · **Evidence:** [progress](04-progress.md), named tests in repository · **Reviewer:** coding agent; independent review pending  
[Implementation tasks](02-todo.md#task-24)

<a id="v25"></a>

### V25 — Define offline availability and recovery expectations

**Verification AI:** GPT-6.2 Astra · High


- [ ] Test a cold offline launch separately from disconnection after launch, and record a successful staging restore drill. **AI: GPT-6.2 Astra · High.**
- [ ] Evidence recorded and assessed against the original confidence level: Verified design limitation; deployment checks pending. **AI: GPT-6.2 Astra · High.**

**Result:** Pending · **Commit/environment:** — · **Evidence:** — · **Reviewer:** —  
[Implementation tasks](02-todo.md#task-25)

## Cross-feature regression matrix

Run relevant rows after changes to the shared engine, sync, session, navigation, or storage. Use real disposable RPC/database integration for server guarantees; demo mode alone cannot test them.

| Scenario | Expected result | State |
|---|---|---|
| Online → offline → reconnect → reload | Valid work preserved and acknowledged exactly once | [ ] · AI: GPT-6.2 Sol · High |
| Two devices edit the same card/story | Agreed conflict policy and monotonic story progress hold | [ ] · AI: GPT-6.2 Astra · High |
| Delayed save followed by a newer local change | New revision remains queued until acknowledged | [ ] · AI: GPT-6.2 Sol · High |
| User A signs out, B signs in; A request finishes late | No A data or operations enter B’s session | [ ] · AI: GPT-6.2 Astra · High |
| Token expiry / suspension / rejected write | Clear recovery or access state; no endless silent failure | [ ] · AI: GPT-6.2 Astra · High |
| Old client/open tab after additive schema rollout | Compatibility behavior matches documented support | [ ] · AI: GPT-6.2 Astra · High |
| Empty/invalid/old backup chosen | No mutation before validation and confirmation | [ ] · AI: GPT-6.2 Sol · High |
| Storage full or unavailable | User sees unsaved-state risk and a supported recovery route | [ ] · AI: GPT-6.2 Sol · High |
| Persian RTL and English LTR | Labels, focus, numbers, and German text retain correct direction | [ ] · AI: GPT-6.2 Sol · High |
| 320px / 390px / desktop; enlarged text | Controls and content remain usable without lost actions | [ ] · AI: GPT-6.2 Sol · High |
| Keyboard + screen reader + nested dialogs | Efficient navigation, visible focus, topmost Escape, focus restoration | [ ] · AI: GPT-6.2 Sol · High |
| Browser Back / forward / reload / direct link | Location and drill-leave protection behave consistently | [ ] · AI: GPT-6.2 Sol · High |
| New CSP and cache policy | Login, data, images, fonts, worker, and updates still work | [ ] · AI: GPT-6.2 Sol · High |
| Overlapping reminder invocations / failed endpoint | Bounded runtime, ownership-safe claims, documented retry behavior | [ ] · AI: GPT-6.2 Astra · High |
| Staging backup restore | Data and permissions restored within agreed recovery targets | [ ] · AI: GPT-6.2 Astra · High |

## Production-state evidence to obtain through the owner workflow

- [ ] Sanitized applied-migration/schema/grant comparison against the implementation revision. **AI: GPT-6.2 Astra · High.**
- [ ] Auth redirect and deployment configuration reviewed. **AI: GPT-6.2 Astra · High.**
- [ ] Relevant RLS policies, RPC grants/search paths, and database advisor findings reviewed. **AI: GPT-6.2 Sol · High.**
- [ ] Scheduler/Edge Function authentication and error metrics reviewed. **AI: GPT-6.2 Astra · High.**
- [ ] Deployed response headers verified; any hosting overrides recorded. **AI: GPT-6.2 Astra · High.**
- [ ] Backup retention, restoration responsibility, and recovery drill evidence recorded. **AI: GPT-6.2 Astra · High.**

## Before merging a selected release

- [ ] Selected issue IDs and scope are explicit; deferred work has an owner, reason, and review date. **AI: GPT-6.2 Astra · High.**
- [ ] Applicable D1–D7 decisions are recorded; learning rules have owner agreement where required. **AI: GPT-6.2 Astra · High.**
- [ ] Targeted acceptance checks and relevant regression checks pass at the PR head. **AI: GPT-6.2 Sol · High.**
- [ ] Required lint, unit, content, build, browser, SQL and security checks pass or have a clearly recorded owner disposition; blocked checks are not labeled passing. **AI: GPT-6.2 Astra · High.**
- [ ] Dependency findings are triaged with exposure and mitigation; an unresolved advisory is tracked rather than silently waived. **AI: GPT-6.2 Sol · High.**
- [ ] Migrations are tested for clean install, upgrade, replay, permissions, and old/new-client compatibility. **AI: GPT-6.2 Astra · High.**
- [ ] Preview reviewed by the owner in both interface languages for affected flows. **AI: GPT-6.2 Astra · High.**
- [ ] Recovery/rollback procedure preserves user data and queues; migration recovery is distinguished from a frontend rollback. **AI: GPT-6.2 Astra · High.**
- [ ] Current repository merge/deploy authorization requirement satisfied for this specific PR. **AI: GPT-6.2 Astra · High.**

## Deployment and observation

- [ ] Owner applies authorized database steps using the documented workflow and records outcomes. **AI: GPT-6.2 Astra · High.**
- [ ] Compatible frontend/backend rollout sequence followed; old write paths removed only after the compatibility gate. **AI: GPT-6.2 Astra · High.**
- [ ] Deployment commit/version, date, migration versions, and operator recorded. **AI: GPT-6.2 Astra · High.**
- [ ] Login, review, story progression, sync, and affected features checked through the authorized release workflow. **AI: GPT-6.2 Astra · High.**
- [ ] Agreed observation window, responsible person, and rollback triggers recorded before rollout. **AI: GPT-6.2 Astra · High.**
- [ ] Observe sync rejection/duplicate rates, pending-queue age, RPC latency, reminder failures, and frontend recovery errors without logging private card contents. **AI: GPT-6.2 Astra · High.**
- [ ] Close released tasks with evidence; keep staging-only, blocked, upstream-dependent, and deferred tasks visibly open. **AI: GPT-6.2 Astra · High.**

## Evidence record template

```text
Task/check ID:
Implementer / reviewer:
PR / commit / migration:
Decision IDs:
Environment and synthetic fixture:
Command or manual scenario:
Expected / actual result:
Log, screenshot, or test artifact:
Remaining limitations:
Release version/date:
Recovery plan and observation result:
Next action / owner / review date (if still open):
```
