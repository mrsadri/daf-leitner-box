# Refactor, phase 3: plan and checklist

Date: 2026-11-16. Based on [01-intent.md](01-intent.md) and [02-code-review.md](02-code-review.md).

- **Branch:** `refactor/stories-and-cleanup`, which becomes **one PR**.
- **Commits** follow the order below. Each commit leaves `npm run lint`, `npm test`, `npm run build` and the Python tests passing.
- **Ticking boxes:** tick a box only when the step is done and checked. Write any deviation next to the box.

Legend: **[DB]** a SQL file for the owner to run in Claude Desktop; nothing is run from here. **[OWNER]** needs the owner. **[DEC]** a decision still open (§10).


## Execution status (2026-11-16)
Commits on `refactor/stories-and-cleanup`, in this order. The order changed from the plan on purpose: code to be deleted was removed first, so it was never moved or restyled.

| Section | Status | Notes |
|---|---|---|
| 0 Preparation | ✅ | #27 cherry-picked. Baseline: 64 screenshots, bundle 373.6 kB main + 50.7 kB dictation chunk. |
| 1 Tooling | ✅ with deviations | `strict` on (0 errors). **oxlint instead of ESLint**: typescript-eslint cannot run on TypeScript 7. Playwright in `e2e/` and in CI. A `--mode demo` build for tests and previews. Fonts served from the app (screenshots identical). |
| 5.17 Dictation removed | ✅ | Code, audio (21.6 MB), Python pipeline. `moveBack` kept. Old localStorage keys removed at start-up. |
| 4 Insights | ✅ | Sharing removed. MyCards in the word bank (lesson menu «کارت‌های من»). `shared_…` filtered in the cache and the queue. |
| 3.1 / 3.2 Folders, App split | ✅ | Two logic files renamed (case clash with a component). `App.tsx` 405 lines → 6 files, the largest 215. |
| 2 Design system | ✅ mostly | Tokens, components and gallery. All 9 dialogs on `Dialog`. **2.5 partly**: new and migrated screens use `Button` and the fields; older screens still carry their own button classes (follow-up). **2.6**: 12px floor (trail labels 10px on phones, documented). Stray colours are kept where they carry meaning. |
| 3.3 VocabCardFace | ⏸ deferred | Not done in this PR. The review screen is used by every learner daily; extracting the shared card face deserves its own PR with a screenshot-by-screenshot comparison. |
| 3.4 Header comments | ✅ | Every file in `src/`. |
| 5 Stories | ✅ | 60 stories, 180 questions, reader, word sheet, gender underlines, progress, kill switch, e2e in fa/en. Books 3 and 4 also have pictures (commit 8c7f38f). |
| 6 Database | ✅ (file only) | Clean-up migration, SQL test, owner guide. Not run. |
| 7 Files | ✅ | Docs deleted. Local work folder out of Git. SVG sources moved to `design/`. |
| 8 Docs | ✅ | CLAUDE.md, AGENTS.md, architecture.md, README, CONTRIBUTING. |
| 9 Verification | ✅ | lint, 114 unit tests, 28 Python tests, content check, SQL harness and 20 Playwright tests pass. Main bundle 353.7 kB (−20 kB), Stories chunk 22.7 kB. Upload estimate 12.7 MB, no textbook files. No secrets in the diff. |
| 10 Release | ⏳ | Waiting for the owner. |

---

## 0. Preparation
- [ ] 0.1 Bring the `.vercelignore` change from PR #27 onto the branch (cherry-pick), then close #27 with a note.
- [ ] 0.2 Before changing anything, take a **baseline screenshot set** of the current app in demo mode (every tab and dialog; phone and desktop; Persian and English; light and dark). It is the reference for "nothing changed by accident".
- [ ] 0.3 Record the current bundle sizes (`vite build` output) for the comparison at the end.

