# 04. Content pipeline

Goal: turn `story-NN.md` into a reviewed, versioned, per-sentence dataset that the app loads as static JSON. Adding
story 3 to 10 must be a content task: Markdown, images, an overrides file, a script run, an upload, a PR.

## Decision: where content lives

| Option | Verdict | Reason |
|---|---|---|
| Static JSON in the repo, built by a script, served from `public/data/stories/` | **Chosen for text and indexes** | Public content, small (about 150 KB raw, about 30 KB gzip per story with link data), reviewed in PRs, CDN-cached, versioned with the app, needs no migration and no RLS, already excluded from the SPA rewrite (`vercel.json` excludes `/data/`), works in demo mode |
| Supabase tables for stories and sentences | Rejected | Every new story would need an insert job against the production DB, content review would leave Git, and a bad edit could not be rolled back with the app |
| Supabase Storage for the JSON | Rejected | Same review problem; no benefit over the repo |
| Supabase Storage for audio and images | **Chosen for media** | Roughly 15 to 30 MB of audio per story per mode and about 12 illustrations would bloat the repo and Vercel deploys; content-addressed names give immutable caching and free regeneration |

Consequence: the sentence JSON and the audio index ship together with a deploy, while media files are uploaded
**before** that deploy (deploy checklist order matters).

## Repository layout (new)

```
scripts/dictation/                 Python 3, standard library only (like scripts/build-*.py)
  build_story.py                   parse, split, attribute, link, validate, publish
  gen_audio.py                     Mode A and Mode B generation (see 05-audio.md)
  upload_media.py                  Storage upload (dry run by default)
  lib/ splitter.py attribution.py linker.py grammar_links.py tts_text.py
content/dictation/                 committed, original work only
  cast.json                        global characters and aliases (stable across stories)
  voices.json                      character to voice mapping per audio mode (05-audio.md)
  abbreviations.json               splitter abbreviation list
  inflections.json                 extra word forms the CSV lacks
  story-01.overrides.json          human decisions: speakers, tts text, review marks, splits
  story-01.ids.json                lock file of sentence ids (never edit by hand)
  grammar/                         own-words grammar cards per block (08-grammar-drawer.md)
public/data/stories/               generated, committed
  index.json                       list of published stories
  story-01.json                    sequences and sentences
  story-01.audio.A.json            sentence id to file key (and B)
build/dictation/                   generated review reports, not committed
```

Source Markdown stays where it is (`DaF-kompakt-work/DaF-kompakt/output/story-NN.md`, committed original work).
The textbook-derived folders (`Grammatik/`, `Wortschatz/`, `Kontext/`) remain gitignored and are read locally only.

## Output dataset (illustration only)

```ts
interface StoryIndex { version: 1; stories: { id: 'story-01'; title: string; lessons: [number, number];
  block: number; sequences: number; sentences: number; contentVersion: string; file: string }[] }

interface Story { id: string; title: string; block: number; contentVersion: string; sequences: Sequence[] }
interface Sequence {
  id: 'S01-Q1'; order: number; title: string;
  situation: { fa: string; en: string };
  image: { key: 'images/S01-Q1'; w: 1600; h: 1200; alt: { fa: string; en: string } } | null;
  sentences: Sentence[];
}
interface Sentence {
  id: 's01q1n0007';            // stable, from the lock file, never reused
  order: number;               // 1-based within the story, recomputed on every build
  text: string;                // clean display and answer text (bold stripped, NFC)
  hash: string;                // sha256(text) first 12 hex
  speaker: string;             // cast id of the quoted speaker, or NARRATOR
  segments?: { text: string; speaker: string }[];   // only when narration and a quote are mixed
  speech?: string;             // text for TTS when it differs from text (numbers, times)
  endMark: '.' | '!' | '?' | '…';
  quoteBalance: number;        // opens minus closes in text (used by the submit trigger)
  flags: ('digits' | 'ordinalDot' | 'ellipsis' | 'quoted' | 'long' | 'endsDigitDot')[];
  links: { s: number; e: number; cards: string[]; lemma: string; kind: 'form' | 'separable' | 'phrase' }[];
  grammar: string[];           // grammar point ids (08-grammar-drawer.md)
}
```

`links` use character offsets in `text`. The runtime tokenizer in `normalize.ts` produces the same word boundaries, and
a unit test asserts that every link range matches a token or a token group.

## Pipeline stages

