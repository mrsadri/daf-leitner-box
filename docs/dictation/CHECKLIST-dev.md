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

- [x] P0-T1 Grammar decisions made: own-words cards, German only (OQ 1 and OQ 2, decided 2026-11-15)
- [ ] P0-T2 TTS spike: 20 voices auditioned, licence and price read, `seed` determinism checked, provider chosen (OQ 7)
- [ ] P0-T2 Casting table for the stories 1 and 2 characters written into `content/dictation/voices.json` (modes A, B, C)
- [ ] P0-T3 Piper spike: German voice list and licences (OQ 4), cedilla reproduced, NFC plus `phoneme_id_map` check proven
- [ ] P0-T3 `ffmpeg` pitch shift (`rubberband` or `asetrate` plus `atempo`) verified on this machine
- [ ] P0-T4 Dev Supabase project exists (OQ 8) — **accepted deviation (2026-11-16):** no dev project; the database part was tested with the local SQL harness (`scripts/test-sql.sh`, migration twice, RLS, caps) and the app in demo mode. The bucket is no longer needed (media on Vercel, see `05-audio.md` Hosting)
- [x] P0-T5 Illustration naming and format fixed (OQ 3): `SNN-QN.jpg/png/webp`, about 4:3, lenient name matching; `prepare_images.py` makes WebP 1600x1200 and 800x600 with the source hash in the name; story 2 uses the placeholder state until its images exist
- [ ] P0-T6 Supabase plan limits for Storage and egress noted in the risk register

## Phase 1: content pipeline (6 days)

- [x] P1-T1 `scripts/dictation/` skeleton; Markdown parser; bold stripping; normalization; six-sequence validation
- [x] P1-T2 Splitter rules S1 to S16 implemented; one `unittest` fixture per rule; golden files for stories 1 and 2
- [x] P1-T2 `abbreviations.json` created (Tel., Nr., Dr., Prof., z. B., d. h., usw., bzw., ca., Str., ...)
- [x] P1-T3 `content/dictation/cast.json` with aliases for every character in stories 1 and 2
- [x] P1-T3 Speaker attribution rules (tag, pronoun, previous narration, turn taking), `segments` for mixed sentences
- [x] P1-T3 Review report `build/dictation/story-NN.speakers.md` generated
- [x] P1-T4 Stable id lock file algorithm (exact match, similarity pairing at 0.6, new ids, retired ids) with tests for edit, insert, delete, reorder
- [x] P1-T5 Vocabulary form index from `public/data/wortschatz-daf-kompakt.csv` (nouns, plurals, verbs, generated present paradigm, adjectives, phrases, clitics)
- [x] P1-T5 Separable verb link groups (the CSV already holds the split cards of `verb-splits.json`, so the linker reads `trennbar` and the Präsens particle); duplicate catalog entries ordered by lesson
- [ ] P1-T5 Coverage report (linked content tokens at least 97 percent) and `inflections.json` for the gaps. STATUS: report and file exist; story 1 reaches 96.4 percent and story 2 93.5 percent of content tokens (98.2 and 96.1 percent of the bold target words); the remaining gaps are words the CSV does not contain (Euro, Uhr, Musik, ...), listed in `build/dictation/story-NN.links.md` for the owner to decide
- [x] P1-T6 `tts_text.py` for ordinals, times, prices, phone numbers, postal codes, abbreviations; `overrides.speech` supported
- [x] P1-T7 Publish step writes `public/data/stories/index.json`, `story-01.json`, `story-02.json`, `contentVersion`; output is byte-identical on a second run
- [x] P1-T7 CI: add `python3 -m unittest discover scripts/dictation/tests` to `.github/workflows/ci.yml`
- [x] P1-T7 `tests/dictationContent.test.ts` added and green
- [ ] Owner: speaker review for stories 1 and 2 completed, `reviewed` ranges recorded in the overrides files
- [ ] Owner: split and link reports read, decisions written to overrides
- [ ] Acceptance: 0 `UNKNOWN` speakers, no unreviewed medium or low rows, content test green, JSON text equals the Markdown text apart from the bold markers (diff script)

## Phase 2: pure logic modules (4 days)

