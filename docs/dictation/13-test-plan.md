# 13. Test plan

What exists today: Node's built-in runner over pure TypeScript modules (`tests/*.test.ts`, strip-types), a local
Postgres harness for SQL (`scripts/test-sql.sh` plus `supabase/tests/*.test.sql`), CI running lint, test and build.
There is **no browser end-to-end tool** in the repo. This plan keeps that shape: logic is pure and unit-tested, SQL is
tested locally, and the browser behavior that cannot be unit-tested is covered by a manual device matrix. (Adding
Playwright later is possible and not required.)

## 1. Unit tests (CI, `npm test`)

New files under `tests/`, each importing pure modules from `src/services/dictation/`.

| File | Covers | Edge case ids |
|---|---|---|
| `dictationNormalize.test.ts` | NFC, NBSP, whitespace, quote, dash and ellipsis folding, tokenization of `geht’s`, `1:52`, `E-Mail`, `0664 23 59` | K3, K5, K8, K18, Q4, Q5, Q8, Q11, Q13 |
| `dictationCompare.test.ts` | Every category: missing, extra, wrong letter, swapped letters, case, comma and other punctuation, `ae/oe/ue/ss` substitutions, spacing, word order, missing word, extra word; exact match is correct; the owner's strictness rules; no category prints the answer; performance under 5 ms for 33 words | K6, K9, K19, Q12, Q14, Q18 |
| `dictationTrigger.test.ts` | Terminal mark at the end, quote balance (`„Wie geht’s?“, fragt Lucía.`, `„Danke!“`, first half of a split quote), ordinal and abbreviation periods, `endsDigitDot`, `...` third dot, caret not at end, composition events, paste, empty input | Q1 to Q3, Q6, Q7, Q10, Q16, K4, I1, I2, E1 to E3 |
| `dictationMoveBack.test.ts` | The owner's 16-day example (box 4 entered 3 days ago gives box 3, due in 5 days), clamping to today, box 0, box 6, null `lastReviewedAt`, month and year boundaries, DST changes in local dates, no change of counters | L8 to L11 |
| `dictationWordLink.test.ts` | Tap resolution: `heiße` to `heißen`, split verbs, Perfekt, plurals, article nouns, duplicates choose the owned card, unlinked words, cast names not tappable, add and no-duplicate behavior against `LeitnerEngine` in memory | L1 to L7 |
| `dictationVoiceMap.test.ts` | Stable assignment in cast order, gender hints, sharing offsets meet the minimum distances, map persistence and recompute only on voice loss, zero or one voice | A19, A21 to A24 |
| `dictationFallback.test.ts` | Chains for A, B, C; retry once on network error; no retry on 404; circuit breaker for five minutes; Mode C skipped without a voice | A14, N1, N5, N8 |
| `dictationProgressMerge.test.ts` | Status rank merge, `greatest` counters, idempotent re-merge, frontier computation, content-hash change handling, retired ids | S1 to S3, C1 to C4 |
| `dictationContent.test.ts` | Loads every `public/data/stories/*.json`: schema, unique sentence ids, six sequences, speakers exist in `cast.json` and in `voices.json` for A, B, C, every sentence has audio keys for A and B, every link range matches a token, every grammar id has a card, images or explicit nulls, alt text in both languages, `contentVersion` present | C8, C9, M7 |
| `i18nDictation.test.ts` | `fa` and `en` have the same dictation keys and at least 8 praise messages each (the existing `Messages` type already forces key parity at compile time) | |

Python tests (`python3 -m unittest discover scripts/dictation/tests`, new CI step): splitter rules S1 to S16 with
fixtures, golden counts for stories 1 and 2, speaker attribution on a fixture paragraph set, lock-file matching
(edit, insert, delete, reorder), TTS text normalizer, vocabulary linker on a fixture CSV, and the Piper phoneme test
(skipped when Piper is not installed).

## 2. SQL tests (local Postgres, `scripts/test-sql.sh`)

`supabase/tests/story_dictation.test.sql`, in the existing `ok:` and `FAILED` style:

- the migration runs twice without error (the script already does this);
- user A cannot select, insert or update user B's rows in either progress table; anonymous access is denied;
- a suspended user cannot write (`is_active_user()`);
- `save_dictation_progress` is idempotent (same payload twice leaves the same rows), never lowers status or counters, keeps
  the best status when two payloads arrive in either order, rejects batches over 500 rows, enforces the row cap;
- `dictation_events` accepts own inserts, rejects other users' ids, and cannot be selected by an ordinary user;
- `app_flags` is readable by an authenticated user and not writable;
- deleting a user cascades to all new tables;
- existing tests (`overdue_overtake`, `shared_insights`) still pass.

