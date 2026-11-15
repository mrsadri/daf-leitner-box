# 12. Phased task plan

Estimates are focused working days for one developer pairing with Claude Code, excluding the owner's own review time
(shown separately). Phases 1, 2 and 3 can run in parallel after Phase 0. Task ids (P1-T2 and so on) are reused in the
checklists. Critical path: Phase 0, Phase 1, Phase 4, Phase 5 (UI needs real data and audio), Phase 7, Phase 8.

| Phase | Name | Dev days | Owner review days | Depends on |
|---|---|---|---|---|
| 0 | Decisions and spikes | 3 | 1 | none |
| 1 | Content pipeline | 6 | 2 | 0 |
| 2 | Pure logic modules (TypeScript) | 4 | 0 | 0 |
| 3 | Data model, sync, settings, flag | 3 | 0.5 | 0 |
| 4 | Audio generation and media | 4 | 1 | 1, 0 |
| 5 | UI | 9 | 0.5 | 2, 3, parts of 1 and 4 |
| 6 | Grammar cards and drawer content | 3 | 2 | 0 (OQ 1), 1 |
| 7 | Integration, hardening, device matrix | 5 | 1 | 4, 5, 6 |
| 8 | Release | 2 | 1 | 7 |
| 9 | Beta follow-up and the next story | ongoing | | 8 |

Total about 36 focused days of development plus about 9 owner review days; 6 to 7 calendar weeks with parallel work.

## Phase 0: Decisions and spikes

Goal: remove the unknowns that would otherwise invalidate later work.

| Task | Detail | Output |
|---|---|---|
| P0-T1 | Open Questions 1 and 2 are **decided** (own-words German-only grammar cards); record the final wording in `14-risks-and-open-questions.md` | Done 2026-11-15 |
| P0-T2 | TTS spike: audition about 20 ElevenLabs voices (and Google Chirp 3 HD) on 10 real sentences, check licence terms, price, `seed` determinism, Austrian-accent availability; pick the cast for stories 1 and 2 | Casting table filled in `voices.json`, provider decision |
| P0-T3 | Piper spike: list German voices and licences, render the same 10 sentences, reproduce the U+0327 problem, prove the NFC plus `phoneme_id_map` check, test ffmpeg `rubberband` pitch shifts | Spike note, working `test_piper_phonemes.py` |
| P0-T4 | Create or confirm a **dev** Supabase project (never production); create bucket `story-media` there; test public read, `Cache-Control`, CORS for `fetch` and `<audio>` from `localhost:3000` and the production origin | Written results, bucket settings for the setup doc |
| P0-T5 | Fix illustration naming, format and archive location (`S01-Q1.png`, 4:3, WebP outputs); deliver two placeholder images | Naming rule in `04-content-pipeline.md` confirmed |
| P0-T6 | Check Supabase plan limits for Storage size and egress (Open Question 8) | Number in the risk register |

Acceptance: all six outputs exist; blocking questions 1, 3 and 4 have answers or an explicit default; the provider is chosen.

## Phase 1: Content pipeline

| Task | Detail | Days |
|---|---|---|
| P1-T1 | `scripts/dictation/` skeleton, parser for the story Markdown, bold stripping, normalization, validation of the six-sequence structure | 0.5 |
| P1-T2 | Sentence splitter (rules S1 to S16) with `unittest` fixtures per rule and golden files for stories 1 and 2 | 1.5 |
| P1-T3 | `cast.json` (aliases), speaker attribution rules, `segments`, review report generator | 1.5 |
| P1-T4 | Stable ids: lock file matching algorithm and tests (edit, insert, delete, reorder) | 1 |
| P1-T5 | Vocabulary linker (form index from the CSV, paradigm generator, separable verbs, phrases, duplicates) and coverage report | 1.5 |
| P1-T6 | `tts_text.py` (numbers, times, dates, phone numbers) and `overrides` handling | 0.5 |
| P1-T7 | Publish step: `story-NN.json`, `index.json`, `contentVersion`; CI step for `python3 -m unittest`; `tests/dictationContent.test.ts` | 0.5 |

Owner review: speaker review for stories 1 and 2 (1 day), link and split review (1 day).
Acceptance: `build_story.py 01 --publish` and `02` produce valid JSON with 0 `UNKNOWN` speakers and no unreviewed
medium or low rows; sentence count within the golden range; linked content-token ratio at least 97 percent; the content
test passes in CI; running the build twice yields a byte-identical output.

## Phase 2: Pure logic modules (`src/services/dictation/`)

| Task | Detail | Days |
|---|---|---|
| P2-T1 | `normalize.ts` (NFC, folding, tokenizer) and tests | 0.75 |
| P2-T2 | `compare.ts` (alignment, categories, char diff, `CheckResult`) with a table-driven test per category and the owner's rules | 1.5 |
| P2-T3 | `submitTrigger.ts` (terminal mark, quote balance, ordinals, abbreviations, composition) and tests from edge cases Q1 to Q12, K3, K4 | 0.75 |
| P2-T4 | `moveBack.ts` (`computeMoveBack`) and `leitnerEngine.moveBackOne`, plus the engine's use of `addBatchWords` and `addCard`; tests including the 16-day example, box 0, box 6, null `lastReviewedAt`, clamping | 0.5 |
| P2-T5 | `voiceMap.ts`, `fallback.ts` (chain and circuit breaker), `progressMerge.ts` and tests | 0.5 |