## 1. Tooling (commit "Tooling: strict TS, ESLint, Playwright, self-hosted fonts")
- [ ] 1.1 Clean up `tsconfig.json`:
  - turn on `strict: true`;
  - remove the AI Studio settings (`experimentalDecorators`, `useDefineForClassFields`, the `@/*` path, `allowJs`).
- [ ] 1.2 Add ESLint 9 with a flat config: `typescript-eslint`, `eslint-plugin-react-hooks` and `eslint-plugin-jsx-a11y`.
  - `npm run lint` runs `tsc` and then `eslint`.
  - Fix the findings. Rules that would need large rewrites are set to "warn" and listed in the PR.
- [ ] 1.3 Remove the unused dependencies `motion` and `autoprefixer`.
- [ ] 1.4 Add Playwright as a development dependency and create `e2e/`:
  - **smoke test:** every tab opens without console errors or failed requests;
  - **no horizontal scroll** at 360 px;
  - **dialogs:** each one opens, closes with Esc and returns focus;
  - **runs on:** phone (390×844) and desktop (1280×800), in Persian and English, against `vite preview` in demo mode.
- [ ] 1.5 CI: add an `e2e` job that installs Chromium, builds in demo mode and runs Playwright.
- [ ] 1.6 Serve Vazirmatn and Plus Jakarta Sans from the app as woff2 files in `public/fonts/`, under the OFL licence (licence files included). Remove the Google Fonts links from `index.html`. The screenshots must match the baseline.

## 2. Design system (commit "Design system: tokens, shared components, gallery")
- [ ] 2.1 **Tokens** in `src/index.css` (`@theme`):
  - **colours** named by role: `primary` (indigo), `success` (emerald), `warning` (amber), `danger` (red), `neutral` (slate), plus `paper` and `ink` for Stories;
  - **3 corner radii:** `control`, `card` and `sheet`;
  - **font sizes** with **12 px as the smallest**;
  - **2 shadows**.

  Dark-mode values are set right next to each token.
- [ ] 2.2 **Shared components** in `src/shared/ui/`, each with a header comment and a typed props interface:
  - `Button` (primary, secondary, ghost and danger; sizes sm and md; loading state) and `IconButton`, which requires `aria-label`;
  - `Dialog`, the only modal frame. It handles the overlay, Esc, clicking outside, keeping focus inside, returning focus when it closes, locking page scroll, and blocking review keyboard shortcuts behind it, which the silver-card dialog already does;
  - `Sheet`, a bottom sheet built on `Dialog`;
  - `Card`, `Badge`/`Chip`, `SegmentedControl` and `ProgressDots`;
  - the form fields `TextField`, `TextArea` and `Select`;
  - `EmptyState`.
- [ ] 2.3 **Gallery** `src/shared/ui/Gallery.tsx`:
  - opens with `?gallery=1`, only in development and demo builds; it is never in the production bundle (check the build output);
  - shows every component in every state, in light and dark, LTR and RTL.
- [ ] 2.4 **Move all 9 dialogs** to `Dialog`/`Sheet`: admin, conjugation, dashboard, new card, overdue notice, silver cards and the word sheet. The 2 insights and dictation dialogs are deleted instead.
- [ ] 2.5 Replace the copied button and field class strings with `Button` and the form field components.
- [ ] 2.6 Replace 9 and 10 px text with at least 12 px. Fold the stray colours into the role tokens.
  - This is the only planned **visible** change in this section.
  - Compare it with the baseline and list every visible difference in the PR.
- [ ] 2.7 **Tests:** Playwright opens the gallery and checks each component for console errors. The Esc, focus and scroll-lock behaviour of `Dialog` is tested once in the gallery.