- [x] P2-T1 `src/services/dictation/normalize.ts` and `tests/dictationNormalize.test.ts`
- [x] P2-T2 `compare.ts` with all categories and `CheckResult`; `tests/dictationCompare.test.ts` (table-driven)
- [x] P2-T2 Verify: capitalization, commas, `ae/oe/ue/ss`, typos are mistakes; no category prints the correct letters
- [x] P2-T3 `submitTrigger.ts` and `tests/dictationTrigger.test.ts` (quote balance, ordinals, abbreviations, `...`, composition)
- [x] P2-T4 `moveBack.ts` (`computeMoveBack`) and `leitnerEngine.moveBackOne` (additive change only); `tests/dictationMoveBack.test.ts` incl. the 16-day example
- [x] P2-T4 `wordLink.ts` (tap to card resolution, owned card preferred) and `tests/dictationWordLink.test.ts`
- [x] P2-T5 `voiceMap.ts`, `fallback.ts`, `progressMerge.ts` and their tests
- [x] `npm run lint` and `npm test` green

## Phase 3: data model, sync, settings, flag (3 days)

- [x] P3-T1 `supabase/migrations/2026MMDD_story_dictation.sql`: `story_progress`, `story_sentence_progress`, `app_flags`, `dictation_events`, rank function, `save_dictation_progress`, caps, RLS, grants; idempotent; nothing existing altered
- [x] P3-T2 `supabase/tests/story_dictation.test.sql` written; `scripts/test-sql.sh` green (migration runs twice, RLS isolation, merge monotonic, idempotent, caps, cascade)
- [x] P3-T3 Optional `AppSettings` fields: `dictationAudioMode`, `dictationGrammarOpen`, `dictationIntroSeen` (no change to `DEFAULT_SETTINGS`)
- [x] P3-T3 `src/services/dictationSync.ts` (queue, cache, retry, `visibilitychange`, `online`, demo mode, per-user keys, cleared on sign out)
- [x] P3-T3 Flag reader (`app_flags.dictation_enabled`, fail open to `DICTATION_ENABLED`) and the admin-only `?dictation=1` preview override
- [x] P3-T4 `docs/supabase-dictation-setup.md` written in the style of `docs/supabase-shared-insights-setup.md` (before and after checks, migration URL, bucket steps, flag, monitoring queries, drop script)
- [x] Confirm the app still runs with the migration absent (progress local, one notice) — covered by a unit test of the queue (`MigrationMissingError`); the UI notice itself comes with Phase 5

## Phase 4: audio generation and media (4 days)

- [x] P4-T1 `gen_audio.py`: keys, incremental runs, loudness normalization, trim and pad, MP3 mono 64 kbps, segment crossfade, provider adapter interface — done for Mode B (no provider adapter class: only Piper exists)
- [ ] P4-T2 (dropped by the owner decision of 2026-11-15, no paid TTS) Mode A adapter for the chosen provider, `--dry-run` cost output, `--max-chars` guard; key read from shell or keychain only
- [x] P4-T3 Mode B Piper adapter with NFC fix, phoneme map check, hard failure on unknown phonemes; `test_piper_phonemes.py` — `lib/phoneme_fix.py`, `lib/piper_tts.py`; `test_piper_phonemes.py` skips without Piper
- [x] P4-T4 `audio_qa.py` report; listening sample done (10 percent plus long, digit, ellipsis, mixed-segment sentences; ich-sound words per Piper voice) — report written; the listening sample is for the owner (`build/dictation/audio-qa-NN.md`), not done. 2026-11-16: the first QA found 5 silent files (the MLS model renders one-word lines such as "Ja." as near silence); `gen_audio.py` now retries with other noise settings and never writes silence, the 5 files were regenerated, QA shows 0 failures and 12 slow-but-plausible sentences listed for the listening pass
- [x] P4-T4 `upload_media.py`: dry run by default, `--target` and `--yes` required, never overwrites, sets `cacheControl`
- [x] P4-T5 Story 1 illustrations (6, delivered 2026-11-16 as 2400x1792 JPG, three names with a zero-width space) converted to WebP 1600x1200 and 800x600 in `public/story-media/images/`, descriptive alt texts in both languages in `story-01.overrides.json`; served by Vercel, not uploaded to a bucket (hosting decision 2026-11-16). Story 2: placeholders until its 6 images exist
- [x] P4-T5 `story-01.audio.B.json` and `story-02.audio.B.json` committed (no A indexes); content test checks every sentence has a B key and the right text hash
- [x] Verify: no API key, service-role key or `ELEVEN` string anywhere in the repo or in `dist/` — nothing to leak: Piper needs no key; the content test checks the committed files

