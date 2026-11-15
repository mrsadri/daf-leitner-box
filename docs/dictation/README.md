# Story dictation: development plan

Status: planning only. Nothing in this folder changes application code, the database, or Supabase.
Source brief: `000-story-dev-plan.txt`. Language of this plan: English.

## Summary

"Story dictation" is a new section of daf-leitner-box. The learner opens a story and one of its 6 sequences, sees the
sequence illustration, hears the story one sentence at a time (narrator and characters each with their own voice),
and types what they hear. Typing the sentence's terminal punctuation submits it. The app highlights mistakes or
shows a short praise. The learner may fix and resubmit without limit, press Next, or press "I didn't get it" to see
the sentence and move on. Finished sentences stay on screen as correct text and replay on click. Progress resumes at
the exact sentence on any device.

Scope of the first release: stories 1 and 2 (`DaF-kompakt-work/DaF-kompakt/output/story-01.md`, `story-02.md`),
about 449 and 513 sentences, 12 sequences, 12 illustrations. The design supports all 10 stories without code changes:
a new story is a content PR plus a media upload.

### What the plan decides (the short version)

| Topic | Decision | Why (one line) |
|---|---|---|
| Content storage | Static JSON in the repo under `public/data/stories/`, built from the story Markdown by a script | Public, small, reviewable in PRs, already excluded from the SPA rewrite in `vercel.json`, no migration per story |
| Media storage | Audio and illustrations in a public Supabase Storage bucket `story-media`, content-addressed file names | Keeps deploys small, immutable caching, regeneration is automatic when text changes |
| Sentence identity | Stable sentence ids from a committed lock file, plus a content hash | Progress survives content edits and sentence insertions |
| Speaker attribution | Rules first (quotes, dialogue tags, turn taking), human review of every dialogue sentence, overrides file wins | Wrong voices are the most visible content bug, so a person signs off |
| Paid TTS | ElevenLabs for Mode A, Google Cloud TTS as the documented backup | Many distinct, natural character voices; pipeline is provider-agnostic |
| Open TTS | Piper for Mode B, with NFC normalization of phonemes and a hard failure on dropped phonemes | Fixes the "c" + U+0327 cedilla bug at the source |
| Device voices | Mode C with a deterministic, persisted character-to-voice map plus pitch and rate offsets | Same character sounds the same across stories and sessions |
| Default audio mode | A, with automatic fallback A, B, C | Works on every device, even without German device voices |
| Checking | Strict, token alignment plus character diff, categories drive the highlight, never penalized | Matches the owner's rules; resubmission is free |
| Leitner | Manual only, from the feedback view; "move back" sets due = max(today, entry day + interval of the new box) | Matches the owner's 16-day example exactly |
| Progress | New tables with RLS, monotonic merge (`greatest`) saves, idempotent on retry | Additive, safe for existing users, tolerant of two devices |
| Release | One release to everyone, Beta badge, kill switch in a config constant plus a remote flag | Matches the brief; rollback without a DB change |

### Blocking items to resolve in Phase 0 (details in `14-risks-and-open-questions.md`)

1. **Copyright of grammar text (decided).** `.gitignore` excludes `DaF-kompakt-work/DaF-kompakt/Grammatik/`, `Wortschatz/` and `Kontext/`
   because they derive from the copyrighted textbook. Decision: the repo gets original, own-words grammar cards in
   **German only** (no Persian or English explanations) that reference the book's point titles and lesson numbers; the
   gitignored files are used only as a local source for linking.
2. **Illustrations do not exist yet (accepted, placeholders)** in the repo (only prompts, `output/image-prompts/S01-image-prompts.md`, ids
   `S01-Q1` to `S02-Q6`). Phase 0 fixes the file naming and format; development can proceed with placeholders.
3. **Piper German voice inventory and licences** are confirmed in the Phase 0 spike before Mode B is promised (accepted).

## Files in this folder

| File | Contents |
|---|---|
| `01-current-state.md` | Codebase map with file paths |
| `02-user-flows.md` | Flows, step by step |
| `03-ui-states.md` | Every screen state, layout, RTL, accessibility |
| `04-content-pipeline.md` | Markdown to per-sentence dataset, speaker attribution, splitting, onboarding a story |
| `05-audio.md` | Three audio modes, voices, generation, storage, fallback |
| `06-answer-checking.md` | Normalization, alignment, categories, submit trigger |
| `07-leitner-integration.md` | Manual add and move back, inflections, back side |
| `08-grammar-drawer.md` | Grammar source, linking, drawer behavior |
| `09-data-model.md` | Tables, RLS, RPCs, settings keys, migration approach |
| `10-edge-cases.md` | Exhaustive edge and corner case table |
| `11-release-plan.md` | Beta release, monitoring, rollback |
| `12-phased-plan.md` | Phases, tasks, dependencies, effort, acceptance criteria |
| `13-test-plan.md` | Unit, integration, SQL, manual device matrix |
| `14-risks-and-open-questions.md` | Risks and open questions |
| `CHECKLIST-dev.md` | Tick-box checklist of development work |
| `CHECKLIST-deploy.md` | Tick-box checklist of deploy and operations work |

## Ground rules that apply to every phase

- Real users exist. Every database change is additive and backward compatible. No existing table is altered in a way
  that changes current behavior.
- Development never touches the production Supabase project. Use demo mode (`VITE_DEMO_MODE=1`), a separate dev
  Supabase project, or the local Postgres harness `scripts/test-sql.sh`. Do not run `vercel link` and leave the
  generated `.env.local` in place. Production SQL goes out as a setup document (pattern of
  `docs/supabase-shared-insights-setup.md`) that the owner runs in the Supabase dashboard.
- API keys for ElevenLabs or Google and the Supabase service-role key exist only in the owner's local shell for the
  generation and upload scripts. They are never `VITE_`-prefixed, never committed, never in Vercel client env.
- `main` is protected: work on a branch, PR, review, `build` check. Deploys are CLI-based.
- No em dashes in any document in this folder.