## 3. Integration tests (dev Supabase project, never production)

Run by hand with two test accounts and two browsers (or one browser and one private window):

1. Sign in on A, finish three sentences, skip one; sign in on B: resume at the fifth sentence, history shows four.
2. Finish the same sentence on both, concurrently: no regression, counters not lower.
3. Go offline mid-sequence, finish two sentences, come back online: rows sync, the Navbar dot returns to green.
4. Toggle the kill switch in the dev project: the tab shows the paused state without a reload of data.
5. Run the content build twice: identical output. Edit one sentence: same id, new hash, new audio key, progress kept.
6. Existing features after the migration in the dev project: login, review, new words, leaderboard, settings backup,
   push reminders settings all work.
7. Leitner actions: add a catalog word; add a non-catalog word; move back a card at box 4 entered 3 days ago and check
   the stored `box` and `next_review_date` in the dev database; skip a sentence and verify no `cards` row changed
   (compare `updated_at` before and after).

## 4. Manual device and keyboard matrix

Run in Phase 7 on real devices, in Persian and in English interface language. Each cell is one pass of this script:
open story 1 sequence 1, Start (audio plays), type two sentences correctly (praise shows), type one with a missing
comma and a lowercase noun (marks and categories correct), fix and resubmit, tap a marked word (sheet), Add, Undo,
skip one sentence, click a history sentence (replays), switch the audio mode A, B, C and replay, toggle the grammar
drawer and reload (preference persists), reload mid-sentence (resume), background the app mid-playback (A4).

| Platform | Browser or mode | Modes to run | Notes |
|---|---|---|---|
| iPhone (current and previous iOS) | Safari | A, B, C | Autoplay unlock, silent switch (A7), smart punctuation (K3), double-space period (K4), keyboard covering the stage (K10) |
| iPhone | Installed PWA (Add to Home Screen) | A, B, C | Audio session behavior in standalone mode |
| iPhone | Chrome for iOS | A, B | WebKit engine; Web Speech voice list |
| iPad | Safari, split view and keyboard attached | A, B, C | Tablet layout, hardware keyboard |
| Android (two devices, one low-end) | Chrome | A, B, C | Gboard German and English, voice list timing (A21), IME (I1) |
| Android | Samsung Internet | A, B, C | Web Speech behavior, installed PWA |
| Android | Firefox | A, B | Pitch ignored (A19), Web Speech availability |
| macOS | Safari, Chrome, Firefox | A, B, C | Mac novelty voices, German keyboard dead keys (K8) |
| Windows | Chrome and Edge | A, B, C | Natural voices, 15-second cutoff (A20) |
| Linux (optional) | Firefox or Chrome | A, B | No German voice case (A23) |

Keyboards: iOS German, iOS English, iOS Persian, Gboard German, Gboard English, Gboard Persian, hardware German,
hardware US. Assistive technology: VoiceOver on iPhone and macOS, TalkBack on Android, NVDA with Firefox or Chrome,
keyboard only, 200 percent zoom, reduced motion, high contrast.

Network conditions: normal, Slow 3G (DevTools throttling), offline from the start, offline mid-sentence, offline then back.

Pass criteria per cell: the script passes, no console errors beyond known warnings, no layout overlap with the keyboard,
no audible overlap of two playbacks, and the edge-case rows listed for that platform have the expected behavior. Findings
go to a table (device, case id, result, issue link); blockers must be zero for release.

## 5. Content QA (human)

- Speaker review table for both stories signed off (`reviewed` ranges present).
- Splitting report read once in full: every `digit-dot boundary`, abbreviation and multi-sentence quote decision.
- Listening: 10 percent random sample per voice, every long sentence, every `digits` sentence, every `ellipsis`
  sentence, every mixed-segment sentence, all Piper ich-sound words per voice.
- Proofreading: the JSON text equals the story Markdown apart from the bold markers (a diff script proves it), so no
  accidental text change was introduced.
- Link spot check: 50 random sentences, every tappable word opens the right card.
- Grammar: each point card read against the book's page (by the owner), German text only, proofread.

## 6. Regression and safety checks before release

`npm run lint`, `npm test`, `npm run build`, `python3 -m unittest discover scripts/dictation/tests`, `scripts/test-sql.sh`;
bundle size comparison (the dictation chunk is lazy-loaded; the main bundle must not grow by more than a few KB);
a search of the built `dist/` for any secret-looking string (`sk_`, `service_role`, `ELEVEN`) which must return nothing.
