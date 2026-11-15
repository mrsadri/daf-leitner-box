# Checklist: development work

Tick boxes as work completes. Task ids match `12-phased-plan.md`. Work on a branch per phase (for example
`feature/dictation-content-pipeline`), PR into `main` (protected: PR, one review, `build` check).
**Never** point a development build at the production Supabase project. Use demo mode (`VITE_DEMO_MODE=1`), the local SQL
harness (`scripts/test-sql.sh`) or a separate dev Supabase project. After any `vercel link`, delete the generated `.env.local`.

## Before any code

- [ ] Read `docs/dictation/README.md` and `14-risks-and-open-questions.md`
- [ ] Phase 0 decisions recorded (items below) and the open-question table updated with the answers
- [ ] Branch created from current `main`; working tree clean of unrelated changes (`000-*.txt` notes stay uncommitted unless the owner says otherwise)

## Phase 0: decisions and spikes (3 days)

- [ ] P0-T1 Decide grammar publishing (OQ 1) and who writes the grammar explanations (OQ 2)
- [ ] P0-T2 TTS spike: 20 voices auditioned, licence and price read, `seed` determinism checked, provider chosen (OQ 7)
- [ ] P0-T2 Casting table for the stories 1 and 2 characters written into `content/dictation/voices.json` (modes A, B, C)
- [ ] P0-T3 Piper spike: German voice list and licences (OQ 4), cedilla reproduced, NFC plus `phoneme_id_map` check proven
- [ ] P0-T3 `ffmpeg` pitch shift (`rubberband` or `asetrate` plus `atempo`) verified on this machine
- [ ] P0-T4 Dev Supabase project exists (OQ 8); bucket `story-media` created there; public read, `Cache-Control` and CORS tested from `localhost:3000`
- [ ] P0-T5 Illustration naming and format fixed (OQ 3); two placeholder images produced
- [ ] P0-T6 Supabase plan limits for Storage and egress noted in the risk register

## Phase 1: content pipeline (6 days)

- [ ] P1-T1 `scripts/dictation/` skeleton; Markdown parser; bold stripping; normalization; six-sequence validation
- [ ] P1-T2 Splitter rules S1 to S16 implemented; one `unittest` fixture per rule; golden files for stories 1 and 2
- [ ] P1-T2 `abbreviations.json` created (Tel., Nr., Dr., Prof., z. B., d. h., usw., bzw., ca., Str., ...)
- [ ] P1-T3 `content/dictation/cast.json` with aliases for every character in stories 1 and 2
- [ ] P1-T3 Speaker attribution rules (tag, pronoun, previous narration, turn taking), `segments` for mixed sentences
- [ ] P1-T3 Review report `build/dictation/story-NN.speakers.md` generated
- [ ] P1-T4 Stable id lock file algorithm (exact match, similarity pairing at 0.6, new ids, retired ids) with tests for edit, insert, delete, reorder
- [ ] P1-T5 Vocabulary form index from `public/data/wortschatz-daf-kompakt.csv` (nouns, plurals, verbs, generated present paradigm, adjectives, phrases, clitics)
- [ ] P1-T5 Separable verb link groups using `scripts/data/verb-splits.json`; duplicate catalog entries ordered by lesson
- [ ] P1-T5 Coverage report (linked content tokens at least 97 percent) and `inflections.json` for the gaps
- [ ] P1-T6 `tts_text.py` for ordinals, times, prices, phone numbers, postal codes, abbreviations; `overrides.speech` supported
- [ ] P1-T7 Publish step writes `public/data/stories/index.json`, `story-01.json`, `story-02.json`, `contentVersion`; output is byte-identical on a second run
- [ ] P1-T7 CI: add `python3 -m unittest discover scripts/dictation/tests` to `.github/workflows/ci.yml`
- [ ] P1-T7 `tests/dictationContent.test.ts` added and green
- [ ] Owner: speaker review for stories 1 and 2 completed, `reviewed` ranges recorded in the overrides files
- [ ] Owner: split and link reports read, decisions written to overrides
- [ ] Acceptance: 0 `UNKNOWN` speakers, no unreviewed medium or low rows, content test green, JSON text equals the Markdown text apart from the bold markers (diff script)

