# 06. Answer checking

All checking runs in the browser, in pure functions in `src/services/dictation/` (`normalize.ts`, `compare.ts`,
`submitTrigger.ts`), unit-tested with `node --test` like the other services. No network is needed.

## Rules (decided by the owner, applied strictly)

A sentence is **correct** only when, after the tolerated normalizations below, the typed text equals the expected text
exactly. Everything else is a mistake, including small typos. Mistake categories only decide how a mistake is shown.

| Rule | Behavior |
|---|---|
| Wrong, missing or extra letters | Mistake (typo categories below) |
| Capitalization | Case-sensitive everywhere: nouns, sentence start, names. `termin` for `Termin` is a mistake |
| Commas and other punctuation | Mistakes: missing, extra or wrong mark. Includes `. ! ? : ; …` and commas |
| `ae`, `oe`, `ue` for `ä`, `ö`, `ü`; `ss` for `ß` | Mistakes with their own category (`umlaut-substitution`, `eszett-substitution`) so the message can say "write ä, not ae". Unicode decompositions (`a` + U+0308) are normalized first, so they are never a mistake |
| Numbers | The expected text uses digits; the learner types digits (the UI hint on `digits` sentences says so). Spelled-out numbers are a mistake in v1 |

## Tolerated normalizations (never mistakes)

These exist because phone keyboards cannot always type the exact glyph. They apply to both sides before comparing.

| Normalization | Detail |
|---|---|
| Unicode | NFC; NBSP and narrow NBSP to space |
| Whitespace | Trim; any run of spaces to one space; line breaks to space |
| Double quotes | `„ “ ” " « »` all compare equal at the position of a quote mark (the position and count still matter: a missing quote is a mistake) |
| Single quotes and apostrophes | `‚ ‘ ’ ' ʼ ` compare equal |
| Dashes | Hyphen, en dash and em dash compare equal |
| Ellipsis | `...` and `…` compare equal |

Spacing around punctuation is checked after tokenization: a space before `, . ! ? : ;` or a missing space after a comma
is the category `spacing` and **is** a mistake (it is not a typing-device limitation).

## Tokenization

Tokens are words (letters, digits, and internal `’ -` such as `geht’s`, `E-Mail`), and single punctuation marks.
Decimals and times are one token (`1:52`, `3,5`, `0664`). Each token keeps its character offsets in the typed text so
highlights can be drawn exactly.

## Algorithm

1. **Normalize** both strings (above). Produce `typedTokens`, `expectedTokens`.
2. **Word-level alignment.** Dynamic programming (Needleman-Wunsch style) over tokens. Costs: match 0 (exact token
   equality after quote/dash folding), substitution = `0.4 + 0.6 * charDistanceRatio` where the ratio is the
   Damerau-Levenshtein distance divided by the longer length (so near-misses pair up instead of becoming a delete plus
   an insert), insertion 1, deletion 1, and a **transposition rule**: two adjacent tokens swapped scores as two
   `order` marks rather than four edits. Ties prefer matching words before punctuation.
3. **Classify each aligned pair** (first matching category wins):
   `case` (equal ignoring case), `umlaut-substitution` (equal after replacing `ae/oe/ue` with `ä/ö/ü` on the typed
   side), `eszett-substitution` (equal after `ss` to `ß`), `punctuation` (a punctuation token that differs, is missing
   or extra), `spacing`, `typo-missing-letter`, `typo-extra-letter`, `typo-wrong-letter`, `typo-swapped-letters`
   (Damerau transposition), `wrong-word` (distance ratio above 0.5, treated as a different word), `missing-word`,
   `extra-word`, `order`.
4. **Character-level diff** inside every substituted pair, an LCS or Myers diff on code points, giving the exact
   positions of wrong, missing and extra characters.
5. **Result object** (illustration only):

```ts
interface CheckResult {
  correct: boolean;
  marks: Mark[];                       // empty when correct
  summary: { total: number; byCategory: Record<Category, number> };
}
interface Mark {
  category: Category;
  typed: { start: number; end: number } | null;      // offsets in the typed text; null for a missing item
  gapAfter?: number;                                   // typed offset where something is missing
  expectedTokenIndex: number | null;                   // for the word link (07-leitner-integration.md)
  chars?: { kind: 'wrong' | 'extra' | 'missing'; at: number }[];
}
```

## How mistakes are displayed

