# Adjective declension contest (مسابقه صرف صفت): plan and checklist

Date: 2026-11-17. Source: the AI Studio export in `adjektivdeklination-training/` (untracked, local only).

- **Branch:** `feature/adjective-drill`, from `refactor/stories-and-cleanup` (PR #28 is not merged yet). Rebase onto `main` once #28 is merged. This work becomes **one PR**.
- **Commits** follow the order of the sections below. Each commit leaves `npm run lint`, `npm test` and `npm run build` passing.
- **Ticking boxes:** tick a box only when the step is done and checked. Write any deviation next to the box.

Legend: **[DB]** a SQL file for the owner to run in Claude Desktop; nothing is run from here. **[OWNER]** needs the owner. **[DEC]** a value the owner may still change (§9).

## 1. What we are building
- **A 5-minute drill.** The learner sees an article, an adjective and a noun in a given case. They choose the endings for the article, the adjective and the noun. A phrase scores one point only if every ending is right.
- **Entry point:** a card on the home page, under the Stories card.
- **Records:** a new tab «صفت‌ها» in «رقابت».
  - Each row is one person: rank by best score, then the person's **top 3 scores**.
  - Above the rows: the **overall record** for the selected period, **my best ever** and **my best in the last 7 days**.
  - Periods: All-time and This week, the same two as the existing board.

**Decisions the owner already made (2026-11-17):**
- Drill scores are **separate**. The Leitner score, the weekly score, the streak and silver cards do not change.
- The drill is **not linked to the Leitner box**. Wrong answers are not turned into cards. The end screen only lists them for review.
- Leitner rules do not change.

## 2. What the source contains, and what we keep
| Source file | Decision |
|---|---|
| `src/grammar.ts` (noun and adjective banks, `declinePhrase`, `generateRound`, self-test) | **Keep**, unchanged. Self-test cases become unit tests. |
| `src/components/ReferenceTables.tsx` | **Keep**, restyled with `src/shared/ui` and tokens. |
| `src/App.tsx` (drill screen, timer, speech, best score in localStorage) | **Rewrite** as a feature screen. Logic reused, UI rebuilt. |
| `src/standalone/adjektivdeklination-uebung.html` (a second copy of the app, used for the HTML download) | **Drop**. |
| `package.json` dependencies `@google/genai`, `express`, `motion`, `dotenv` | **Drop**. They are not used anywhere in `src`. |
| `README.md`, `metadata.json`, `.env.example`, `vite.config.ts`, `index.html` | **Drop** (AI Studio scaffolding). |

The source makes no requests to other hosts and has no text smaller than 12px.

## 3. Checklist

### 3.0 Preparation
- [x] Create `feature/adjective-drill` from `refactor/stories-and-cleanup` (check `git branch` first: another session may be working in this folder). *Deviation: PR #28 was already merged into `main` by the time this work started, so the branch was rebased onto `main` directly (the plan's own fallback instruction).*
- [x] Record the baseline: `npm run lint`, `npm test`, `npm run build`, main bundle size. *lint clean; 114 unit tests passing; build with placeholder Supabase keys: main bundle 760.73 kB / 216.40 kB gzip, `StoriesScreen` chunk 22.77 kB.*

### 3.1 Move the code
- [x] `src/features/adjective/grammar.ts`, copied from the source with a header comment. *Deviation: `adjektivdeklination-training/` does not exist on this machine (untracked, local-only, per §2). Written fresh from the declension rules and examples in this document (kaltem Kaffee, frische Milch, Herrn/Nachbarn/Studenten, Fahrrädern/Parks/Autos) instead of a copy; the owner should have a native speaker check it (§7).*
- [x] `tests/adjectiveGrammar.test.ts`: every case of `runDeclensionSelfTest`, plus n-Deklination (Herrn, Nachbarn, Studenten), dative plural (Fahrrädern, Parks, Autos), strong declension of uncountable nouns (kaltem Kaffee, frische Milch), and "no adjective" rounds.
- [x] Remove the self-test call from screen code (it lives in the tests now). *No self-test call was ever added to screen code; `runDeclensionSelfTest` is only called from the test file.*
- [x] `ReferenceTables.tsx` in the feature folder, on `src/shared/ui` and the tokens in `src/index.css`; gender colours `gender-m/f/n/pl`.
- [ ] Delete `adjektivdeklination-training/` after the move **[OWNER]** confirms (it is not in Git, so there is no way back). *Not applicable on this machine; the owner should check for and delete it wherever the AI Studio export actually lives.*

### 3.2 Drill screen
- [x] `src/features/adjective/DrillScreen.tsx`, loaded lazily (like `StoriesScreen`).
- [x] Phases: start → running → feedback → finished. Start screen: short explanation, reference tables, "start" button. *Implemented as start → running (each round has an internal answering/feedback sub-state) → finished; behaviourally the same four phases.*
- [x] **Timer on a fixed end time** (`endsAt = Date.now() + 300 000`). The remaining time is computed from the clock, not by counting ticks: background tabs slow down `setInterval` and would add time. Answers after `endsAt` do not count. *Extracted into `timer.ts` (`createDeadline`/`remainingMs`/`isExpired`), unit-tested.*
- [x] **Feedback never holds up the next question.** "Next" and Enter always skip ahead. Speech (via `src/shared/lib/speechService.ts`) plays if a German voice exists, but the next question does not wait for it. Otherwise people without a voice would get more time.
- [x] Keyboard: Enter, arrow keys inside an ending group. Every handler checks `isDialogOpen()` (the source does not).
- [x] Leaving mid-run (navbar, back button, notification link): a `<Dialog>` asks to confirm; a confirmed leave abandons the run (not recorded). `beforeunload` warning while running. *Navbar: guarded in `LeitnerApp` (the drill reports `onRunningChange`); the drill's own "back" control has its own confirm dialog. Back button/notification link: covered by the `beforeunload` warning (switching tabs never changes the URL in this app).*
- [x] End screen: score, "new record" only when score > previous best and score > 0, list of mistakes (correct phrase, the learner's phrase, context such as *Dativ · Maskulin · bestimmter Artikel*), "again" button, link to the records tab.
- [x] Strings in `src/i18n/fa.ts` and `en.ts`. German phrases and grammar terms (Nominativ, Artikel …) in `<De>`. Numbers through `num()` (Persian digits in fa). Logical Tailwind classes only. Smallest text 12px. *Grammar term constants (Nominativ, Maskulin, bestimmter Artikel, …) live in `grammar.ts` since they don't change with the interface language; only the surrounding commentary is in `fa.ts`/`en.ts`.*

### 3.3 App integration
- [x] New tab id `adjective` in `LeitnerApp`. Deep link `?go=adjective`.
- [x] Home card on `LeitnerDashboard` under the Stories card (`onOpenAdjective`, `data-testid="dashboard-adjective"`).
- [x] Kill switch: `app_flags.adjective_drill_enabled`, read like `src/features/stories/flag.ts`. **A missing or unreadable flag means on.** When off: no home card, `?go=adjective` falls back to the home page, and the «صفت‌ها» tab is hidden.
- [x] Gallery (`?gallery=1`): add new shared components, if any. *None added: every new component is feature-specific (`src/features/adjective/`), not a `src/shared/ui` component, so there is nothing to register.*

### 3.4 Database **[DB]**
New migration `supabase/migrations/20261117_adjective_drill.sql`. Additive only, safe to run twice.
- [x] Table `public.adjective_drill_runs`: `id uuid` (primary key), `user_id` (default `auth.uid()`, references `auth.users` on delete cascade), `score int`, `answered int`, `started_at timestamptz` (server time), `finished_at timestamptz`, `client text` (≤ 60 chars). Index on `(user_id, finished_at)` and on `finished_at`.
- [x] Row-level security: select own rows only (with `is_active_user()`). **No direct insert or update.** Writes go only through the two functions below.
- [x] `start_adjective_run()` (security definer): refuses suspended users; at most **30** started runs per user per UTC day **[DEC]**; inserts a row and returns its id.
- [x] `finish_adjective_run(p_id, p_score, p_answered)` (security definer). Accepts only if:
  - the run belongs to the caller and is not finished yet; a repeated call with the same values returns success (sending twice is safe);
  - at least **295 s** have passed since `started_at`;
  - it arrives within **24 h** of `started_at`;
  - `0 ≤ score ≤ answered ≤ 150` **[DEC]**.
- [x] `get_adjective_board(p_period text, p_limit int)` (security definer, stable), modelled on `get_leaderboard`:
  - only finished runs; `week` = `finished_at` in the last 7 days;
  - excludes suspended users; respects `show_on_leaderboard`; a hidden caller still sees their own row and where they would rank;
  - per person: `best`, `top3 int[]` (descending), `best_at`; rank by `best` desc, ties go to the earlier `best_at`;
  - also returns `my_best_all` and `my_best_week` for the caller (or a second small function `get_my_adjective_bests()`); *implemented as the separate `get_my_adjective_bests()` function;*
  - people with no run in the period are not listed;
  - limit clamped to 1…500, the caller always included.
- [x] `revoke … from public, anon; grant execute … to authenticated` for all three functions. *Four functions in total (`get_my_adjective_bests` is separate); all four revoked/granted.*
- [x] Seed `app_flags('adjective_drill_enabled', true)` with `on conflict do nothing`.
- [x] Account deletion: check `admin_delete_user` and the self-delete path; make sure runs are removed (cascade, or an explicit delete if those functions delete table by table). *`adjective_drill_runs.user_id` already cascades with `auth.users`, so `admin_delete_user()` needs no change. There is no self-delete path in the app yet.*
- [x] Update `supabase/schema.sql` so a fresh install has the same objects. *The `adjective_drill_enabled` seed line stays in the migration only, not in `schema.sql`, since `app_flags` itself is created in a later migration, not in the base schema (the same gap already exists for `stories_enabled`/`dictation_enabled`).*
- [x] `supabase/tests/adjective_drill.sql`: too-early finish, late finish, score > answered, score > cap, someone else's run, double finish, daily limit, ranking and ties, hidden user, suspended user, empty week. *Named `adjective_drill.test.sql` to match the `*.test.sql` glob `scripts/test-sql.sh` actually uses (like `cleanup.test.sql`, `overdue_overtake.test.sql`).*
- [x] `bash scripts/test-sql.sh` passes. *Verified locally (PostgreSQL 16 via Homebrew); all existing and new SQL tests pass.*
- [x] Owner guide `docs/supabase-adjective-setup.md`: steps for Claude Desktop, a check query after each step, how to switch the feature off, how to delete a single run by hand.

### 3.5 Client sync
- [x] `src/features/adjective/drillSync.ts`: `startRun()`, `finishRun()`, `fetchBoard(period)`. *Implemented as `startRun()`, `queueFinish()` + `flushQueue()`, `fetchBoard()` — the same split `cloudSync.ts`/`storiesSync.ts` already use elsewhere in this app.*
- [x] **Start fails or is offline:** the drill runs as **practice**; a banner says the result will not be recorded.
- [x] **Finish fails or is offline:** keep `{id, score, answered}` in localStorage and retry at start-up and when back online, until accepted or rejected for good. Rejected results are removed from the queue and not retried. Results older than 24 h are dropped.
- [x] Sign-out: clear the pending queue and any cached board. *No board cache exists (the board is always fetched fresh, like the Leitner leaderboard), so only the queue needed clearing.*
- [x] **Demo mode:** runs in localStorage, a fake board with a few names so the tab is not empty; no Supabase calls.

### 3.6 Records tab in «رقابت»
- [x] Two top tabs: «لایتنر» (the current board, unchanged) and «صفت‌ها». Each keeps the All-time / This week switch. The chosen tab stays selected when returning to «رقابت» during the session.
- [x] Header: overall record for the period (name and score), my best ever, my best in the last 7 days. Show "–" when there is none.
- [x] Rows: rank (crown / medals for 1–3, as now), avatar, name, best score, three score chips; missing chips show "–".
- [x] Before the board loads: send any pending finished runs first, so the caller's own row is current (like `cloudSync.flush()` today).
- [x] States: loading, error with Refresh, empty period ("no records yet" with a start button), "you are hidden" notice (reuse the existing one), feature switched off (tab hidden).
- [x] `role="tablist"` / `aria-selected` on both tab rows.

### 3.7 Tests
- [x] Unit: grammar (3.1), timer end-time logic (a hidden tab does not add time, answers after the end are ignored), pending-queue logic (retry, drop after rejection, drop after 24 h), mapping of a board row. *`tests/adjectiveTimer.test.ts`, `tests/adjectiveQueue.test.ts`; 149 unit tests passing overall.*
- [x] E2E (demo build): home card → start → answer a few rounds → time runs out (mocked clock) → end screen → «رقابت» → «صفت‌ها» shows the run; fa and en; leave-mid-run dialog; the existing "no requests to other hosts" check still passes. *`e2e/adjective.spec.ts`; run locally with Playwright (desktop + phone projects), all passing, alongside the full existing e2e suite (30/30).*
- [ ] Manual: phone width in RTL, dark mode, keyboard only, no German voice installed. *Not done by this session — phone width and fa/en were exercised through Playwright's phone project, but a real manual pass (dark mode toggle, keyboard-only navigation by hand, a device with no German voice installed) still needs the owner.*

### 3.8 Docs
- [x] `CLAUDE.md`: feature in "What this is", folder map, kill switch, table name.
- [x] `docs/architecture.md`: the new feature and its data flow.
- [x] Tick this checklist and fill in the execution status table (§8).

### 3.9 Release **[OWNER]**
- [ ] One PR, CI green.
- [ ] Owner review on the demo preview (`daf-leitner-demo-preview`).
- [ ] The owner writes the merge sentence: "merge PR #N with admin and deploy to production".
- [ ] Check `.vercelignore` (no textbook files, no `adjektivdeklination-training/`), then `vercel --prod` from `main`.
- [ ] Live check: home card, drill starts, practice banner shows before the SQL is run.
- [ ] The owner runs the SQL from `docs/supabase-adjective-setup.md` **right after** the deploy. Until then, runs are practice only and the tab shows its error state.
- [ ] Live check after SQL: a full run is recorded and appears in «صفت‌ها».

## 4. Edge cases
| Case | Handling |
|---|---|
| Background tab or locked phone | Time counts from a fixed end time; no extra time. If the run ends while hidden, the end screen shows on return and the result is sent then. |
| No German voice / no speech support | Drill runs silently; a short notice. Never waits for speech. |
| Offline at start | Practice run, clearly labelled, not recorded. |
| Offline at the end | Result queued with its run id, sent later; repeated sending is harmless. |
| Result sent after more than 24 h | Rejected by the server, removed from the queue. |
| Reload or app update mid-run | Run abandoned, not recorded. It still counts toward the daily limit. |
| Two devices or two tabs | Each run is independent; both may be recorded. |
| Score 0 | Recorded and listed, never shown as "new record". |
| Fewer than 3 runs | Missing chips show "–". |
| Equal best scores | Earlier `best_at` ranks higher; the rank number follows SQL `rank()` as on the existing board. |
| Hidden user (`show_on_leaderboard = false`) | Not shown to others; sees own row and the rank they would have. |
| Suspended user | Cannot start or finish runs; not on the board. |
| Account deleted | Runs deleted with it. |
| Daily limit reached | Start refused; drill runs as practice with a message explaining why. |
| Faked scores | Server checks (time, caps, ownership) make it harder. It cannot be fully prevented because rounds are made in the browser. The owner can delete a run by hand (guide). |
| Kill switch off mid-run | The current run finishes; the next start is not offered. |
| Dialog open while pressing Enter | Ignored by the drill (`isDialogOpen()`). |
| RTL layout | German phrases stay LTR inside `<De>`; endings chips in German order. |

## 5. Not in scope
- Turning mistakes into Leitner cards (removed by the owner, 2026-11-17).
- Counting drill scores toward Leitner points, weekly score, streak or silver cards.
- Rounds generated on the server.
- Notifications about drill records ("someone beat your record").
- The downloadable standalone HTML.

## 6. Files expected to change

As built (differs slightly from the original plan: `timer.ts`, `queue.ts` and `boardMapping.ts` were split
out of `DrillScreen.tsx`/`drillSync.ts` so their logic could be unit-tested without a browser; `EndingGroup.tsx`
is the one small shared piece of UI the drill screen and reference tables don't need, but the ending-choice
buttons did):
```
src/features/adjective/        grammar.ts, DrillScreen.tsx, EndingGroup.tsx, ReferenceTables.tsx,
                                drillSync.ts, queue.ts, boardMapping.ts, timer.ts, flag.ts, AdjectiveBoard.tsx
src/features/leaderboard/      Leaderboard.tsx (top tabs)
src/features/dashboard/        LeitnerDashboard.tsx (home card)
src/app/                       LeitnerApp.tsx (tab, deep link, flag, leave-confirm), Navbar.tsx (tab, nav-brand testid)
src/i18n/                      fa.ts, en.ts
tests/                         adjectiveGrammar.test.ts, adjectiveTimer.test.ts, adjectiveQueue.test.ts
e2e/                           adjective.spec.ts
supabase/                      migrations/20261117_adjective_drill.sql, schema.sql, tests/adjective_drill.test.sql
docs/                          supabase-adjective-setup.md, architecture.md, adjective-drill/plan-checklist.md
CLAUDE.md
```

## 7. Risks
- **Grammar content is not reviewed by a native speaker.** The rules and tests look right, but a teacher should check the noun and adjective lists once.
- **The tab depends on owner-run SQL.** Between deploy and SQL the drill works as practice only.
- **Caps are guesses.** 150 answers per run and 30 runs per day may need tuning after real use.

## 8. Execution status
| Section | Status | Notes |
|---|---|---|
| 3.0 Preparation | ☑ | Branched from `main` (PR #28 already merged); baseline recorded. |
| 3.1 Move the code | ☑ | Written fresh (no local source folder on this machine) instead of copied; everything else done. |
| 3.2 Drill screen | ☑ | Done as specified. |
| 3.3 App integration | ☑ | Done; no gallery entries needed (no new shared/ui components). |
| 3.4 Database | ☑ | Migration + schema.sql + SQL tests + owner guide; verified with a local PostgreSQL. Not run anywhere near production. |
| 3.5 Client sync | ☑ | Done (as queueFinish/flushQueue, matching this app's existing sync pattern). |
| 3.6 Records tab | ☑ | Done as specified. |
| 3.7 Tests | ☑ unit/e2e; ☐ manual | Unit + e2e written and run locally. The manual pass (dark mode, keyboard-only, no-voice device) is still the owner's. |
| 3.8 Docs | ☑ | CLAUDE.md, architecture.md, this checklist. |
| 3.9 Release | ☐ | Owner's steps: PR review, the merge sentence, deploy, owner-run SQL, live checks. |

## 9. Open values **[DEC]**
- Answer cap per run: **150**.
- Started runs per user per day: **30**.
- Minimum run length accepted by the server: **295 s** (5 min minus a small margin for network delay).
- Latest accepted finish: **24 h** after start.
