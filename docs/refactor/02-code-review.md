# Refactor, phase 2: code review

Date: 2026-11-16. Reviewed against the goals in [01-intent.md](01-intent.md). Phase 3 turns this into a checklist. Every number below was measured on `main` at 7c8bf6f.

## 1. The codebase at a glance
| Area | Size | Notes |
|---|---|---|
| `src/` | 94 files, 16,100 lines | React 19, Tailwind v4, no router or state library |
| Biggest files | `i18n/fa.ts` 918, `i18n/en.ts` 904, `ReviewSession.tsx` 776, `NewWordsStudySession.tsx` 613, `leitnerEngine.ts` 540, `cloudSync.ts` 521, `ReflectionManager.tsx` 491, `App.tsx` 455, `sharedInsights.ts` 445 | Ten files over 350 lines |
| `tests/` | 26 files, 267 tests (Node test runner) | Logic only. There are no UI tests. The Playwright scripts used so far live outside the repo. |
| `scripts/` | 39 files, about 4,100 lines of Python | Mostly the dictation pipeline |
| `public/` | 852 files, 24 MB | 22 MB of it is dictation audio |
| `docs/` | 34 files, about 3,900 lines | Mostly finished plans |
| `supabase/` | `schema.sql` plus 4 migrations, SQL tests | |

