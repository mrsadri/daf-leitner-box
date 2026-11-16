# Refactor, phase 1: what the owner means by "refactor"

Date: 2026-11-16. Agreed with the owner over five rounds of questions. Phase 2 (code review) and phase 3 (checklist plan) build on this file; phase 4 executes the plan.

## In one paragraph
Make the app smaller, more consistent and easier for people and AI agents to work on. Do it together with three product changes that remove a lot of code:

- story dictation becomes **Stories**: reading, with no audio;
- public insight sharing is **removed**;
- insights move **into the vocabulary bank**.

Small visible fixes found along the way are allowed. Runtime libraries are not added.

## Goals (owner's choice)
1. **Readable, maintainable code:** split large files and separate logic from UI.
2. **Consistent UI:** design tokens, shared components and a dev-only gallery page.
3. **Easy for AI agents to read:**
   - `CLAUDE.md` / `AGENTS.md` at the root;
   - a feature-based folder layout;
   - a short header comment at the top of every module.
4. **Remove what is not used:**
   - dead code;
   - unused files in `public/`;
   - files in the repo the app does not need;
   - leftover open PRs.

Not a goal: performance work for its own sake. A smaller bundle will come from the deletions anyway.

## Product changes in scope

### A. Stories (replaces dictation)
| Topic | Decision |
|---|---|
| Name | «داستان» / "Stories". The word dictation disappears from the UI and the code. |
| Unit | One **sequence** of a story file is one story: about 5 to 8 paragraphs, one picture, three questions. The six sequences of a file form a **book**, which matches a lesson block. |
| Content | **All 10 books now**, from `DaF-kompakt-work/DaF-kompakt/output/story-NN.md`. That is 60 stories. These are original texts written for the app and use the lesson vocabulary. Nothing is copied from the textbook. |
| Reading | Paragraph by paragraph, like a picture book you page through: a swipe or a button turns the page, with progress dots. A bookshelf screen lists the books and their stories. The page uses cream paper, a large rounded font and a dark mode. |
| Before reading | The Persian or English situation text and the picture. |
| Reading aids | Tap a word to see its meaning and article and to add it to the Leitner box. Words from the lesson are highlighted. A word can be pronounced with the **browser voice** (the same as elsewhere in the app). |
| Removed | All recorded audio, voices, the Settings "test voice" button, the grammar drawer and its 28 grammar cards. |
| Quiz | 3 multiple-choice questions at the end of each story. They are **German only**, with no translation button. Claude writes them in simple German at the story's level, 180 in total, in an editable JSON file. |
| Wrong answer | The correct answer is shown right away, and the paragraph it comes from can be reopened. |
| Unlock | The next story opens once all three questions are answered. There is no pass mark. |
| Progress | Stored in the existing `story_progress` table. Quiz scores are not stored. |
| Release | **Straight to everyone.** There is no admin-only phase. |
| Kill switch | Kept as a new remote flag `stories_enabled`, on by default. It is turned off with one SQL statement and needs no deploy. The admin preview parameter goes away. |

### B. Insights
| Topic | Decision |
|---|---|
| Public sharing | **Removed completely.** This covers publishing, the public list, "my publications", reports, quota, author attribution, the admin moderation tools and their database objects. |
| Copies of other users' public cards (`shared_…` ids) in users' boxes | **Deleted**, as the owner decided. This removes real user data (the card and its review history). The SQL script first shows the count and the users affected and backs the rows up. The owner confirms once more before the delete runs. |
| What stays | The flow for adding an insight card. All **five categories** (decision, motivation, habit, goal, note) stay in the form. |
| Where | The «بینش» tab leaves the bottom navigation. In the vocabulary bank, the lesson menu gets a first entry, **«کارت‌های من»**. Choosing it shows the user's insight cards and a "+ new card" button, just like a lesson's word list. |

### C. Clean-up
- **Repo files the app does not need** are removed from Git and kept locally (git-ignored):
  - `000-*.txt`;
  - `LOGIC_REVIEW.md`;
  - `DaF-kompakt-work/` working files. The story `.md` files are an exception if the content build still needs them; phase 2 decides.
- **Unused files in `public/` are removed**, for example icons and data nothing references.
- **Dictation leftovers are removed:**
  - the audio scripts and voice data;
  - `public/story-media/audio`, which is 21.6 MB;
  - `docs/dictation/`.

  The content build keeps only what Stories needs: reading the `.md` files, linking words and preparing images.
- **Database clean-up** follows the rule below:
  - drop the shared-insights objects;
  - drop `story_sentence_progress` and `dictation_events`;
  - drop the dictation-only functions;
  - rename the flag.
- **Open PRs:**
  - #27 (`.vercelignore`) is folded into the big PR.
  - The Dependabot PRs are handled **after** the big PR, separately. Small updates and the GitHub Actions updates go first. The major `motion` and `lucide` updates are checked with before/after screenshots.

## Constraints (unchanged, apply to every step)
- **Real users.** Nothing here touches the production database. Every database change is a SQL script with checks, which the owner runs through Claude Desktop. Scripts that remove things run **after** the new app is live, so phones still on the old version do not hit missing functions.
- **Copyright.** No textbook material (pages, OCR, PDF) is committed or uploaded. `.vercelignore` must keep it out.
- **Not official.** The app must not look like an official app of the Austrian Cultural Forum or the embassy. It is a volunteer project.
- **Merge and deploy.** Admin merge and deploy happen only after the owner writes the exact sentence "merge PR #N with admin and deploy to production".
- **Tools.** Development tools may be added (for example ESLint, component tests, Playwright inside the repo). Runtime libraries may not (no router, no state manager).
- **Fonts.** Fonts are self-hosted. Google Fonts may be slow or blocked in Iran.

## Delivery
- **One large PR** (owner's choice), with commits in a readable order:
  1. Stories;
  2. insight changes;
  3. clean-up;
  4. design system;
  5. folder layout;
  6. agent docs.
- Each commit leaves the tests passing, so the history can still be bisected.
- Order of work, as the owner put it: Stories first, then the refactor. In practice the design tokens and shared components come first, so that the Stories screens are built on them and not rewritten later.

## Accepted risks
- **Quiz questions.** The 180 German questions and the word links for books 3 to 10 go live without a native-speaker review. Mitigation: the kill switch, and content in one editable JSON file per book.
- **Data deletion.** Deleting the `shared_…` copies cannot be undone after the backup table is dropped.
- **One big PR.** It is harder to review and to roll back partly. Mitigation: ordered commits, tests at every commit, and a full Vercel rollback to the current deployment.

## Defaults assumed (not asked; the owner can change them)
- **Order of stories.** Stories within a book unlock in order. Whole books are also unlocked in order (book 2 opens after the last story of book 1). Phase 3 asks again whether a learner further along in the course should be able to open a later book directly.
- **Points.** Finishing a story gives no leaderboard points.
- **Pictures.** Stories without a picture yet (everything except book 1) show a placeholder in the same style.
- **Old progress.** Earlier dictation progress in `story_progress` belongs only to the owner's test account and may be reset.