1. **Parse.** Read the file, split on `## Sequenz N: Title`. For each sequence read `**Situation (فارسی)**`,
   `**Situation (English)**`, `**Text**`, ignore `**Fragen**` and `## Lösungen` (kept for a later feature). Record bold
   spans as target words (used for the vocabulary coverage report only), then strip `**`. Fail if a sequence lacks a
   section or the sequence count is not 6.
2. **Normalize text.** Unicode NFC, NBSP and narrow NBSP to space, collapse spaces, keep typographic quotes as
   written, unify `...` to `…`, flag any glyph outside the expected set (letters incl. äöüÄÖÜß and accented names such as
   Lucía and Ayşe, digits, `. , ! ? : ; … „ “ ” ‚ ‘ ’ « » - ( )`), and report each flagged glyph for review.
3. **Split into sentences** (next section).
4. **Attribute speakers** (section after) and build `segments`.
5. **Assign stable ids** from the lock file (section "Stable ids").
6. **Link words to vocabulary** (section "Word links").
7. **Link grammar points** (`08-grammar-drawer.md`).
8. **Prepare TTS text** (`speech`) with the normalizer in `tts_text.py` (numbers, times, dates, phone numbers).
9. **Validate and publish.** Hard failures stop the publish; warnings are printed. Output JSON is written with sorted
   keys and stable formatting so Git diffs show only real changes.

## Sentence splitting

A character-level state machine, not a regex, because quotes and dialogue tags span punctuation. State: current
double-quote depth (`„`), single-quote depth (`‚`), paragraph boundaries. Rules, in priority order:

| # | Situation | Rule | Example |
|---|---|---|---|
| S1 | End of paragraph | Always a boundary. A paragraph that does not end with `. ! ? …` (optionally followed by closing quotes) is a **build error** to fix in the source | |
| S2 | Terminal mark outside quotes | Boundary, closing quote characters directly after the mark belong to the sentence | `Es regnet.` |
| S3 | Terminal mark inside a quote, then closing quote, then `,` | **No boundary**: a dialogue tag follows, the sentence continues to the next terminal mark | `„Wie geht’s?“, fragt Lucía am Telefon.` is one sentence |
| S4 | Terminal mark inside a quote, closing quote, then space and an uppercase word | Boundary after the closing quote | `„Danke!“ Sie lacht.` is two sentences |
| S5 | Terminal mark inside a quote followed by more words in the same quote | If the whole quote is 20 words or fewer keep it as one sentence; otherwise split at the inner mark, keeping the opening quote only on the first part and the closing quote only on the last (`quoteBalance` records the imbalance) | `„Das ist Frau Lechner. Sie ist die Direktorin.“` |
| S6 | `:` before a quote | Not a boundary | `Sie sagt: „Ich komme.“` |
| S7 | Nested single quotes `‚…‘` | Never create boundaries; counted separately from double quotes | `Sie hat gesagt: ‚Das Apartment ist schon weg.‘` |
| S8 | Period after a known abbreviation (`abbreviations.json`: Tel., Nr., Dr., Prof., Hr., Fr., z. B., u. a., usw., bzw., ca., etc., Str., ggf., d. h., Std., Min.) followed by a digit or a lowercase word | Not a boundary. Followed by an uppercase word and the abbreviation is in the "never final" subset (z. B., d. h., Dr., Nr.) also not a boundary. Otherwise a boundary, and it is listed for review | `Tel. 0316 72 14` |
| S9 | Digits followed by a period then a month name or lowercase word (ordinal) | Not a boundary, flag `ordinalDot` | `Montag, 19. Oktober.` |
| S10 | Digits followed by a period then an uppercase non-month word | Boundary, but listed for review as `digit-dot boundary`; if the sentence ends with digits plus period set flag `endsDigitDot` | `... bis 21.` |
| S11 | Period, comma or colon between digits without space (decimals, thousands, times, ratios) | Never a boundary | `1:52`, `3,5`, `1.000`, `0664 23 59` |
| S12 | Ellipsis `…` followed by a lowercase word, or inside a quote followed by more words | Not a boundary | `„Ich … ich weiß nicht.“` |
| S13 | Ellipsis at the end of a paragraph or quote, or followed by closing quote and an uppercase word | Boundary; `endMark` is `…`; flag `ellipsis` | `„Vielleicht …“` |
| S14 | `;` and `-` and parentheses | Never a boundary | |
| S15 | Sentences over 25 words | Never split. Flag `long`. They are replayed at normal speed and the checker works unchanged (the longest seen is 33 words, a list of clothing colors) | |
| S16 | Sentences of one word (`Danke!`) | Kept. Flag nothing. | |