## Phase 5: UI (9 days)

- [x] P5-T1 `dictation` tab (`ActiveTab`, Navbar, `App.tsx`), `?go=dictation`, error boundary, paused state, Beta badge, dashboard card
- [x] P5-T1 `fa.ts` and `en.ts` keys (labels, hints, 8 or more praise messages each, category names, error states); `npm run lint` passes
- [x] P5-T2 Content loader (`cache: 'no-cache'`, `contentVersion` check); story list; story detail with 6 tiles; sequence intro with illustration and placeholder — `no-cache` revalidation yes; no separate contentVersion check (a changed file simply loads fresh)
- [x] P5-T3 Playback controller: one unlocked element, token guard, 150 ms debounce, watchdog, prefetch next two sentences into the Cache API
- [x] P5-T3 `storySpeaker` for Mode C (`speakAs`, segments, 50 ms gap after `cancel()`), `speechService.speak` unchanged — lives in `browserSources.ts` (speaks segment by segment, 50 ms after cancel); `speechService.speak` unchanged
- [ ] P5-T3 Fallback chain wiring, source note, circuit breaker DONE; `dictation_events` reporting NOT done yet (needs the migration in the dev project)
- [x] P5-T4 `SentenceStage`: textarea attributes (`autocorrect`, `autocapitalize`, `spellcheck` off), umlaut bar (focus kept, insert at cursor, shift toggle), trigger wiring, Check, Enter, Skip, Next rules
- [x] P5-T4 Drafts per sentence and hash; history list with replay; sequence summary and story end screens
- [x] P5-T5 `FeedbackText` marks per category (shapes and lines, not color only), summary line, praise (no repeat), polite live region
- [x] P5-T6 `WordSheet`: base form and card state, Add to my box, Move back one compartment, Undo toast, custom card via `NewCardModal` prefill — the "custom card via NewCardModal prefill" part is simplified: the sheet adds the card directly with `addCard`
- [x] P5-T6 Verify in code review: no code path changes a card on typing, Next or Skip — only `WordSheet.tsx` calls the engine (`grep leitnerEngine src/components/dictation`)
- [ ] P5-T7 Settings section: mode radios with Test button, speed, grammar default; `dictationIntroSeen` dialog — Mode radios (B or C) and credit are in; the Test button exists for C; speed reuses the global speech-rate setting; the grammar-drawer checkbox is in (Phase 6)
- [ ] P5-T7 Responsive layouts (desktop two columns, tablet, phone with sticky umlaut bar and `visualViewport` handling); RTL pass for edge cases R1 to R10 — phone: sticky umlaut bar and `visualViewport` done; Persian and English checked in Chromium (phone and desktop); there is no second column yet (the grammar drawer is Phase 6); the full R1 to R10 pass is for Phase 7
- [x] Lazy-load the dictation chunk (`React.lazy`) so the main bundle does not grow — chunk 41 kB (12 kB gzip); the main bundle still grew from 346.7 to 371.3 kB (gzip 112.0 to 121.0) because the fa/en strings are in it

## Phase 6: grammar (3 days plus owner review)

