# 01. Current state (read-only investigation)

Everything below was read from the repository. Nothing was run against Supabase.

## Framework, build, deploy

- React 19, Vite 8, TypeScript 7, Tailwind 4, `motion`, `lucide-react`, `@supabase/supabase-js` (`package.json`).
- `npm run lint` is `tsc --noEmit`. `npm test` runs `node --experimental-strip-types --test tests/*.test.ts`, so
  tests import pure `.ts` modules only (no JSX, no browser APIs). CI (`.github/workflows/ci.yml`): lint, test, build.
- Hosting: Vercel, static SPA. `vercel.json` rewrites everything except `/assets/` and `/data/` to `index.html`.
  **Consequence:** static content under `public/data/` is served as real files; anything under another new top-level
  path would be rewritten to the SPA unless `vercel.json` is changed. Plan: use `public/data/stories/`.
- Deploys are CLI-based (`vercel deploy --prod`); the Vercel project is not connected to GitHub. `main` needs a PR,
  one review and the `build` check.
- `public/sw.js` is a push-only service worker that deliberately caches nothing. Audio and image caching therefore
  relies on HTTP cache headers and the Cache API called from page code, not on the service worker.

## Routing

There is no router. `src/App.tsx` keeps `activeTab` (`ActiveTab` type exported from `src/components/Navbar.tsx`:
`dashboard | review | catalog | reflections | leaderboard | settings | admin`) in `useState` and renders one
component per tab. Deep links use a query parameter read once at load (`?go=learn|review|leaderboard`, `initialGo`
in `App.tsx`). New tab id `dictation` plus a `?go=dictation` value follow the existing pattern. The browser back
button does not navigate between tabs today; the dictation screen must not depend on it (see edge cases).

## State management

No store library. Singleton service modules hold state and notify listeners: `leitnerEngine`
(`src/services/leitnerEngine.ts`), `cloudSync` (`src/services/cloudSync.ts`), `speechService`
(`src/services/speechService.ts`), `silver` (`src/services/silver.ts`). `App.tsx` mirrors engine state into React
state through `refreshState()`. New code should follow the same shape: a `dictationSync` service (queue, retry,
cache) and a `storyDictation` controller module, with React components reading through small hooks.

## Auth

Supabase Google OAuth with PKCE (`src/lib/supabase.ts`). `AuthGate` in `App.tsx` resolves the session and renders
`LeitnerApp` keyed by user id. Suspended accounts (`profiles.suspended_at`) are blocked by `SuspendedScreen` and by
RLS (`is_active_user()`). Demo mode (`src/lib/demo.ts`, `VITE_DEMO_MODE=1`, dev only) skips Supabase completely; the
dictation feature must work in demo mode with progress kept in localStorage.

## Supabase schema (from `supabase/schema.sql` and `supabase/migrations/`)

| Table | Key columns and rules | RLS |
|---|---|---|
| `profiles` | `id` (= auth uid), `settings jsonb` (<= 16 KB check), `onboarded`, `suspended_at`; column-level grants: users may update `display_name, show_on_leaderboard, onboarded, settings, updated_at` only | own row select/insert/update |
| `cards` | PK `(user_id, id)`, `box smallint 0..6`, `next_review_date date`, `last_reviewed_at`, counters, `data jsonb` (<= 16 KB), trigger limits 10,000 cards per user | owner full access and `is_active_user()` |
| `review_events` | append-only, check `abs(to_box - from_box) <= 1`, trigger requires `review_day` within +/- 1 day of server day | read own, insert own |
| `overdue_demotions` | log of server-side overdue moves, explained once in a popup | read own |
| `push_*` (20261027), `shared_insights`, `insight_reports` (20261101) | feature tables, mostly reachable only through `SECURITY DEFINER` functions | per file |

Storage: **no buckets exist and no code uses Supabase Storage today** (grep over `supabase/` and `src/`). A new
public read-only bucket is a new capability, so it is a deploy step with its own checklist item.

Nightly server job `apply_overdue_demotions` (`20261030_overdue_overtake.sql`): a card three days past its due date
drops one box and is rescheduled from that day. Manual "move back" in this plan must produce states the rule
leaves alone (due today or later), see `07-leitner-integration.md`.

Migration workflow in this repo: SQL files in `supabase/migrations/` named `2026MMDD_name.sql`, idempotent, tested
locally with `scripts/test-sql.sh` (Homebrew `postgresql@16` plus `supabase/tests/stub-supabase.sql`), applied to the
real project by the owner through a setup document (`docs/supabase-*-setup.md`), never by an agent.

## How the Leitner box stores cards and computes due dates

- Type `LeitnerCard` (`src/types/leitner.ts`): `box` 0..6 (6 = mastered), `nextReviewDate` `YYYY-MM-DD`,
  `lastReviewedAt` ISO, counters, vocab fields (`wort`, `artikel`, `persisch`, `englisch`, `beispiel`, `formen`,
  `plural`, `wortart`, `lektion`, `perfekt`, `infinitiv`, `praesens`, `praeteritum`, `reflexiv`, ...).
- Intervals: `calculateNextReviewDate(box, from)` = `from + 2^min(5,box)` days (1, 2, 4, 8, 16, 32).
  `isCardDue`: not mastered and `nextReviewDate <= today` (local date string, `src/services/dates.ts`).