## Phase 2: pure logic modules (4 days)

- [ ] P2-T1 `src/services/dictation/normalize.ts` and `tests/dictationNormalize.test.ts`
- [ ] P2-T2 `compare.ts` with all categories and `CheckResult`; `tests/dictationCompare.test.ts` (table-driven)
- [ ] P2-T2 Verify: capitalization, commas, `ae/oe/ue/ss`, typos are mistakes; no category prints the correct letters
- [ ] P2-T3 `submitTrigger.ts` and `tests/dictationTrigger.test.ts` (quote balance, ordinals, abbreviations, `...`, composition)
- [ ] P2-T4 `moveBack.ts` (`computeMoveBack`) and `leitnerEngine.moveBackOne` (additive change only); `tests/dictationMoveBack.test.ts` incl. the 16-day example
- [ ] P2-T4 `wordLink.ts` (tap to card resolution, owned card preferred) and `tests/dictationWordLink.test.ts`
- [ ] P2-T5 `voiceMap.ts`, `fallback.ts`, `progressMerge.ts` and their tests
- [ ] `npm run lint` and `npm test` green

## Phase 3: data model, sync, settings, flag (3 days)

- [ ] P3-T1 `supabase/migrations/2026MMDD_story_dictation.sql`: `story_progress`, `story_sentence_progress`, `app_flags`, `dictation_events`, rank function, `save_dictation_progress`, caps, RLS, grants; idempotent; nothing existing altered
- [ ] P3-T2 `supabase/tests/story_dictation.test.sql` written; `scripts/test-sql.sh` green (migration runs twice, RLS isolation, merge monotonic, idempotent, caps, cascade)
- [ ] P3-T3 Optional `AppSettings` fields: `dictationAudioMode`, `dictationGrammarOpen`, `dictationIntroSeen` (no change to `DEFAULT_SETTINGS`)
- [ ] P3-T3 `src/services/dictationSync.ts` (queue, cache, retry, `visibilitychange`, `online`, demo mode, per-user keys, cleared on sign out)
- [ ] P3-T3 Flag reader (`app_flags.dictation_enabled`, fail open to `DICTATION_ENABLED`) and the admin-only `?dictation=1` preview override
- [ ] P3-T4 `docs/supabase-dictation-setup.md` written in the style of `docs/supabase-shared-insights-setup.md` (before and after checks, migration URL, bucket steps, flag, monitoring queries, drop script)
- [ ] Confirm the app still runs with the migration absent (progress local, one notice)

## Phase 4: audio generation and media (4 days)

- [ ] P4-T1 `gen_audio.py`: keys, incremental runs, loudness normalization, trim and pad, MP3 mono 64 kbps, segment crossfade, provider adapter interface
- [ ] P4-T2 Mode A adapter for the chosen provider, `--dry-run` cost output, `--max-chars` guard; key read from shell or keychain only
- [ ] P4-T3 Mode B Piper adapter with NFC fix, phoneme map check, hard failure on unknown phonemes; `test_piper_phonemes.py`
- [ ] P4-T4 `audio_qa.py` report; listening sample done (10 percent plus long, digit, ellipsis, mixed-segment sentences; ich-sound words per Piper voice)
- [ ] P4-T4 `upload_media.py`: dry run by default, `--target` and `--yes` required, never overwrites, sets `cacheControl`
- [ ] P4-T5 Images converted to WebP (1600x1200 and 800x600), uploaded to the **dev** bucket
- [ ] P4-T5 `story-01.audio.A.json`, `.B.json`, `story-02.audio.A.json`, `.B.json` committed; content test checks every sentence has both keys
- [ ] Verify: no API key, service-role key or `ELEVEN` string anywhere in the repo or in `dist/`

## Phase 5: UI (9 days)

