# Architecture

A one-page map of how the app works. Folder layout and rules: [CLAUDE.md](../CLAUDE.md).

## Data flow
```
public/data/wortschatz-daf-kompakt.csv ──(csvParser)──> leitnerEngine.catalog     (the book's words, read-only)

user action ──> leitnerEngine (cards + settings in memory, localStorage cache)
                    │ hooks
                    ▼
                cloudSync queue (localStorage) ──debounced──> Supabase: cards, review_events, profiles.settings
                    ▲
Supabase ──(on start: pull, merge)──┘
```
- **React state.** React gets copies through `useLeitnerData().refresh()` after each engine call. Screens receive plain props and callbacks.
- **Offline.** The cache and the queue make the app usable offline. Queued changes go out when the connection is back.
- **Points and the leaderboard** come from `review_events` on the server (`get_leaderboard`). Silver cards come from the same events (`get_silver_status`); the device keeps a running count so a card appears at once.
- **Overdue rule.** A nightly job (`supabase/migrations/20261030_overdue_overtake.sql`) moves long-overdue cards back. The app explains the moves once (`OverdueNotice`).

## Sign-in and modes
- **Production:** Supabase Auth with Google. `App` → `AuthGate` → `LeitnerApp` (keyed by user id).
- **Demo** (dev, or a `--mode demo` build): no Supabase; sample data in localStorage. It is used by the browser tests and review previews.
- **Suspended users:** they see a notice. Row-level security already blocks their writes (`is_active_user()`).

## Stories
```
content/stories/source/story-NN.md ─┐
content/stories/quiz/book-NN.json  ─┼─ scripts/stories/build_stories.py ─> public/data/stories/index.json, book-NN.json
content/stories/images.json, names ─┘    (pages, word links, noun gender, quiz)
```
- **Loading.** The reader (`src/features/stories`) loads the index and one book at a time.
- **Tapped words** open the word sheet: add the word to the box, or move it back one box (`core/moveBack.ts`).
- **Progress.**
  - Each story is one row in `story_progress`.
  - The app merges the server copy first and then upserts its own rows under row-level security. Progress never goes backwards.
  - The next story in a book opens once the quiz of the one before is answered.
- **Media.** Pictures are WebP files in `public/story-media/images` (hashed names, cached for a year).
- **Kill switch:** `app_flags.stories_enabled`.

## Adjective declension contest
```
src/features/adjective/grammar.ts (noun/adjective banks, ending tables) ─> generateRound ─> DrillScreen
                                                                                                  │
                                                                                         drillSync.ts
                                                                                                  │
                                      Supabase: start_adjective_run / finish_adjective_run / get_adjective_board
```
- **Separate from the Leitner box.** This score, the drill's records, never changes the Leitner score, the
  weekly rank, the streak or silver cards; wrong answers are not turned into cards.
- **Timer.** A fixed end time (`timer.ts`), not accumulated ticks, so a background tab buys no extra time.
- **Offline.** A run that can't be started plays as practice (not recorded). A finished run waits in a
  per-user queue (`queue.ts`) until the server accepts it, retried on reconnect; a rejection (not owned, too
  early, over the daily limit, older than 24h) drops it instead of retrying.
- **Records.** `get_adjective_board` ranks by best score (ties by the earlier best run), like
  `get_leaderboard`; `get_my_adjective_bests` gives the caller's own best-ever and best-this-week. Shown as
  the «صفت‌ها» tab in «رقابت», next to the existing Leitner board.
- **Kill switch:** `app_flags.adjective_drill_enabled`.

## Supabase objects by feature
| Feature | Tables / functions |
|---|---|
| Cards and review | `cards`, `review_events`, `profiles` (settings), `get_leaderboard` |
| Admin | `app_admins`, admin functions in `schema.sql` |
| Push reminders | `push_subscriptions`, `push_state`, edge function `send-reminders` (`supabase/functions`) |
| Overdue rule | `overdue_demotions`, nightly job |
| Silver cards | `get_silver_status` (from `review_events`) |
| Stories | `story_progress`, `app_flags` (`stories_enabled`) |
| Adjective drill | `adjective_drill_runs`, `get_adjective_board`, `get_my_adjective_bests`, `app_flags` (`adjective_drill_enabled`) |

Removed in 2026-11 (clean-up: `supabase/migrations/20261117_cleanup_insights_dictation.sql`):
- public insight sharing;
- story dictation (audio, per-sentence progress).

## Hosting
- **Front end.** Vercel serves the static build.
  - `vercel.json`: SPA rewrite except `/assets`, `/data`, `/story-media` and `/fonts`, plus cache headers.
  - Deploys run from the CLI. `.vercelignore` keeps everything except the build inputs off Vercel.
- **Service worker** (`public/sw.js`): push notifications only. It caches nothing, so every deploy reaches users at once.