Every split decision that depends on S5, S8, S10 or S13 is written to the review report so a human sees it. The
splitter is Python (build time only), so it is tested with Python `unittest` in `scripts/dictation/tests/` (one fixture
per rule S1 to S16, plus stories 1 and 2 as golden files: the sentence counts, about 449 and 513 before review fixes,
may only change when the source Markdown changes). CI gets one extra step, `python3 -m unittest discover scripts/dictation/tests`
(Python 3 is preinstalled on the `ubuntu-latest` runner). The browser never runs the splitter; it only loads its output.

## Speaker attribution and human review

Each sentence has one **primary speaker** (shown as the chip and used for the voice) and optional `segments` when a
sentence mixes narration and a quote. Decision on tags: segments are used, so the dialogue tag
(`fragt Lucía am Telefon`) is read by the narrator and the quote by Lucía. This keeps one typed sentence per audio
file (one file per sentence, segments are joined with an 80 ms crossfade) and sounds natural. Sentences without a
quote are entirely the narrator.

Rules to propose a speaker for a quoted span, strongest first:

1. **Tag after or before the quote** in the same sentence: speech verb list (`sagt, fragt, antwortet, ruft, flüstert,
   meint, erklärt, lacht, schreibt, liest, bittet`, plural forms) plus a name that resolves through the alias table in
   `cast.json` (Nilufar, Nili, Frau Karimi, Lucía, Jonas, Frau Wagner, Monika, Frau Lechner, Herr Steiner, ...).
   Confidence high.
2. **Pronoun tag** (`sagt sie`, `fragt er`): the most recent speaker of that grammatical gender in the previous three
   paragraphs. Confidence medium.
3. **Introduction by the previous narration sentence** whose grammatical subject is a cast member
   (`Frau Wagner hat ein Formular. „Frau Karimi, ...“`). Confidence medium.
4. **Turn taking**: in a run of untagged one-quote paragraphs, alternate between the two most recent distinct
   speakers. Confidence low.
5. Nothing matched: speaker `UNKNOWN` (cannot be published).

**Human review is mandatory.** The script writes `build/dictation/story-NN.speakers.md`: one table per sequence in
reading order (sentence id, text, proposed speaker, rule, confidence), medium and low rows marked. The author
(who knows the story) fixes mistakes in `story-NN.overrides.json`:

```json
{ "speakers": { "s01q1n0007": "WAGNER", "s01q1n0008": { "segments": [["„Hallo!“", "JONAS"], ["sagt Lucía", "NARRATOR"]] } },
  "reviewed": ["s01q1n0001-s01q1n0120"],
  "speech": { "s01q4n0033": "Am neunzehnten Oktober" },
  "protectedWords": ["Lucía"] }
```

Publishing fails while any `UNKNOWN` remains or any medium or low row is not covered by `reviewed`. Overrides always
win over rules. Every cast id used must exist in `cast.json` and in `voices.json` for modes A, B and C (see
`05-audio.md`), otherwise publishing fails.

## Stable sentence ids

Progress must survive text edits, inserted sentences and reordering. Therefore the **id is not the position**.

- `story-NN.ids.json` stores `nextCounter`, and for every sentence ever published: id, text hash, previous
  neighbor id, `retired` flag.
- On every build, per sequence: (1) match sentences whose normalized text is identical, in order (longest common
  subsequence); (2) between two matched anchors with the same number of unmatched old and new sentences, pair them by
  position when text similarity is at least 0.6, so an edited sentence **keeps its id**; (3) any remaining new
  sentence gets `s<story>q<seq>n<counter>` from the counter, and any remaining old sentence is marked `retired`
  (never reused).
- The build prints a summary (`3 edited, 1 added, 0 retired`) to paste into the PR. A changed hash on an existing id
  is exactly the case the app handles (see `09-data-model.md` and edge cases C1 to C8).
- `order` is recomputed each build and is only used for display and for resuming when an id has been retired.

## Word links to vocabulary (supports the Leitner actions)

The learner taps a mistyped word; the app must know which card it means. Resolution is done at **build time** so the
runtime is deterministic and testable.

