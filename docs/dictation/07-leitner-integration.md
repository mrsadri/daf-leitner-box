# 07. Leitner integration (manual only)

Hard rules from the brief, repeated because they shape everything here:

1. Typing results **never** change a card automatically.
2. **Skipping has no Leitner effect**, and a skipped sentence offers no Leitner action.
3. The only actions are two buttons, available in the feedback view on a mistyped word: **Add to my box** and
   **Move back one compartment**.

## Which word does a tap mean

The check result contains `expectedTokenIndex` for each word-level mistake (the word the learner should have typed;
the typed garbage is irrelevant). The sentence's precomputed `links` (`04-content-pipeline.md`) map the expected token
to catalog card candidates and a lemma. A mark is **tappable** when:

- the mistake is a word-level one (`case`, `umlaut-substitution`, `eszett-substitution`, `typo-*`, `wrong-word`,
  `missing-word`, `order`), not punctuation, spacing or `extra-word` (nothing to learn from an extra word);
- the expected token is not a proper name that is in `cast.json`/`protectedWords`.

Missing words have no typed text to tap, so the gap marker itself is the tap target.

## Inflected forms versus stored base forms

Cards are keyed by base form (`wort`: "der Termin", "heißen"). The learner mistypes surface forms (`heiße`, `Termine`).
Resolution is done at build time through `links[].cards` and `links[].lemma`:

| Case | Example | Behavior |
|---|---|---|
| Conjugated verb | `heiße` | Link to `heißen` (generated present paradigm). The sheet says "heiße is a form of heißen" |
| Separable verb, split | `schaut ... an` | Both tokens link to `anschauen`; tapping either opens the same sheet; a mistake on `an` counts for the verb |
| Perfekt | `hat angerufen` | Participle links to `anrufen`; `hat` links to `haben` |
| Noun plural | `Termine` | Link to `der Termin`; the sheet shows the plural column |
| Noun with article stored | `Termin` | Matches `der Termin`; the sheet shows the article. The card is never created without the article |
| Phrase | `ein bisschen` | Whole-span link to the phrase card |
| Duplicate catalog entries | `aufstehen` in L03 and L24 | `cards` has both ids; the runtime uses the one the user already has, otherwise the first (lowest lesson not above the story's last lesson) |
| No catalog match | `Wohngemeinschaft` variant, rare form | Offer **Add as a new card** (custom card, `custom_...` id) prefilled in the existing `NewCardModal` (wort, example sentence); the learner may type the meaning |

## Add to my box

Applies when none of the candidate card ids (and no card with the same lowercased `wort`, using the same key set as
`vocabKeys()`) exists in the user's cards.

- Catalog word: `leitnerEngine.addBatchWords([catalogCard])` (existing API): box 0, due today, standard fields.
  Duplicates are impossible because `addBatchWords` and `addCard` already skip existing ids and equal `wort`.
- Non-catalog word: `leitnerEngine.addCard({...})` with `type: 'vocab'`, `wort` = corrected word as stored form
  (article added only when the learner types or selects one; unknown gender is left as `–`), `beispiel` = the story
  sentence in German, `lektion` = story's lesson range text, `feld` = `Geschichte` (new value, free text).
- After adding, `refreshState()` in `App.tsx` runs through the existing callback, an 8-second **Undo** toast calls
  `leitnerEngine.deleteCard(id)` if the card was added by this action and has not been reviewed.

### What the back side of the new card contains

For catalog cards: exactly the normal catalog content (`persisch`, `englisch`, `beispiel`, `formen`, `plural`,
`artikel`), refreshed from the CSV by `withCatalogContent`. In addition, the story sentence is stored as an extra
example field `beispielStory` (new optional field in `data` jsonb, German only), shown under the standard example with
the label "From the story". For non-catalog cards: the word with article if known, the story sentence as the example
with the word in bold, `persisch` and `englisch` as typed by the learner (optional; an empty back side shows the
sentence and a hint to add a meaning), `formen` empty. No Persian translation of the sentence exists in the dataset
(only situation-level translations), so none is shown (Open Question 6).

## Move back one compartment

Applies when the card exists in the user's cards (any box).

Definition: new box = `max(0, box - 1)` (box 6 goes to 5). New due date = the **earliest review of that compartment**,
meaning the date the card would be due in the new compartment counted from the day it entered the current one:

```
entryDay   = local date of card.lastReviewedAt            (if null: today)
newBox     = max(0, box - 1)
interval   = 2 ^ min(5, newBox)                           (same formula as calculateNextReviewDate)
due        = entryDay + interval days
nextReview = max(today, due)                              (never in the past)
```

Check against the owner's example: a word entered the 16-day compartment (box 4) 3 days ago, so `entryDay` is today
minus 3. It moves to box 3 (8 days): `due` = today minus 3 plus 8 = in 5 days. That is "due at the next review of that
compartment". If the card entered box 4 ten days ago, `due` is two days ago and `nextReview` clamps to today.

Edge rules:

- Box 0: stays in box 0, due today (nothing lower exists); the sheet says "already in the first compartment", and
  the button changes to "Review today".
- Mastered (box 6): goes to box 5, `due = entryDay + 32`, clamped to today.
- `lastReviewedAt` stays unchanged (the move is not a review). `reviewCount`, `correctCount` and `wrongCount` do not
  change. **No `review_events` row is written**: the weekly score and streak are unaffected, and the table's
  one-step check and `review_day` trigger are not involved. The all-time score (sum of boxes) drops with the card,
  consistent with the nightly overdue rule that also writes no events (Open Question 5).
- Interaction with the overdue rule: the new `nextReview` is today or later, so `apply_overdue_demotions` (cards three
  or more days overdue) does not touch it.
- Repeated taps: each tap moves one more compartment back and is a separate decision; the sheet shows the card's
  current state live, and the button is disabled for 1 s after each use to prevent accidental double moves. The Undo
  toast restores the previous `box`, `nextReviewDate`, `lastReviewedAt` snapshot saved in memory.
- Implementation: a new engine method `moveBackOne(cardId, today = new Date())` in `leitnerEngine.ts`, delegating to a
  pure function `computeMoveBack(card, today)` in `src/services/dictation/moveBack.ts` (unit-tested), and persisting
  through the existing `persist([card])`, which is also how cards sync to Supabase. This is the only change to the
  engine and it is additive.

## Safety and consistency

- Both actions go through the engine, so the local cache, the sync queue (`cloudSync`) and RLS behave exactly as for
  any other card write. No new table is touched by the Leitner actions.
- Two tabs or devices acting on the same card: last write wins by `updated_at` on `cards` (existing behavior). The
  sheet re-reads the card from the engine when it opens, so it never shows stale state from its own tab.
- Suspended accounts cannot write (RLS), the sync status dot shows the error as for any other write.
- Cards of type `reflection` are never linked, and `shared_` insight cards are never moved by this feature
  (they are `type: 'reflection'`).
- Each use is counted in `story_sentence_progress.leitner_actions` (analytics only, `09-data-model.md`), never used to
  decide anything.