## 3. Folder layout and `App.tsx` (commit "Feature folders", moves only)
- [ ] 3.1 Move the files with `git mv`, so Git keeps each file's history. The import paths change; the logic does not.
  ```
  src/
    app/        App.tsx, AuthGate.tsx, LeitnerApp.tsx, Navbar.tsx, hooks (useCloudState, usePresence, useDeepLink)
    core/       leitnerEngine.ts, cloudSync.ts, types.ts, dates.ts      (the data heart; no UI)
    features/
      dashboard/  LeitnerDashboard, MetroMap, MountainTrail, OverdueNotice, overdue*.ts, lessonProgress.ts
      review/     ReviewSession, VocabCardFace, PerfektQuiz, PerfektGuide, PluralInfo, ConjugationDialog,
                  perfekt*.ts, plural.ts, conjugation.ts, vocabText.ts, swipe.ts
      learn/      NewWordsStudySession
      vocab/      VocabCatalog, NewCardModal, MyCards (insights), csvParser.ts
      stories/    (section 5)
      silver/     SilverCards, silver.ts, silverLogic.ts, silverFacts.ts
      leaderboard/ Leaderboard
      onboarding/ Onboarding, Illustrations, onboarding.ts
      settings/   SettingsBackupModal, AppInstall, pwa.ts
      admin/      AdminPanel
      auth/       LoginScreen
    shared/
      ui/       the design system + Text, Icon3D, Credit, LanguageSwitch, SwipeCard, RoundActionBar
      lib/      supabase.ts, demo.ts, haptics.ts, soundService.ts, speechService.ts, voices.ts
    i18n/       unchanged location; sections reordered to follow the features
  ```
  The tests stay in `tests/` (the Node test runner's glob). Only their import paths change.
- [ ] 3.2 **Split `App.tsx`:**
  - `AuthGate` and `LeitnerApp` go to their own files;
  - the startup work (sync, presence, push, silver, overdue, deep links) goes into hooks.

  Aim: `LeitnerApp.tsx` under 250 lines.
- [ ] 3.3 **Extract `VocabCardFace`:** the card face that `ReviewSession` and `NewWordsStudySession` share (speech, perfect tense, plural, conjugation). Aim: both files under 450 lines. The screenshots must match the baseline.
- [ ] 3.4 Add a **header comment to every module that has none**: what it does, what it depends on, and what must not change.

## 4. Insights (commit "Insights: remove public sharing, my cards in the vocabulary bank")
- [ ] 4.1 **Delete:**
  - `components/insights/*`, `sharedInsights.ts` and `shareLogic.ts`, with their tests and strings;
  - the admin moderation section;
  - the author line on shared copies in `ReviewSession`;
  - `resetSharedState` in `App`.
- [ ] 4.2 **Shared copies:**
  - `leitnerEngine.hydrate` and `readCache` **drop `shared_…` ids**;
  - the sync queue drops queued upserts for them.

  Unit tests cover both. Old cached copies then disappear from the phone without errors.
- [ ] 4.3 **`MyCards`** in `features/vocab/`, based on the "mine" part of `ReflectionManager`:
  - a list, plus add, edit and delete;
  - all **5 categories**;
  - the "review" button stays.
- [ ] 4.4 **Vocabulary bank:** the lesson menu gets the first entry «کارت‌های من» / "My cards". When it is chosen, the word filters are hidden and `MyCards` is shown.
- [ ] 4.5 **Navigation:**
  - remove the `reflections` tab;
  - the dashboard and `?go=` links that pointed to insights now open the vocabulary bank on «کارت‌های من»;
  - the "new card" dialog still offers the insight type.
- [ ] 4.6 **Tests:**
  - unit tests for the filter;
  - Playwright: open «کارت‌های من», add, edit and delete a card in demo mode;
  - there is no `reflections` tab.

## 5. Stories (commits "Stories: content build" and "Stories: reader")

### 5a. Content build (Python, standard library + Pillow for images)
- [ ] 5.1 **`scripts/stories/`** (renamed from `scripts/dictation`). It **keeps** `parse.py`, `normalize.py`, `linker.py`, `images.py` and `prepare_images.py`, and **deletes** everything else:
  - attribution, audio, grammar, ids, splitter, phoneme fix, Piper, tts text;
  - `gen_audio.py`, `cast_voices.py`, `audio_qa.py`, `grammar_skeleton.py`, `stage_media.py`, `upload_media.py`;
  - their tests.
- [ ] 5.2 **`build_stories.py`** reads all 10 `story-NN.md` files and writes:
  - **`public/data/stories/index.json`:** the books (title, lessons, cover, 6 story titles and ids `SNN-QN`) and the content version;
  - **`public/data/stories/book-NN.json`**, one per book, holding each story's situation (fa/en), image, pages and quiz.
    - A page is a list of paragraphs.
    - A paragraph is a list of tokens: text, `lesson` for bold words, and `card` for the linked card id.
- [ ] 5.3 **Grouping paragraphs into pages:**
  - add paragraphs to a page until the next one would take it over 120 words;
  - a paragraph is never split;
  - a single paragraph over 120 words gets its own page;
  - a last page under 40 words is merged into the previous one.

  Unit tests cover the edge cases: an empty sequence, one giant paragraph, all one-line paragraphs, and quotes across paragraphs.
- [ ] 5.4 **Word links** come from `linker.py`. Low-confidence links are **left unlinked**, never guessed. The build writes a coverage report to `build/stories/` (not committed): linked, lesson-bold but unlinked, low confidence.
- [ ] 5.5 **Quiz: Claude writes `content/stories/quiz/book-NN.json`** for all 60 stories, with 3 questions each:
  - `{ q, options[4], answer, page }`;
  - the question is the original `Fragen` item;
  - a two-part question becomes one;
  - wrong options are plausible and come from the same text;
  - the correct option is in a different position from question to question.
- [ ] 5.6 **The build refuses** to write if any of these fails:
  - every story has exactly 3 questions;
  - each question has 4 different options;
  - the answer index is valid;
  - `page` exists;
  - no option is empty;
  - every image named exists.
- [ ] 5.7 **Images:**
  - book 1 keeps its 6 WebP files in `public/story-media/images/`;
  - other stories get `image: null`, and the reader shows a placeholder in the same style;
  - `prepare_images.py` stays for future pictures.
- [ ] 5.8 **Delete:**
  - `public/story-media/audio/`;
  - the old `story-0N.json`, `*.audio.B.json` and `*.grammar.json` files;
  - `content/dictation/` (except `images.json`, which moves to `content/stories/`);
  - `build/dictation`.
- [ ] 5.9 **TypeScript content test** (`tests/storiesContent.test.ts`):
  - every book and story listed in the index exists;
  - ids are unique;
  - every quiz is valid;
  - every image file exists;
  - every linked card id exists in the vocabulary CSV;
  - no page has more than 120 words unless it is a single paragraph.

### 5b. Reader (`src/features/stories/`)
- [ ] 5.10 **Services (pure, unit-tested):**
  - **`content.ts`:** loads the index and loads books lazily, with a cache.
  - **`progress.ts`:**
    - merges local and server progress (completed never goes back to not completed);
    - works out which stories are unlocked. **[DEC 1]**
  - **`flag.ts`:** a simplified version of the old flag code:
    - remote `stories_enabled`, or the build default `true`;
    - no admin preview.
- [ ] 5.11 **Saving:**
  - `storiesSync.ts` upserts `story_progress` directly, under the existing row-level security, with no RPC;
  - the row is `story_id`, pages read, total pages, `last_sentence_id` = page id, `content_version`, `completed_at`;
  - it saves when a page changes (debounced) and when the quiz is done;
  - while offline, changes wait in localStorage and are sent at the next start or when the connection returns;
  - demo mode keeps everything in localStorage.
- [ ] 5.12 **Screens:**
  - **`Bookshelf`:** the 10 books as covers, with lessons, progress and lock state;
  - **`BookView`:** the 6 stories of a book with tick, current and locked states;
  - **`Reader`:**
    1. a cover page with the picture and the situation in the interface language;
    2. the text pages, turned by swipe, buttons or arrow keys, with progress dots;
    3. the last page leads to the quiz.
  - **`Quiz`:**
    - one question at a time, in German only;
    - after an answer, the right one is marked;
    - after a wrong answer, a «پاراگراف مربوط» button opens that page in a `Sheet`;
    - the "next" button appears after the answer.
  - **`Done`:** the score, then "next story" or "back to the bookshelf".
- [ ] 5.13 **Words:**
  - tapping a linked word opens the moved `WordSheet` (meaning, article, add to the box, pronounce with the browser voice);
  - bold lesson words are highlighted;
  - unlinked words are plain text.
- [ ] 5.14 **Look:**
  - paper and ink tokens and a rounded reading font **[DEC 2]**;
  - text at least 18 px;
  - the page turn is a short slide. With "reduce motion" switched on there is no animation, only a crossfade.
  - the German text is always LTR and pages turn left to right, even in the Persian interface **[DEC 3]**;
  - dark mode uses warm dark paper.
- [ ] 5.15 **Accessibility:**
  - each page has a heading for screen readers;
  - the dots say "page 2 of 6";
  - the quiz options are a radio group;
  - focus moves to the new page;
  - every control is at least 44 px.
- [ ] 5.16 **App wiring:**
  - the `stories` tab replaces `dictation`;
  - the dashboard entry opens Stories;
  - `?go=stories` opens it, and `?go=dictation` still works as an alias for old notifications;
  - remove the Settings test-voice button;
  - remove `DICTATION_ENABLED` and `STORY_MEDIA_BASE` from `config.ts`.
- [ ] 5.17 **Delete all dictation code, tests and strings.** After this, `grep -ri dictation src tests` must find nothing except the `?go=dictation` alias.
- [ ] 5.18 **Tests:**
  - **unit tests:** progress merge, unlock, page grouping (Python), quiz checks;
  - **Playwright:** open the bookshelf, read story 1 to the end, answer the quiz (one wrong answer, open its page), check that story 2 unlocks, check that progress survives a reload in demo mode, check RTL and LTR, check a 360 px phone.

## 6. Database clean-up [DB] (commit "Database: clean-up script")
- [ ] 6.1 **`supabase/migrations/20261117_cleanup_insights_dictation.sql`** has steps the owner runs one by one in Claude Desktop:
  - **Step 0 (read only):**
    - count the `shared_…` cards, the users who have them, and their review events;
    - list every object to be dropped and check that it exists.
  - **Step 1:** copy the `shared_…` card rows into `backup_shared_copies_20261117`, which is readable only by the owner.
  - **Step 2 [OWNER confirms the numbers from step 0 first]:**
    - delete the `shared_…` cards;
    - replace `guard_shared_copies` with a short trigger that **silently ignores** inserts and updates of `shared_…` ids (so old phones can't bring them back and their sync queues don't get stuck);
    - drop the shared-insights tables and functions and the copy index.
  - **Step 3:**
    - drop `story_sentence_progress`, `dictation_events`, `save_dictation_progress`, `dictation_status_rank` and their limit triggers;
    - delete `story_progress` rows whose `story_id` is not in the `SNN-QN` form (the old dictation test rows);
    - in `app_flags`, add `stories_enabled = true` and delete `dictation_enabled`.
  - **Step 4 (checks):** each check lists what is expected and what was found.
  - **Step 5 (in a week or more):** drop the backup table.
- [ ] 6.2 Update the local SQL harness (`scripts/test-sql.sh`). Delete `shared_insights.test.sql` and `story_dictation.test.sql`. Add `cleanup.test.sql`, which:
  - runs the script twice to show it is idempotent;
  - checks that the ignore-trigger works;
  - checks that real cards are untouched;
  - checks that the app's `story_progress` upsert works under row-level security.
- [ ] 6.3 Write **`docs/supabase-cleanup-setup.md`**, the instructions for Claude Desktop. It covers when to run the script (**after** the deploy and the live check), the order of steps, and the stop points.

## 7. Clean-up of files (commit "Remove unused files")
- [ ] 7.1 **Remove from Git**, keeping them locally (and add them to `.gitignore` / `.vercelignore` where needed):
  - `000-storybuilder.txt`, `000-story-dev-plan.txt`, `LOGIC_REVIEW.md`;
  - from `DaF-kompakt-work/`: the image prompts, the `refs` and the OCR scripts.

  **The 10 `story-NN.md` files stay**, because they are the source of the content build. They could move to `content/stories/source/` **[DEC 4]**.
- [ ] 7.2 `public/icons/icon.svg` and `icon-maskable.svg`: delete them if they are not the sources of the PNGs; otherwise move them to `design/`.
- [ ] 7.3 **Delete the finished docs:**
  - `docs/dictation/`;
  - `docs/*-plan.md`;
  - `silver-collection-fix.md`, `translation-sample.md`;
  - `supabase-dictation-setup.md`, `supabase-shared-insights-setup.md`.

  **Keep:** `supabase-push-setup.md`, `supabase-overdue-overtake-setup.md`, `icon-credits.md`, `docs/refactor/` and the new clean-up guide.
- [ ] 7.4 Update `CI`: run the `scripts/stories` Python tests and the content build in `--check` mode (the committed JSON must be up to date). Remove `stage_media.py`.

## 8. Agent and contributor docs (commit "Docs: CLAUDE.md, architecture")
- [ ] 8.1 **`CLAUDE.md`** at the root, with `AGENTS.md` as a one-line pointer to it. It covers:
  - what the app is and who it is for;
  - the non-negotiable rules: production database; copyright; not official; the merge/deploy sentence; never print secrets; delete the `.env.local` that `vercel link` creates;
  - the commands (dev, demo, lint, test, e2e, content build);
  - the folder map;
  - how to add a feature, a string, a story or a database change;
  - the design-system rules (only tokens and `shared/ui`, no new raw dialog);
  - how to release.
- [ ] 8.2 **`docs/architecture.md`** (about a page):
  - the data flow: CSV catalogue → engine → sync queue → Supabase;
  - authentication and demo mode;
  - the remote flag;
  - content and media hosting;
  - the Supabase objects each feature uses.
- [ ] 8.3 Update `README.md`: remove dictation and public insights, add Stories.

## 9. Verification before the PR
- [ ] 9.1 `npm run lint`, `npm test`, `npm run build`, the Python tests, the content `--check` and the SQL harness all pass.
- [ ] 9.2 Playwright runs every scenario on phone and desktop, in Persian and English, in light and dark.
- [ ] 9.3 **Screenshots:** compare the new set with the baseline from 0.2. Every difference must be one of the listed intentional ones:
  - the font-size floor;
  - the insights tab removed and «کارت‌های من» added;
  - Stories.
- [ ] 9.4 **Bundle:**
  - compare with 0.3;
  - the Stories chunk loads lazily;
  - the gallery is not in the production build.
- [ ] 9.5 **Upload:** `vercel deploy --prebuilt`-style dry check of the upload list. No textbook files, no `build/`. The size is about 5 MB.
- [ ] 9.6 Security check: no secrets in the diff, and the Supabase keys used are only the public anon key.
- [ ] 9.7 **[OWNER] Preview for review:** a Vercel **preview** deployment built in **demo mode**, with no database connection, so the owner can try Stories and the new vocabulary bank on a phone before merging **[DEC 5]**.

## 10. Release
- [ ] 10.1 **[OWNER]** Review the PR and the preview. Then write: "merge PR #N with admin and deploy to production".
- [ ] 10.2 Merge, deploy to production with the fixed `.vercelignore`, run the live checks:
  - Stories, «کارت‌های من» and the old tabs open;
  - the font files are served by the app;
  - no requests to Google Fonts;
  - no console errors;
  - `story_progress` saves for a real account (the owner's).

  Note the rollback target.
- [ ] 10.3 **[OWNER][DB]** Run the clean-up SQL in Claude Desktop, steps 0 to 4. The owner confirms after step 0, and pastes the report back.
- [ ] 10.4 After the clean-up, recheck the live app (no errors from dropped functions) and update `CLAUDE.md` if anything changed.
- [ ] 10.5 **Dependabot, afterwards and separately:**
  - #25 (minor updates), #1 and #2 (actions v7) and #20 (`@types/node`) are merged after CI;
  - #19 (lucide 1.x) gets before/after screenshots;
  - #21 (motion) is closed, because `motion` was removed.
- [ ] 10.6 **[DB, later]** A week after the clean-up, drop the backup table (step 5).

---

## Decisions [DEC] (taken 2026-11-16)
1. **Unlocking:**
   - **every book is open**;
   - inside a book, the next story opens once the quiz of the one before is answered;
   - each book shows its lesson range.
2. **Font:** **Nunito** for the text and **Fredoka** for titles, both served from the app (OFL).
3. **Direction:** the German text and the page order are always LTR, also in the Persian interface. This was assumed and the owner did not object.
4. **Sources:** move the `story-NN.md` files to `content/stories/source/`. All of `DaF-kompakt-work/` leaves Git and stays local only.
5. **Preview:** a Vercel preview in demo mode before the merge.

### Added by the owner with decision 2: what a tapped word does, and gender underlines
These requests change 5.2, 5.13 and 5.16. They replace those items where they differ.
- **Every word can be tapped.** The sheet shows:
  - **a linked word:**
    - its meaning and article;
    - pronunciation with the browser voice;
    - **"add to the Leitner box"** if the user doesn't have the card;
    - **"move back to the previous box"** if they do. The card goes to the first review slot of the box below. This is the existing, tested `computeMoveBack` rule: box − 1, due date = date of the last review + that box's interval, never in the past; not counted as a review.
  - **an unlinked word:** "not in the word list", plus "add as a new card", which opens the new-card dialog with the word filled in.
  - **names and numbers:** nothing happens.
- So `moveBack.ts` and `leitnerEngine.moveBackOne` **stay**. They move to `core/`, and 5.16 must not delete them.
- **Gender underlines** under nouns:
  - **feminine red**, **neuter green**, **masculine blue**, **plural black**;
  - these match the der/die/das colours the app already uses;
  - in dark mode, "black" is the ink colour (light), or it would be invisible.

  The rules:
  - The gender is worked out **when the content is built** and stored on each token as `g: "m" | "f" | "n" | "pl"`.
  - The source is the linked card's `Artikel` (der → m, die → f, das → n).
  - A token is **plural** when it matches the card's `Plural` form and not its singular form.
  - When singular and plural are spelled the same (der Lehrer / die Lehrer):
    - plural only when the article or determiner just before it requires it (for example "die" before a masculine or neuter noun, or "den …n" in the dative);
    - otherwise **no underline**.

    The rule is deliberately conservative: a wrong colour teaches the wrong gender, a missing one teaches nothing.
  - The tokens are `gender-m/f/n/pl` in the design system and are shown in the gallery.
  - Underlines are 2 px with an offset, so they never cover descenders or umlauts.
  - **Lesson words in bold stay bold.** Bold shows the lesson word; colour shows the gender.
  - **Tests:**
    - Python unit tests for the article and plural rules, including the same-spelling case;
    - the content test checks every `g` against the card's article;
    - Playwright checks that the underline colours show in light and dark.