- [ ] P5-T1 `dictation` tab (`ActiveTab`, Navbar, `App.tsx`), `?go=dictation`, error boundary, paused state, Beta badge, dashboard card
- [ ] P5-T1 `fa.ts` and `en.ts` keys (labels, hints, 8 or more praise messages each, category names, error states); `npm run lint` passes
- [ ] P5-T2 Content loader (`cache: 'no-cache'`, `contentVersion` check); story list; story detail with 6 tiles; sequence intro with illustration and placeholder
- [ ] P5-T3 Playback controller: one unlocked element, token guard, 150 ms debounce, watchdog, prefetch next two sentences into the Cache API
- [ ] P5-T3 `storySpeaker` for Mode C (`speakAs`, segments, 50 ms gap after `cancel()`), `speechService.speak` unchanged
- [ ] P5-T3 Fallback chain wiring, source note, circuit breaker, `dictation_events` reporting once per type per sentence per session
- [ ] P5-T4 `SentenceStage`: textarea attributes (`autocorrect`, `autocapitalize`, `spellcheck` off), umlaut bar (focus kept, insert at cursor, shift toggle), trigger wiring, Check, Enter, Skip, Next rules
- [ ] P5-T4 Drafts per sentence and hash; history list with replay; sequence summary and story end screens
- [ ] P5-T5 `FeedbackText` marks per category (shapes and lines, not color only), summary line, praise (no repeat), polite live region
- [ ] P5-T6 `WordSheet`: base form and card state, Add to my box, Move back one compartment, Undo toast, custom card via `NewCardModal` prefill
- [ ] P5-T6 Verify in code review: no code path changes a card on typing, Next or Skip
- [ ] P5-T7 Settings section: mode radios with Test button, speed, grammar default; `dictationIntroSeen` dialog
- [ ] P5-T7 Responsive layouts (desktop two columns, tablet, phone with sticky umlaut bar and `visualViewport` handling); RTL pass for edge cases R1 to R10
- [ ] Lazy-load the dictation chunk (`React.lazy`) so the main bundle does not grow

## Phase 6: grammar (3 days plus owner review)

- [ ] P6-T1 Point ids and skeleton generated from the local grammar files for blocks 1 and 2
- [ ] P6-T2 Own-words cards (Persian, English) for about 30 points; owner reviewed (or approved book text per OQ 1)
- [ ] P6-T3 Detectors, candidate links, human confirmation in the overrides; "New in this story" computed
- [ ] P6-T4 `GrammarDrawer`: trigger is the last entered sentence, sequence list before the first entry, open or collapsed setting persists across reload and devices, phone sheet and desktop column
- [ ] Confirm that no textbook-derived file is staged in Git (`git status` shows nothing from `Grammatik/`, `Wortschatz/`, `Kontext/`)

## Phase 7: integration and hardening (5 days)

- [ ] P7-T1 Two accounts and two devices against the dev Supabase project (integration scenarios 1 to 7 in `13-test-plan.md`)
- [ ] P7-T2 Manual device and keyboard matrix executed in both interface languages; findings table filled; blockers zero
- [ ] P7-T3 Accessibility pass: VoiceOver (iOS, macOS), TalkBack, NVDA, keyboard only, 200 percent zoom, reduced motion
- [ ] P7-T4 Performance pass: chunk size, long-session memory, story list load time
- [ ] P7-T5 Final proofreading and the hottest-50-sentences listening pass
- [ ] Every row in `10-edge-cases.md` has a verified result or an accepted, written deviation
- [ ] `npm run lint`, `npm test`, `npm run build`, `python3 -m unittest discover scripts/dictation/tests`, `scripts/test-sql.sh` all green
- [ ] `dist/` secret search returns nothing; main bundle growth recorded
- [ ] PRs reviewed and merged to `main` (owner merges; the exact sentence "merge PR #N with admin and deploy to production" is needed only at release time, see the deploy checklist)

## Phase 9: after release (development side)

- [ ] Hot-sentence fixes as content PRs
- [ ] Matrix findings fixed
- [ ] Onboard story 3 as a pure content task and record any step that needed code (each one is a gap in the pipeline to close)
- [ ] Remove the Beta badge and flag check in a normal release when the exit criteria in `11-release-plan.md` are met
