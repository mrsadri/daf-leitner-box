# CLAUDE.md

Guidance for AI agents (and people) working in this repository. Read it before changing anything.

## What this is
A Leitner-box web app for German learners at the Austrian Cultural Forum Tehran (course *DaF kompakt*, A1–B1). The interface is in Persian (RTL, default) and English. It covers:
- reviewing the book's 3,400 words, plus the learner's own cards (decisions, motivation, …);
- Stories: 60 short graded stories with a quiz;
- an adjective declension drill («صرف صفت»), a separate 5-minute contest with its own records board;
- silver cards and a leaderboard.

Live: https://daf-leitner-box.vercel.app. Supabase handles sign-in (Google), the database and row-level security. The front end is a static Vite/React app on Vercel.

## Rules that must never be broken
1. **Real users.** Never connect to, query or change the production Supabase database from this machine.
   - Every database change is an idempotent SQL file in `supabase/migrations/` with a step-by-step guide in `docs/supabase-*-setup.md`.
   - The owner runs that guide in Claude Desktop. Destructive steps stop for the owner's confirmation first.
2. **Copyright.** The textbook (PDF, page scans, OCR, Grammatik/Wortschatz/Kontext pages) must never be committed, uploaded or deployed.
   - The local folder `DaF-kompakt-work/` stays out of Git (`.gitignore`) and out of Vercel uploads (`.vercelignore`).
   - Before any `vercel` deploy, check that `.vercelignore` still excludes it. The upload should be a few MB, not GB.
3. **Not official.** The app is a volunteer project. Never present it as an official app of the Austrian Cultural Forum, the embassy or the publisher.
4. **Merge and deploy** only after the owner writes exactly: "merge PR #N with admin and deploy to production".
5. **Secrets.**
   - Never print or commit secrets, and never print the contents of `*.local.md` files.
   - `vercel link` writes `.env.local` with production keys. Delete it afterwards.
   - The only Supabase key in the app is the public anon key.
6. Original story illustrations (JPG) stay out of Git. Only the converted WebP files in `public/story-media/images/` are committed.

## Commands
```bash
npm run dev                     # http://localhost:3000 (VITE_DEMO_MODE=1 in .env.development.local = demo, no Supabase)
npm run lint                    # tsc (strict) + oxlint
npm test                        # unit tests (Node test runner, tests/*.test.ts)
npm run e2e                     # Playwright on a demo build (port 4173); PW_EXE=/path/to/chrome if the download is blocked
npm run build                   # production build (dist/)
python3 -m unittest discover scripts/stories/tests        # content build tests
python3 scripts/stories/build_stories.py [--check]        # rebuild Stories JSON / check it is current (CI)
python3 scripts/stories/prepare_images.py                 # convert new story illustrations to WebP
bash scripts/test-sql.sh                                  # SQL tests on a throwaway local PostgreSQL
```
- **Demo mode** (`src/shared/lib/demo.ts`): no sign-in and no Supabase; data stays in localStorage. It is available in development and in `vite build --mode demo` builds, never in production builds.
- **Gallery** of all shared components: `?gallery=1` in dev or demo.

## Folder map
```
src/app/            entry (App), signed-in shell (LeitnerApp), Navbar, data hook, session effects
src/core/           leitnerEngine (cards, rules), cloudSync (Supabase queue), types, moveBack, dates, csvParser
src/features/<f>/   one folder per feature: dashboard, review, learn, vocab (word bank + MyCards), stories,
                    adjective (declension drill), silver, leaderboard, onboarding, settings, admin, auth
src/shared/ui/      design system (Button, Dialog, Card, Badge, fields, …) + Text helpers, SwipeCard, Icon3D
src/shared/vocab/   German knowledge used by several features (Perfekt, plural, conjugation, card texts)
src/shared/lib/     supabase client, demo mode, speech, sound, haptics
src/i18n/           fa.ts (source of the type), en.ts, provider
content/stories/    story sources (Markdown), quiz JSON, names, images.json — inputs of the Stories build
public/data/        word list CSV, built Stories JSON;  public/story-media/images: story WebP files
scripts/stories/    Stories content build (Python, standard library + Pillow for images)
supabase/           schema.sql, migrations/, tests/ (local only), functions/send-reminders
e2e/                Playwright tests;  tests/ unit tests;  docs/ setup guides and refactor notes
```

## How to …
- **Add a string:** add it to `src/i18n/fa.ts` and `en.ts`; TypeScript fails if one is missing.
  - Wrap German text in `<De>`, text the user wrote in `<Auto>`.
  - Use logical Tailwind classes (`ms-`, `pe-`, `start-`, `text-start`).
- **Build UI:**
  - Use `src/shared/ui` and the tokens in `src/index.css` (radii `rounded-control/card/sheet`, `text-caption`, story `paper/ink`, `gender-m/f/n/pl`).
  - Every modal is a `<Dialog>`; never build an overlay by hand.
  - Screen keyboard shortcuts must check `isDialogOpen()`.
  - The smallest text is 12px.
- **Add a story or change one:**
  - Edit `content/stories/source/story-NN.md` and `content/stories/quiz/book-NN.json` (3 German questions per story).
  - Add names to `names.json`, then run `build_stories.py`.
  - Commit the sources and `public/data/stories/*.json` together. CI fails if the JSON is stale.
- **Change the database:** write a new idempotent migration and a test in `supabase/tests/`, run `scripts/test-sql.sh`, and write the owner's guide. Never run it against production yourself.
- **Change the Leitner rules** (intervals, demotion, points): ask the owner first. It changes how people learn.

## Facts worth knowing
- **Card ids:** word cards are `daf_<Lektion>_<Nr>` from the CSV, and progress depends on them.
  - Never renumber `Lektion`/`Nr`.
  - Ids `shared_…` were copies of public insight cards. Sharing was removed in 2026-11; the app and the server drop them.
- **Stories progress** goes to `public.story_progress` (one row per story `SNN-QN`, own rows only).
  - The server copy is merged before anything is sent, and progress never goes backwards.
  - Kill switch: `app_flags.stories_enabled`. A missing flag means on.
- **Adjective drill runs** go to `public.adjective_drill_runs` (one row per run, own rows only); writes
  only through `start_adjective_run`/`finish_adjective_run`. Entirely separate from the Leitner score.
  - Kill switch: `app_flags.adjective_drill_enabled`. A missing flag means on.
- **Story media** is served by Vercel from `/story-media/` (hashed names, cached for a year by `vercel.json`).
- **Local builds without Supabase settings.** A production build without `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` treats Supabase as not configured at build time and drops the whole signed-in app.
  - To measure bundle sizes, build with placeholder values: `VITE_SUPABASE_URL=https://example.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite build`.
  - To test the app, use a demo build.
- **Fonts** are served from `public/fonts` (Google Fonts may be blocked in Iran). Apart from Microsoft Clarity on the production host (`src/shared/lib/clarity.ts`), the app makes no requests to other hosts, and the e2e smoke test checks this on demo builds, where Clarity is off.
- **Releases:**
  1. One PR, CI green.
  2. Owner review on a demo-mode Vercel preview.
  3. The merge sentence.
  4. `vercel --prod` from `main`.
  5. A live check.
  6. Owner-run SQL, if any.