- `recordVocabAnswer`: correct goes up one box, wrong goes down one (min 0), due = today + 2^newBox.
  `applyReview` also emits a `ReviewEvent` through `hooks.onReview`.
- `addCard`: new card in box 0, due today, **dedupes by id or by lowercased `wort`** and returns the existing card.
  `addBatchWords` and `getUnlearnedWords` use the same `vocabKeys()` set (ids plus lowercased `wort`).
- Book cards have ids `daf_<lektion>_<nr>` (`src/services/csvParser.ts`, stable across CSV reorderings) and refresh
  their content fields from the catalog on load (`withCatalogContent`).
- Catalog: `public/data/wortschatz-daf-kompakt.csv`, 3,460 rows (3,326 unique words): 2,020 Nomen, 749 Verb, 385
  Adjektiv, others. Nouns are stored with the article in `wort` ("der Termin"), `plural` as "die Termine". Verbs have
  `formen` ("steht auf · stand auf · ist aufgestanden · trennbar"), `infinitiv`, `perfekt`. Some words repeat across
  lessons ("ein bisschen" in L05 and L11, "aufstehen" in L03 and L24). Multi-word and slash entries exist
  ("der Partner / die Partnerin", "Grüß Gott!").
- Data helpers already present: `scripts/data/verb-splits.json` (separable verbs), `src/services/conjugation.ts`
  (3rd person present, Präteritum), `src/services/plural.ts`, `src/services/perfekt.ts`. The pipeline can reuse their
  data and logic for lemma linking.

## How settings are stored

`AppSettings` (`src/types/leitner.ts`) is a flat object: `soundEnabled`, `speechRate`, `autoSpeak`, `hapticFeedback`,
`nounsOnlyMode`, `language`, flags. `leitnerEngine.saveSettings` writes a local cache (`daf_settings_cache_<uid>`) and
calls `cloudSync.queueSettings`, which writes the whole object to `profiles.settings` (debounced, retried, persisted
queue). New optional keys are safe: old rows simply lack them (the language key already works this way, `App.tsx`).
The preferred German voice is **per device** in localStorage (`daf_german_voice`, `speechService.ts`), because device
voices differ. The settings UI is `src/components/SettingsBackupModal.tsx` (voice picker around lines 263 to 310).

## How word pronunciation works today

`src/services/speechService.ts`: a singleton around `speechSynthesis`. It waits up to 1.5 s for the async voice list,
always sets a German voice (`pickGermanVoice` in `src/services/voices.ts`, scoring de-DE over de-AT over de-CH,
preferring natural/neural names, penalizing macOS novelty voices), strips the Persian part after "·" and " / ",
calls `cancel()` before each `speak()`, and resolves on `onend` or `onerror`. Pitch is fixed at 1.0, rate comes from
settings. `voices.ts` is pure and unit-tested (`tests/voices.test.ts`). The dictation feature adds a
character-aware speaker beside it and leaves `speak()` untouched.

## Internationalization and layout

`src/i18n/fa.ts` defines the `Messages` type; `en.ts` must match it. `I18nProvider` sets `document.dir` (RTL for
Persian, LTR for English) and offers `num()` and `digits()` for Persian digits. Tailwind logical utilities (`ms-`,
`ps-`, `rtl:` variants) are used throughout. German text must be wrapped with `dir="ltr" lang="de"` inside the
RTL UI; existing examples are in `src/components/ui/Text.tsx`.

## Content already produced (outside the app)

`DaF-kompakt-work/DaF-kompakt/output/`: `story-01.md` to `story-10.md`, `storyline.md`, `visual-bible.md`,
`image-prompt-generator.md`, `image-prompts/S01-image-prompts.md` and `S02-image-prompts.md` (scene ids `S01-Q1` to
`S02-Q6`, 4:3 landscape). Story format: `# Title`, `**Lektionen 1 bis 3**`, six `## Sequenz N: Title` blocks, each
with `**Situation (فارسی)**`, `**Situation (English)**`, `**Text**` (German, target words in `**bold**`),
`**Fragen**` (three questions), then `## Lösungen`. Measured on stories 1 and 2: 449 and 513 sentences, 15.5k and
17.8k characters of German, average 5.6 words, longest sentence 33 words, about 60 to 70 percent of paragraphs
start with a quote, dialogue tags are "sagt/fragt/antwortet X" after the quote (14 per story) or before it
(2 per story), nested single quotes `‚…‘` occur, `«»` occurs, digits appear in dates ("19. Oktober"), times
("1:52"), phone numbers ("0664 23 59"), prices ("450 Euro") and one abbreviation ("Tel.").
Grammar sources: `DaF-kompakt-work/DaF-kompakt/Grammatik/L01-03_Grammatik.md` to `L28-30_Grammatik.md`, with
`## Lektion N` and `### <point title>` headings and Markdown tables (bold marks the colored parts of the book).
**These folders are gitignored on purpose** (`.gitignore`, textbook-derived).

## Gaps that the plan must fill

No router, no audio playback code beyond Web Speech, no Storage usage, no content-loading layer for per-story data,
no per-sentence progress table, no feature flag mechanism, no error monitoring service (errors go to `console`).
The plan adds the minimum of each and says where.
