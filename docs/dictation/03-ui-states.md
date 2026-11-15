# 03. UI states

Principles: one primary action per state; German text always `dir="ltr" lang="de"` inside the RTL UI; touch targets
at least 44 px; the same component tree on mobile and desktop with a different arrangement (equal support, no
"desktop only" or "mobile only" capability); no color-only signals; Beta badge visible on the tab, on the story list
header and in the dictation header.

## Components (new, under `src/components/dictation/`)

`DictationHome` (story list), `StoryDetail`, `SequenceScreen`, `SentenceStage` (player, speaker chip, input, feedback),
`UmlautBar`, `HistoryList`, `FeedbackText` (diff rendering), `WordSheet` (Leitner actions), `GrammarDrawer`,
`SequenceSummary`, `AudioModeSettings` (used inside `SettingsBackupModal.tsx`), `BetaBadge`.
Logic modules (pure, unit-tested, under `src/services/dictation/`): `normalize.ts`, `compare.ts`, `submitTrigger.ts`,
`wordLink.ts`, `moveBack.ts`, `voiceMap.ts`, `fallback.ts`, `progressMerge.ts`.

## Screen states

| # | Screen or state | What is shown | Primary action | Notes |
|---|---|---|---|---|
| 1 | Loading story index | Skeleton cards | none | Timeout 8 s, then state 2 |
| 2 | Load error | Message, Retry | Retry | Offline variant mentions the connection |
| 3 | Story list (empty) | "No stories yet" | none | Only if index is empty or flag hides all |
| 4 | Story list | Cards with progress | Continue / Open | Beta badge |
| 5 | Story detail | 6 sequence tiles | Open sequence | Tile shows thumb, title, `done/total` |
| 6 | Sequence intro | Illustration, situation text, Start/Continue | Start | Illustration missing: neutral placeholder with the sequence title (state 20) |
| 7 | Audio unlock needed | Start button doubles as unlock | Start | iOS and Chrome autoplay policy |
| 8 | Playing | Speaker chip pulses, waveform icon, Replay disabled for 150 ms | none | Input already focusable |
| 9 | Typing, empty | Placeholder "Type what you hear", umlaut bar, Check disabled | type | Next disabled, Skip enabled |
| 10 | Typing, has text | Check enabled | Check or terminal mark | Live character count is not shown (it would leak length) |
| 11 | Submitted, correct | Success style, praise, Next focused | Next | Praise announced via `aria-live="polite"` |
| 12 | Submitted, mistakes | Highlights, summary line, still editable | Edit and resubmit | Tapping a highlight opens the word sheet when the word is linkable |
| 13 | Resubmitted | Same as 11 or 12; attempt counter increments silently | | No visible attempt counter (no penalty) |
| 14 | Skipped | Correct sentence appended with skip glyph, next sentence plays | none | |
| 15 | Audio failed, fell back | Note "Using the device voice" with Retry | Retry | Auto-dismiss on next successful play |
| 16 | Audio failed, nothing works | Message "No audio available on this device or connection" with Retry and a link to Settings | Retry | The input stays enabled. After the third failed attempt the message adds "You can skip this sentence", which is the normal skip (edge case A14) |
| 17 | Sequence end | Summary and next actions | Next sequence | |
| 18 | Story end | Congratulation, stats, link to the next story if published | Open next story | |
| 19 | Paused by kill switch | Maintenance message | none | |
| 20 | Missing illustration | Placeholder panel (aspect 4:3) with title and a muted icon | | Alt text still announced |
| 21 | Word sheet | Correct word, card state, actions, Undo toast after action | Add / Move back | Focus trapped, `Escape` closes |
| 22 | Grammar drawer open or closed | See `08-grammar-drawer.md` | Toggle | Persisted preference |
| 23 | Settings, Dictation section | Mode radios, Test, speed, drawer default | | Inside `SettingsBackupModal.tsx` |
| 24 | Sync state | Existing Navbar sync dot | | Offline queue |

## Layout

- **Desktop (>= 1024 px):** two columns. Main column: illustration (4:3, max 480 px wide), history, stage. Side
  column (320 px): grammar drawer (open by default unless the learner chose otherwise). RTL mirrors the columns.
- **Tablet (640 to 1023 px):** one column, illustration at the top, drawer as a collapsible card under the stage.
- **Phone (< 640 px):** illustration collapses to a 16:9 crop after the first sentence is typed (the visible
  keyboard otherwise hides the stage); the drawer is a bottom sheet opened by a handle button, never auto-opening
  while the keyboard is up. Umlaut bar sits directly above the keyboard, sticky inside the stage container.
  `visualViewport` resize events keep the stage visible. The visual bible asks images to keep faces away from the
  edges because of cropping, so `object-fit: cover` with `object-position: center` is safe.

## RTL and bidirectional text

- The page direction follows the interface language. The sentence history, the input and the feedback text are
  German and therefore `dir="ltr"` and left-aligned in both interface directions. Decision: one alignment for all
  German text, because mixed alignment between history and input looks broken.
- Speaker chips and labels are translated and follow the page direction; the German speaker name inside a chip keeps
  `dir="ltr"` with `unicode-bidi: isolate`.
- Punctuation at the end of a German sentence inside an RTL parent must not jump to the left edge: the isolated
  `dir="ltr"` wrapper guarantees it. Test with Persian UI and with a sentence ending in `?`.
- The ä ö ü ß buttons keep a fixed left-to-right order in both directions (they are letters, not controls that
  should be mirrored). The Next/Back arrows use `rtl:-scale-x-100` like other components.
- Digits in the UI follow `num()` (Persian digits in Persian mode); digits inside German text never get localized
  (the dictated text uses ASCII digits, and the learner types ASCII digits).

## Accessibility

- The input is a labelled `<textarea>` (`aria-label` "Type the sentence you hear"), `rows=2`, auto-grows.
- Feedback is available as text as well as color: each mistake is listed as "Word 3, written 'termin': capitalization".
  Decision: the inline highlighted text is the only DOM representation; each mark is a `<mark>` with an `aria-label`
  carrying the category and a visually hidden prefix, so screen readers read the sentence with the mistakes
  announced in place, and no duplicate list is rendered. Mistake categories are also shown as a short text chip
  list under the input (visible to everyone).
- Praise and error summary are in a single `aria-live="polite"` region; replay state changes are announced
  ("Playing", "Stopped") through the same region, throttled to one message per 500 ms.
- Keyboard only: Tab order is Replay, input, umlaut buttons, Check, Skip, Next, grammar toggle; `Ctrl/Cmd+Enter`
  replays; `Escape` closes sheets; history items are buttons reachable by Tab (`role="button"`, Enter and Space
  replay).
- Captions: because the exercise hides the text by design, "captions" means the speaker label and, after a
  submission or skip, the text. A setting-free alternative for deaf and hard-of-hearing users is the sentence
  reveal after a skip; a dedicated "transcript mode" is out of scope for v1 (listed in open questions).
- Reduced motion: no pulsing animation when `prefers-reduced-motion`; use a static speaker icon.
- Contrast: highlight colors meet WCAG AA against both light and dark backgrounds, and every highlight also has an
  underline style (wavy, solid, dotted) per category.
