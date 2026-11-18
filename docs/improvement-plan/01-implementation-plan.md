# DaF & Mind — implementation plan

Prepared **18 November 2026**. Covers all **25 recommendations** from the [original review](00-original-review.md).

## Current implementation status

Implementation work has addressed all 25 areas, but 13 tasks remain incomplete; see [corrected remaining requirements](06-incomplete-tasks.md). [Progress and evidence](04-progress.md) supersede the original work order below; [owner handoff](05-owner-handoff.md) lists remaining staging/release/upstream gates. Approved decisions and compatibility choices are distinguished there. No production rollout has occurred.

## AI model guide

These are suggested assignments, not guarantees of correctness. Use the newest available **GPT-6.2 Sol** for focused work and **GPT-6.2 Astra** for complex concurrency, database/security design, and high-risk review. “Medium” and “High” refer to reasoning effort; use the nearest available setting. If only GPT-6.1 Sol is available, it can handle bounded tasks with the same acceptance checks; use Astra to review sensitive changes. Model labels do not replace owner decisions or release authorization. For owner-only actions, the named model assists with preparation or review while the owner performs the action.

Assignments are project-specific judgments based on [OpenAI’s model guidance](https://learn.chatgpt.com/docs/whats-new/gpt-62-astra-sol). A separate Astra review is recommended before merging data-integrity, authentication, permission, or scoring changes.

## How to use these files

1. Read this plan for sequencing and decisions. **AI: GPT-6.2 Sol · High.**
2. Work through [02-todo.md](02-todo.md); its IDs match the original review. **AI: GPT-6.2 Sol · High.**
3. Record results in [03-verification-checklist.md](03-verification-checklist.md) before closing tasks or releasing changes. **AI: GPT-6.2 Sol · High.**

All implementation tasks start **Not started**. This package is planning documentation; it does not mean fixes, staging setup, or new tests have been performed. The review is tied to commit `5d9f576758fe5ec93837916a7793d04aa88081f3`; revalidate findings against the current branch before implementation. Existing evidence and suspected risks retain their original confidence levels.

## Objective

Protect learning progress, make competitive results trustworthy, make the database reproducible, and improve recovery, accessibility, and daily usability while retaining the current feature-based architecture.

**Priority:** P1 = next reliability/security cycle; P2 = subsequent planned improvements. **Effort:** S = focused change; M = coordinated changes; L = design/integration work. Sizes are relative, not deadlines. Assign owners and estimates after Gate G0.

## Gate G0 — establish a reliable starting point

- [ ] Locate the existing clone and inspect current branch, commit, and uncommitted work; choose the intended working checkout explicitly. **AI: GPT-6.2 Sol · Medium.**
- [ ] Read current AGENTS.md and CLAUDE.md; preserve card IDs and learning-rule constraints. **AI: GPT-6.2 Sol · Medium.**
- [ ] Revalidate each original finding and record whether it still applies. **AI: GPT-6.2 Sol · Medium.**
- [ ] Restore a usable browser test environment and disposable local/staging SQL environment. **AI: GPT-6.2 Astra · High.**
- [ ] Capture baseline lint, unit, story-content, build, browser, and SQL results. Previous browser/SQL attempts were environment-blocked, not passing. **AI: GPT-6.2 Astra · High.**
- [ ] Assign an implementer and reviewer to each work package. One person may fill multiple roles, but preserve independent review for risky schema/security changes where practical. **AI: GPT-6.2 Astra · High.**
- [ ] Define staging accounts A/B/admin/suspended, synthetic learning data, and fault injection for delayed/lost responses. **AI: GPT-6.2 Sol · Medium.**
- [ ] Record a sanitized database/schema comparison supplied by the owner or obtained in staging; do not assume production matches Git. **AI: GPT-6.2 Astra · High.**

**Exit:** failures and environment gaps have owners; a testable branch and disposable database exist. Pure local regression fixes may proceed while this setup is underway, but relevant tests must pass before release.

## Work phases

| Phase | Goal / primary items | Exit evidence  Suggested AI |
|---|---|---|
| A — foundations | 10 SQL CI; 11 reproducible schema; 23 dependency triage | Role tests run; clean install and upgrade paths documented; dependency exposure tracked  Sol · High; Astra · High for schema/security review |
| B — immediate progress protection | 01 mixed review batch; 03 story save race; 08 session isolation; 09 quota upserts; 18 import preview | Targeted reproductions pass; no silent lost valid work; import is reversible and explicit  Sol · High for focused fixes; Astra · High for session/SQL review |
| C — consistent server contracts | 02 atomic/idempotent reviews; 04 story merge; 05 conflicts; 06 ranked validation; 12 story model; 15 types/validation | Concurrent and retry scenarios pass against real disposable SQL/RPCs; compatibility policy proven  Astra · High |
| D — operational and code resilience | 07 push endpoint controls; 14 delivery retries; 16 error states; 17 lint/refactoring; 22 headers | Bounded worker behavior, recoverable UI failures, clean lint policy, tested header rollout  Astra · High |
| E — usability and scale | 13 measured leaderboard optimization; 19 sync feedback; 20 navigation; 21 accessibility; 24 backups; 25 offline/restore | Browser/accessibility evidence, backup round trips, performance measurements, restore rehearsal  Sol · High; Astra · High for database/restore work |
| F — release and observation | All selected release items | Relevant checklist passes, owner review completed, release authorized, rollback and observation recorded  Astra · High |

Phases are work groups, not a rule to delay high-priority issues. Start item **07** alongside phase B once an isolated test setup exists. Begin design for **02/05/06** together early; these share transaction and scoring contracts. Design **04/12** together. Deliver a minimal import confirmation in **18** without waiting for the full type-generation work in **15**. Item **23** can be mitigated while an upstream patch is unavailable, but remains open/monitored.

## Decisions to record before dependent behavior changes

| ID | Decision | Affected items | Recommended starting position / constraint |
|---|---|---|---|
| D1 | What credit should genuinely old offline reviews receive? | 01, 02, 06 | Preserve valid work immediately; owner decides any change to date/credit rules |
| D2 | How do review, deletion, import, and nightly demotion conflicts resolve? | 02, 05 | Prefer versioned operations and explicit conflicts over silent row replacement |
| D3 | What counts as verified competitive credit, including legacy results? | 02, 06, 24 | Separate imported/self-reported progress from validated ranked results; owner approves historical treatment |
| D4 | Should quiz scores sync, and how does new content affect progress? | 04, 12 | Preserve completion; define version transitions before choosing database fields |
| D5 | Backup scope and merge versus replace behavior | 18, 24 | Show scope and diff; require confirmation for replacement and offer recovery |
| D6 | Is cold-offline reopening a requirement? What recovery targets apply? | 25 | Explicitly document current offline support; add caching only with an update strategy |
| D7 | Which mobile destinations are primary? | 20, 21 | Validate a compact navigation with Persian/English users and keyboard access |

Decision record template: **ID / owner / date / chosen behavior / alternatives / affected task IDs / acceptance examples**. These are implementation prerequisites, not requests to answer every question before starting the plan.

## Suggested pull-request boundaries

- **Foundation PRs:** SQL CI (10), then schema bootstrap/types baseline (11, part of 15); dependency tracking (23) independently.
- **Focused fixes:** story race (03), mixed review batch (01), session lifecycle (08), quota upsert (09), import preview (18) as independently reviewable changes.
- **Story contract:** additive database model/merge (04, 12), then client adoption/types (15), then restrict legacy writes after compatibility verification.
- **Review contract:** additive operation IDs/RPCs (02), client conflict handling (05), ranked validation (06); coordinate design and separate deployment steps.
- **Reminder hardening:** endpoint controls (07), then delivery claims/timeouts/retries (14).
- **Recovery/quality:** startup error states (16), focused refactors/lint (17), observable sync (19).
- **Experience/operations:** navigation (20), accessibility (21), headers (22), backup scope (24), measured database optimization (13), offline/restore (25).

Keep migration and client changes compatible across releases. “Merged” and “deployed” are separate states. Avoid a single large PR for the whole backlog.

## Database and client rollout pattern

1. Write additive migrations and tests; preserve original card identities. **AI: GPT-6.2 Astra · High.**
2. Test fresh install, upgrade, migration replay, role permissions, and representative old/new clients in disposable environments. **AI: GPT-6.2 Astra · High.**
3. Prepare the owner’s SQL guide and a recovery procedure. Data-destructive rollback must not be assumed safe. **AI: GPT-6.2 Astra · High.**
4. Deploy compatible server additions through the authorized owner workflow, then the client changes. **AI: GPT-6.2 Astra · High.**
5. Observe adoption/errors before removing old RPCs or direct write permissions. Explicitly handle old open tabs and offline queues. **AI: GPT-6.2 Astra · High.**
6. Retire old paths only with evidence that the supported-client contract is satisfied. **AI: GPT-6.2 Astra · High.**

The reviewed repository instructions state: **“Never connect to, query or change the production Supabase database from this machine.”** Production verification and SQL execution therefore belong to the owner’s documented workflow. They also require the owner’s explicit sentence **“merge PR #N with admin and deploy to production”** for merge/deploy. Read the current repository instructions again before release; this plan itself is not release authorization.

## Completion and tracking

Use states **Not started → In progress → In review → Verified in staging → Released**. Use **Blocked** with an owner and next action, or **Deferred** with a reason and review date. A checked implementation box means its specific action is done; close the whole issue only after acceptance evidence is recorded. Record release status separately.

For each item, capture: owner, reviewer, PR/commit, migration if any, decision IDs, test evidence, deployment status, and rollback/recovery notes. Do not mark a speculative risk as confirmed merely because a hardening change was made. Document when investigation rules it out.

Start with **G0 → 10 → 03**, while designing **02/05/06** and investigating **07**. This establishes meaningful database checks and closes the already reproduced story-save race early.