- [x] P6-T1 Point ids and skeleton generated from the local grammar files for blocks 1 and 2 — `scripts/dictation/grammar_skeleton.py`; 13 points in block 1, 15 in block 2; only titles, lessons and levels are read, ids are fixed in `content/dictation/grammar/block-NN.json`
- [ ] P6-T2 Own-words German-only cards for about 30 points; owner reviewed (no book text committed) — all 28 cards are written (rule, own mini table, examples from the stories); **owner review still open** (a German speaker should read them once)
- [ ] P6-T3 Detectors, candidate links, human confirmation in the overrides; "New in this story" computed — `lib/grammar.py` detectors (tested), scope rule, `grammar.add/remove`, report `build/dictation/story-NN.grammar.md`, `story-NN.grammar.json` with `first`; **human confirmation open**: set `grammar.reviewed` in the overrides after reading the report (story JSON carries `grammarReviewed`)
- [x] P6-T4 `GrammarDrawer`: trigger is the last entered sentence, sequence list before the first entry, open or collapsed setting persists across reload and devices, phone sheet and desktop column — checked in Chromium (desktop English, phone Persian); no console errors
- [x] Confirm that no textbook-derived file is staged in Git (`git status` shows nothing from `Grammatik/`, `Wortschatz/`, `Kontext/`) — verified before the Phase 6 commit

## Phase 7: integration and hardening (5 days)

- [ ] P7-T1 Two accounts and two devices against the dev Supabase project (integration scenarios 1 to 7 in `13-test-plan.md`)
- [ ] P7-T2 Manual device and keyboard matrix executed in both interface languages; findings table filled; blockers zero
- [ ] P7-T3 Accessibility pass (2026-11-16, Chromium only): axe-core WCAG 2 A/AA found one contrast problem (grammar note and skipped mark in slate-400, fixed) and then zero violations on the stage with mistakes, the grammar column, the phone peek bar and the open sheet (English desktop, Persian phone). Edge cases checked in the browser: X3 keyboard flow and Escape closing the sheet, X4 focus (Next after a correct sentence, input after Next), X5 no animation under reduced motion, X6 no horizontal scroll at 640 px and 390 px, X9 no target under 44 px, R1, R4, R5 (umlaut order), R7. Accepted deviation X3: the grammar toggle is first in the tab order (top row), not last. Still open: VoiceOver, TalkBack, NVDA, Safari and Firefox, real 200 percent zoom — all need devices; original item: VoiceOver (iOS, macOS), TalkBack, NVDA, keyboard only, 200 percent zoom, reduced motion
- [x] P7-T4 Performance pass (2026-11-16): dictation chunk 50.7 kB (14.4 kB gzip, lazy), main bundle 373.6 kB (121.8 kB gzip); story JSON 207 and 245 kB plus audio indexes 41 and 50 kB, fetched only when a story opens; images 230 to 340 kB (1600px) and 80 to 115 kB (800px, used on phones); audio files about 20 kB each, one year immutable cache. Long-session memory not measured (needs a real device)
- [ ] P7-T5 Final proofreading and the hottest-50-sentences listening pass
- [ ] Every row in `10-edge-cases.md` has a verified result or an accepted, written deviation
- [x] `npm run lint`, `npm test` (267), `npm run build`, `python3 -m unittest discover scripts/dictation/tests` (82, one Piper test skipped), `scripts/test-sql.sh` (incl. `story_dictation`) all green on 2026-11-16; CI also runs `stage_media.py --check`
- [x] `dist/` secret search (`service_role`, `sk_`, `ELEVEN`, service-role JWT) returns nothing; main bundle growth recorded (346.7 to 373.6 kB, gzip 112.0 to 121.8 kB, mostly fa/en strings)
- [ ] PRs reviewed and merged to `main` (owner merges; the exact sentence "merge PR #N with admin and deploy to production" is needed only at release time, see the deploy checklist)

## Release readiness (2026-11-16)

Release model agreed with the owner: deploy with the flag **off**; only the admin sees the tab (`?dictation=1`). The
open owner items below do not block the deploy, but they block switching the flag on for everyone:
speaker review (stories 1 and 2), split and link decisions, German-speaker check of the 28 grammar cards and the
grammar links, listening pass (`audio-qa-NN.md`), the device and screen-reader matrix (P7-T1 to P7-T3), and the six
story-2 illustrations (placeholders until then). Two story-1 pictures contain English words («CONCERT», «MILK»);
consider a German version when they are regenerated.

## Phase 9: after release (development side)

- [ ] Hot-sentence fixes as content PRs
- [ ] Matrix findings fixed
- [ ] Onboard story 3 as a pure content task and record any step that needed code (each one is a gap in the pipeline to close)
- [ ] Remove the Beta badge and flag check in a normal release when the exit criteria in `11-release-plan.md` are met