## 2. What the product changes remove
| Removed | Code | Other |
|---|---|---|
| **Dictation** | `components/dictation/*`, `services/dictation/*`, `dictationSync.ts`, `types/dictation.ts`: 2,993 lines. 13 test files: 1,387 lines. About 150 lines of strings in each language file. | `public/story-media/audio` (21.6 MB, 774 files). `public/data/stories/*.audio.B.json` and `*.grammar.json`. `content/dictation/{cast,voices,abbreviations}.json` and `grammar/`. The Python audio, voice, grammar and sentence-id code (about 2,500 lines). `docs/dictation/` (17 files, 2,184 lines). `docs/supabase-dictation-setup.md`. |
| **Public insights** | `components/insights/*`, `sharedInsights.ts`, `shareLogic.ts`, most of `ReflectionManager.tsx`, and the admin moderation panel: about 1,770 lines. About 100 lines of strings in each language file. | `docs/shared-insights-plan.md`, `docs/supabase-shared-insights-setup.md`, `supabase/tests/shared_insights.test.sql` |
| **Unused dependencies** | `motion` (no file imports it) and `autoprefixer` (Tailwind v4 does its job) | Removing `motion` makes Dependabot PR #21 unnecessary |
| **Unused files** | | `public/icons/icon.svg`, `public/icons/icon-maskable.svg` (the PNGs are what's used; check whether these SVGs are the sources first). Files in the repo root the app does not need: `000-storybuilder.txt`, `000-story-dev-plan.txt`, `LOGIC_REVIEW.md` |

**Expected result:** about 5,000 lines less TypeScript, about 2,500 lines less Python, 22 MB less in `public/` and 2,000+ lines less documentation. Stories add roughly 1,000 lines back.

**What can be reused for Stories:**
- `WordSheet.tsx` and `wordLink.ts` (tap a word, see its card, add it to the box);
- `parse.py`, `normalize.py`, `linker.py`, `images.py` and `prepare_images.py`;
- the `story_progress` table.

## 3. Findings

### 3.1 Content for Stories (what already exists)
- All 10 files have exactly **6 sequences**, and each sequence has the same parts:
  - `Situation (فارسی)`;
  - `Situation (English)`;
  - `Text`;
  - **`Fragen` with 3 questions already written**.

  These questions are open questions. Turning them into multiple choice means writing one correct option and three wrong ones for each. This is less work, and closer to what the author meant, than writing 180 new questions.
- **Bold words** in the text are the lesson vocabulary. The pipeline already reads them, and they become the highlighted words.
- **Many paragraphs are a single line of dialogue.** Sequence S01-Q1 has about 20 paragraphs. One paragraph per page would mean a lot of very short pages. This needs a decision (§5).
- **The current story JSON is heavy.** Per-sentence data, audio keys and ids make it 207 to 245 KB per book. A page-based format should be well under 100 KB per book. Each book is loaded only when it is opened.

### 3.2 Database (only as SQL for the owner to run in Claude Desktop)
- **Saving progress needs no database change.** `story_progress` already lets users insert and update their own rows. The app can write one row per story directly:
  - `story_id` like `S01-Q1`;
  - pages read out of total pages;
  - `completed_at` once the quiz is answered.
- **The current save function writes to a table we will drop.** `save_dictation_progress` also writes per-sentence rows to `story_sentence_progress`. Proposal: the app writes `story_progress` directly, and the clean-up script drops the function together with the table.
- **Deleting `shared_…` cards does not touch points.** `review_events.card_id` has no foreign key, so review history and leaderboard points stay. Only the cards disappear from the boxes.
- **Edge case: old phones bring deleted copies back.** A phone still on the old version, or with unsent changes in its sync queue, can upload a `shared_…` card again after the delete. A strict constraint would reject that whole batch and leave the sync queue stuck forever.
  - **Fix:** the clean-up keeps a small trigger that **silently ignores** writes of `shared_…` ids, like the current guard does.
  - The new app also drops `shared_…` cards from its local cache and its queue.
- **Order of steps.** The clean-up script must run **after** the new app is live, so old clients don't call dropped functions while they are still open. The `stories_enabled` flag can be added at any time: when the key is missing, the app uses its built-in default, which is on.
- **What the clean-up drops:**
  - the `shared_insights` and `insight_reports` tables;
  - 10 functions: publish, unpublish, report, quota, attribution, admin keep/remove and helpers;
  - the copy index;
  - `story_sentence_progress`, `dictation_events`, `save_dictation_progress`, `dictation_status_rank`, and their limit triggers;
  - the old `dictation_enabled` key.

  Before deleting anything, it counts and backs up the `shared_…` rows and stops for the owner to confirm. `supabase/tests/*.test.sql` must be updated to match.

### 3.3 Structure and maintainability
- **`App.tsx` does too much:**
  - authentication;
  - starting sync;
  - presence;
  - push notifications;
  - overdue notices;
  - silver cards;
  - deep links;
  - tab switching;
  - 17 `useState`.

  Proposal: split it into `app/AuthGate.tsx`, `app/LeitnerApp.tsx` and a few hooks (`useCloudState`, `usePresence`, `useDeepLink`).
- **`ReviewSession` and `NewWordsStudySession` repeat each other.** Both draw the same vocabulary card: speech, perfect tense, plural, conjugation and the swipe bar. One shared `VocabCardFace` and one `useCardSession` hook would remove a few hundred lines.
- **`leitnerEngine.ts` (a singleton) and `cloudSync.ts` are sound and well tested.** They should **not** be redesigned. The only changes:
  - remove `moveBackOne`, the dictation hook;
  - remove the shared-copy handling;
  - filter `shared_…` ids.
- **`migrateLegacyLocalData` in `cloudSync.ts`** imports data from the old local-only version. It is about 60 lines. Keep it: removing it could cost data for someone who hasn't signed in since then.
- **Stale configuration:**
  - `config.ts` still describes the Supabase Storage bucket that was never used;
  - `tsconfig.json` still has AI Studio settings (`experimentalDecorators`, `useDefineForClassFields: false`, an unused `@/*` path).

### 3.4 UI consistency (design system)
- **9 separate dialog implementations**, each with its own overlay. Only 6 of them close with Esc. Focus handling differs between them.
- **No shared Button.** The primary button `bg-indigo-600 hover:bg-indigo-700` is copied 22 times and the secondary one 17 times.
- **The same input style is copied** in three files (`field`, `input`).
- **Corner radius** is used in 7 different sizes: `rounded-xl` 122 times, `rounded-lg` 58, `rounded-2xl` 56, `rounded-md` 24, and others.
- **Fixed pixel font sizes** (`text-[11px]`, `[10px]`, `[9px]`) appear 73 times. The 9 and 10 px ones are too small to read comfortably on a phone.
- **Colours:** slate, indigo, amber, emerald and red are used consistently. Blue, violet, rose, teal, orange and purple are stray uses (87 in all). They can become tokens: `primary`, `success`, `warning`, `danger`, `neutral`, `accent`.
- **Fonts:**
  - Vazirmatn and Plus Jakarta Sans load from **Google Fonts**, which can be slow or blocked in Iran. Proposal: serve them from the app itself, like D-DIN. Nothing changes visually.
  - Stories need a rounded reading font, also served from the app.

### 3.5 Readability for AI agents
- **There is no `CLAUDE.md` or `AGENTS.md`.** The critical rules (production database, copyright, the merge sentence, the app not being official) exist only in session memory.
- **The folder layout is by type** (`components/` and `services/` side by side). A feature's code is spread across 3 to 5 folders.
- **Header comments.** Dictation and recent modules have good ones. Older files (`ReviewSession`, `VocabCatalog`, `LeitnerDashboard`, `App`) have none.
- **Stale documents mislead agents.** Most of `docs/` describes finished plans or features being removed. An agent reading them would believe dictation and sharing still exist.

### 3.6 Tooling and tests
- **TypeScript `strict` can be turned on with zero errors.** It costs nothing and catches more mistakes.
- **There is no ESLint.** `npm run lint` is only `tsc`. Proposal: ESLint 9 with typescript-eslint, `react-hooks` and `jsx-a11y`. These are development tools only.
- **No test exercises the UI**, which is why the silver-card bug got through. Proposal: commit a Playwright smoke test (demo mode, phone and desktop width, Persian and English) and run it in CI.
- **CI** runs the dictation Python tests and the `stage_media.py --check` step. These change along with the scripts.
- **knip** found 18 unused exports. Most are constants exported only for tests, which is fine. The real leftovers go with the dictation and insights removal.

## 4. Risks found while reviewing
| Risk | Mitigation |
|---|---|
| Old clients bring back `shared_…` copies after the delete | Silent-ignore trigger, plus a client-side filter (§3.2) |
| An old open tab calls a dropped function | The clean-up SQL runs after deploy. The old client already handles failed calls without crashing (to be checked in phase 3). |
| Word links for books 3 to 10 have never been reviewed. The linker may attach a word to the wrong card. | The build report lists low-confidence links. Those are left unlinked instead of guessed, and the owner can spot-check them. |
| Turning on `strict` or ESLint produces a flood of changes mixed into the feature work | A separate commit at the start of the PR |
| One big PR | Commits in a readable order, tests at every commit, and the current deployment kept for rollback |

## 5. Decisions (taken 2026-11-16)
1. **Pages:** about 60 to 120 words. Paragraphs are grouped when the content is built and are never split.
2. **Quiz:** the 3 existing `Fragen` of each sequence, rewritten as multiple choice. A question with two parts becomes one question.
3. **Old documents:** deleted. Git keeps the history.
4. **UI tests:** Playwright in the repo and in CI.

The questions as they were asked:

1. **Page size in the reader.** One source paragraph per page, or pages of about 60 to 120 words made by grouping short paragraphs (dialogue)? Recommendation: group them.
2. **Quiz questions.** Build them from the 3 existing `Fragen` of each sequence (rewritten as multiple choice), or write new ones? Recommendation: build from the existing ones.
3. **Old documents.** Delete finished plans and feature docs (Git keeps the history), or move them to `docs/archive/`? Recommendation: delete them. Keep only living documents: README, the Supabase setup for current features, icon credits and the refactor docs.
4. **UI tests.** Playwright smoke tests in the repo and in CI, or also component tests (React Testing Library and a DOM environment)? Recommendation: Playwright only. One tool, and it tests what users actually see.

Defaults assumed without asking (the owner can change them):
- serve Vazirmatn and Plus Jakarta Sans from the app;
- turn on TypeScript `strict`;
- add ESLint;
- keep the language strings in `src/i18n/` and order them by feature inside the files, instead of splitting them into feature folders;
- keep `migrateLegacyLocalData`.