1. Build a form index from `public/data/wortschatz-daf-kompakt.csv`:
   - Nouns: base without article (`Termin`), plural forms from `Plural` ("die Termine" gives `Termine`; slash
     entries give several), and `inflections.json` additions (genitive `-s`, dative plural `-n`).
   - Verbs: `Infinitiv`, 3rd person present (`Präsens`), 3rd person Präteritum, the Perfekt participle (`Perfekt`),
     plus a **generated present paradigm** (ich, du, er, wir, ihr, sie) from regular endings and the stem-change rule
     taken from the 3rd person form (`fährt` gives `fahre, fährst`), with explicit tables for `sein`, `haben`,
     `werden`, `wissen` and the modal verbs. This is how `heiße` finds `heißen`.
   - Adjectives and adverbs: base plus the endings `-e -en -er -es -em`.
   - Phrases (`ein bisschen`, `Herzlich willkommen`, `Grüß Gott`): matched as multi-token spans before single words.
   - Clitics: `geht’s` expands to `geht` plus `es` for matching only.
2. **Separable verbs.** For verbs with `trennbar` in `Formen` (and prefixes from `scripts/data/verb-splits.json`) find
   the finite verb form and the particle in the same clause (`Sie schaut eine WG an`). Emit **one link group**: two
   `links` entries (`schaut`, `an`) with `kind: 'separable'`, the same `cards`, so tapping either word opens the same
   sheet. In the Perfekt (`hat angerufen`) the participle links to the verb; `hat` links to `haben`.
3. **Duplicates in the catalog** (same word in two lessons): `cards` lists all candidate ids, ordered by lesson not
   higher than the story's last lesson first, then ascending. The runtime picks the first id the user already has,
   otherwise the first in the list (`07-leitner-integration.md`).
4. **Unresolved content words** (not a function word, not a name from `cast.json` or `protectedWords`) are listed in
   the report. They get no link, and the app then offers "add as a new card" with the sentence as example. Target:
   at least 97 percent of content tokens linked; this is a warning, not a failure, because names and rare forms exist.

## TTS text preparation

The answer text stays exact; only the spoken text changes. `tts_text.py` rewrites for speech: ordinals
(`19. Oktober` becomes `neunzehnter Oktober`, case chosen from the preceding preposition: `am 19.` gives
`am neunzehnten`), times (`1:52` becomes `eins zweiundfünfzig` for a race time, `neun Uhr` stays), prices
(`450 Euro` becomes `vierhundertfünfzig Euro`), phone numbers (digits read in groups, `0664 23 59` as
`null sechs sechs vier, dreiundzwanzig, neunundfünfzig`), postal codes (`8020` as `acht null zwei null`),
abbreviations (`Tel.` as `Telefon`). Anything ambiguous is listed and decided in `overrides.speech`. The sentence
carries flag `digits`, and the UI shows the hint "This sentence contains numbers: type them as digits"
(`06-answer-checking.md`, decision on numbers).

## Images

- Source images: 4:3 landscape PNG named `S01-Q1.png` to `S02-Q6.png` (naming from `image-prompts/S01-image-prompts.md`).
  Originals stay out of Git (open question: where to archive them).
- The build converts to WebP 1600x1200 (quality 80) and 800x600, names them `images/S01-Q1.webp` and
  `images/S01-Q1@800.webp`, and `upload_media.py` pushes them to the `story-media` bucket. The sequence JSON stores
  only the key and dimensions (no hard-coded URL; the base URL is one constant).
- Validation fails the publish when a sequence has no image unless `--allow-missing-images` is passed. The app also
  tolerates `image: null` (state 20 in `03-ui-states.md`), so a missing image never blocks the feature.
- Alt text: author-written or generated from the English situation's first sentence, reviewed in the same report,
  stored in both languages.

## Onboarding a new story (content task, no code change)

1. Put `story-NN.md` in the output folder (already true for 3 to 10).
2. Add or update `cast.json` for new characters (and their `voices.json` entries for A, B, C).
3. Add the 6 images to the images folder (`SNN-Q1.png` to `SNN-Q6.png`).
4. Ensure the block's grammar cards exist in `content/dictation/grammar/`.
5. `python3 scripts/dictation/build_story.py NN --report` writes the three review files (speakers, splits, links).
6. Resolve the review, record `reviewed` ranges in `story-NN.overrides.json`.
7. `python3 scripts/dictation/build_story.py NN --publish` writes `public/data/stories/story-NN.json` and updates
   `index.json` and `story-NN.ids.json`.
8. `python3 scripts/dictation/gen_audio.py NN --mode A` and `--mode B` (local, keys from the shell), then
   `upload_media.py NN` (dry run first, then `--target` the project explicitly).
9. Open a PR containing only content files. CI runs `tests/dictationContent.test.ts` (schema, id uniqueness,
   speakers in cast, every sentence has an audio key for modes A and B, every link range valid).
10. Merge, then deploy per `CHECKLIST-deploy.md`. A story appears in the list when its entry is in `index.json`.