Acceptance: `npm test` and `npm run lint` pass; every row of the edge-case tables marked "unit" in `13-test-plan.md` has a test.

## Phase 3: Data model, sync, settings, flag

| Task | Detail | Days |
|---|---|---|
| P3-T1 | Migration SQL: tables, RLS, `dictation_status_rank`, `save_dictation_progress`, limits, `app_flags`, `dictation_events` | 1 |
| P3-T2 | `supabase/tests/story_dictation.test.sql` (RLS isolation between two users, merge monotonicity, idempotent re-run, batch limit, row cap) and `scripts/test-sql.sh` green | 0.75 |
| P3-T3 | `AppSettings` optional keys; `dictationSync` service (queue, cache, retry, demo mode); flag reader with fail-open | 1 |
| P3-T4 | `docs/supabase-dictation-setup.md` for the owner: before and after checks, migration, bucket, flag, rollback and monitoring queries | 0.25 |

Acceptance: migration runs twice with no error locally; existing tests still pass; a request from user B never reads
user A's rows; the app runs with the migration absent (progress stays local, one notice).

## Phase 4: Audio generation and media

| Task | Detail | Days |
|---|---|---|
| P4-T1 | `gen_audio.py` core: file keys, incremental runs, loudness, trim, pad, MP3 encoding, segment join, provider adapter | 1.5 |
| P4-T2 | Mode A adapter (chosen provider) with a cost guard and a dry run | 0.5 |
| P4-T3 | Mode B with Piper, the cedilla fix and the loud failure on unknown phonemes | 1 |
| P4-T4 | `audio_qa.py`, listening sample and QA report; `upload_media.py` (dry run default, no overwrite) | 0.5 |
| P4-T5 | Image conversion (WebP, two sizes), upload, `story-NN.audio.A.json` and `.B.json` indexes | 0.5 |

Owner review: listening sample (1 day).
Acceptance: every sentence of stories 1 and 2 has a key in both indexes; QA report has zero failures; ich-sound check
passes for every Piper voice; uploading twice changes nothing; the dev bucket plays in a browser.

## Phase 5: UI

| Task | Detail | Days |
|---|---|---|
| P5-T1 | Tab, route (`dictation` in `ActiveTab`, `?go=dictation`), error boundary, kill-switch state, Beta badge, i18n keys in `fa.ts` and `en.ts` | 1 |
| P5-T2 | Content loader (`index.json`, story JSON with revalidation), story list, story detail, sequence intro with image and placeholder | 1.5 |
| P5-T3 | Playback controller (single element, token, debounce, prefetch and Cache API) and `storySpeaker` for Mode C; fallback wiring and source note | 2 |
| P5-T4 | `SentenceStage`: textarea attributes, umlaut bar, submit trigger wiring, Check, Skip, Next, drafts, history list | 2 |
| P5-T5 | `FeedbackText` rendering of marks, summary, praise pool, live regions | 1 |
| P5-T6 | `WordSheet` with Add and Move back, Undo toast, links to `NewCardModal` for non-catalog words | 1 |
| P5-T7 | Settings section: mode radios with Test, speed, grammar default; layout for desktop, tablet, phone; RTL pass | 0.5 |

Acceptance: the whole loop works on desktop and phone in both interface languages with stories 1 and 2; no Leitner change
occurs without a button; skipping changes no card; reduced motion and keyboard-only flows work.

## Phase 6: Grammar cards and drawer

| Task | Detail | Days |
|---|---|---|
| P6-T1 | Generate point ids and the card skeleton from the local grammar files (blocks 1 and 2) | 0.5 |
| P6-T2 | Write the own-words German cards for about 30 points in blocks 1 and 2 (no Persian or English text) | 1 (plus owner review 1) |
| P6-T3 | Detectors and candidate links, human confirmation of links for both stories | 1 |
| P6-T4 | `GrammarDrawer` component, persistence setting, phone sheet and desktop column | included in P5 effort where possible, otherwise 1 |

Acceptance: every sentence with points shows them in the drawer; "New in this story" marks match the first occurrences;
the drawer state persists across reloads and devices; no book text is committed unless Open Question 1 allows it.

## Phase 7: Integration, hardening, device matrix

| Task | Detail | Days |
|---|---|---|
| P7-T1 | End to end pass against the dev Supabase project with two accounts and two devices | 1 |
| P7-T2 | Manual device and keyboard matrix (`13-test-plan.md`), fix list | 2 |
| P7-T3 | Accessibility pass with VoiceOver, TalkBack and keyboard only | 1 |
| P7-T4 | Performance pass: bundle size (lazy-load the dictation chunk), memory with long sessions, LCP on the story list | 0.5 |
| P7-T5 | Content proofreading of the final JSON, a listening pass on the hottest 50 sentences | 0.5 |

Acceptance: the matrix has no open blocker; edge-case rows all have a verified result or an accepted deviation.

## Phase 8: Release

Follows `CHECKLIST-deploy.md` and `11-release-plan.md`. Acceptance: the flag is flipped, the 72-hour watch ends clean or with
the rollback decision recorded.

## Phase 9: Beta follow-up and the next stories

Fix hot sentences through content PRs, address matrix findings, then onboard story 3 as a pure content task (the first
proof that the "no code per story" promise holds). Each later story needs about one day of review plus generation time.