- The learner's own text stays in the input area (editable); a read-only rendering of it with `<mark>` ranges appears
  directly above the input after a submission and updates with every edit (cleared when the text changes).
- Each category has a style that does not rely on color alone: wrong or extra word, red with a solid underline; wrong
  letter(s), the specific characters in a red box; **missing** letter or word or punctuation, a small gap marker
  (`⌃`) at the place; capitalization, an orange dotted underline; punctuation, a blue wavy underline; order, a purple
  double underline across the swapped words; spacing, a gray dotted marker on the space.
- The display **never prints the correct letters or words** (the learner must find them); it shows where and what kind.
  The correct word appears only in the Leitner word sheet the learner opens on purpose, after a skip, or after Next.
- A one-line summary: "2 mistakes: capitalization, missing comma". Counts use `num()` for the interface digits.
- Praise: a pool of at least 8 short messages per language in `fa.ts` and `en.ts` (`dictation.praise[]`), chosen at random
  but never the same as the last one. Praise appears only on an exact match.
- Attempts are never shown as a counter and never penalize (no score, no leaderboard effect).

## Submission trigger

Auto-submit fires on the keystroke that inserts a terminal mark. Conditions (all must hold):

1. The input event is an insertion (`inputType` starts with `insert`) whose inserted text ends with `.`, `!`, `?` or
   `…` (also `...`: the third consecutive dot), **or** with a double-quote glyph that directly follows a terminal mark
   (the closing quote of a sentence such as `„Danke!“`).
2. The caret is at the end of the text (editing in the middle never submits).
3. **Quote balance equals the expected sentence's own balance.** Count double-quote glyphs (`„ “ ” " « »`) in the
   typed text: with `q = count`, the typed state is "balanced" when `q % 2 == expectedBalanceParity`, where the expected
   parity comes from `quoteBalance` (0 for sentences whose quotes close; 1 for the first half of a split quote, S5 in
   `04-content-pipeline.md`). For `„Wie geht’s?“, fragt Lucía.` typing the `?` inside the quote does **not** submit
   (open quote); the final `.` does. For a sentence that ends `?“` the learner types `?` (no submit, quote open) and
   then `“` (the closing quote right after a terminal mark with balance reached submits). Apostrophes and `‚ ‘` are not
   counted.
4. The mark is not a non-terminal one by structure: a `.` directly after digits (ordinal, S9) or after a known
   abbreviation (`abbreviations.json`, shipped as `abbreviations` in the story index) does not trigger, unless the
   expected sentence itself ends there (`endsDigitDot`), in which case the button and `Enter` are the way (the hint
   says so).

Always available: the **Check** button and `Enter` submit regardless of the trigger. The trigger is a convenience,
not a rule, and a false trigger is harmless because resubmitting is free. If the typed text is empty or whitespace
only, nothing is submitted (Check stays disabled and no attempt is recorded).

For sentences ending in `?` or `!`: the trigger is the same keystroke rule; the `endMark` field is only used for the
hint text and for tests. For `…` endings the trigger accepts `…` or the third dot; a single `.` typed where `…` is
expected submits and is reported as a `punctuation` mistake (resubmission is free).

## Input element settings

`<textarea autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="send"
inputmode="text" lang="de" dir="ltr">`. `lang="de"` makes keyboards offer German layouts where they respect it.
`autocapitalize="off"` is deliberate: the learner must capitalize nouns and sentence starts themselves. iOS smart
punctuation (curly quotes) and the double-space period shortcut are device settings that these attributes do not
fully switch off: curly quotes are tolerated by the normalization above; the shortcut is harmless (false trigger,
free resubmit). Paste is allowed (it is the learner's text) but is normalized and never auto-submits; see edge cases
for IME composition (`compositionstart` and `compositionend` suspend the trigger and the comparison).

## ä ö ü ß buttons

A row under the input: `ä ö ü ß`, with a shift toggle to `Ä Ö Ü` (ẞ is not offered; `ß` has no regular uppercase).
Each button is a `type="button"` with `onMouseDown`/`onPointerDown` `preventDefault()` so the textarea keeps focus and
the keyboard stays open on mobile. It inserts at the selection (`setRangeText` then restores the caret and fires an
`input` event so React state and the trigger logic see it), replacing a selection if there is one. The buttons have
accessible names ("Insert ä"), are 44 px targets, and the order is fixed left to right in both text directions.
Physical keyboard shortcuts for German layouts continue to work; the buttons are an addition, not a replacement.
