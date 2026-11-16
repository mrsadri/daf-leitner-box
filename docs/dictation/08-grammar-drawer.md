# 08. Grammar drawer

A collapsible panel on the dictation screen showing the **new grammar points tied to the sentence the learner most
recently entered**, taken from the lesson grammar files.

## Source and the copyright constraint (decision needed in Phase 0)

The grammar files are `DaF-kompakt-work/DaF-kompakt/Grammatik/L01-03_Grammatik.md` to `L28-30_Grammatik.md`
(one per block of three lessons; headings `## Lektion N · Title (A1)` and `### <point>`; tables and bullet lists; bold marks
the book's colored parts). They derive from the textbook, and `.gitignore` excludes the folder from Git on purpose
("Everything derived from or showing the copyrighted textbook stays local"). A public, deployed app would publish them.

Decision recorded in this plan (the owner confirms in Phase 0, Open Question 1):

- The **gitignored files stay a local source of truth for structure only**: point titles, lesson numbers, level and
  the order of points. They are read by `grammar_links.py` on the owner's machine.
- The **committed content is original**: `content/dictation/grammar/block-NN.json`, one short own-words card per
  point (a rule in two or three lines, a mini table written by the owner where a table helps, two example sentences
  taken from the stories themselves, which are original work). The card carries the point's book title and lesson
  as a reference ("DaF kompakt, Lektion 2: Nominativ und Akkusativ"), not the book's text.
- If the owner decides that the book's own tables may be published, only `block-NN.json` content changes; the
  drawer, the ids and the links are identical. The code does not depend on the decision.

## Grammar point ids and cards

- Id: `g-<block>-<lesson>-<slug of the point title>`, for example `g-01-02-nominativ-und-akkusativ-bestimmter-artikel`.
  Generated once from the titles in the local files and then fixed in the committed `block-NN.json`.
- Card schema (illustration):

```ts
interface GrammarCard {
  id: string; block: number; lesson: number; level: 'A1' | 'A2' | 'B1';
  title: string;                                        // German title as in the book
  rule: string;                                         // short own-words explanation in German, 2 to 3 lines
  table?: { head: string[]; rows: string[][] };         // optional, own words; all German, shown dir="ltr"
  examples: string[];                                   // sentence ids from the stories, resolved at render time
  related?: string[];                                   // other grammar ids
}
```

Decision (owner, 2026-11-15): **German grammar is enough.** Cards are German only, with no Persian or English
explanations. Only the drawer's own labels ("Grammar", "New in this story", "Also used here") are localized through
`fa.ts` and `en.ts`. Writing the cards is still a content task per block (short German texts in the owner's words).

## Linking points to sentences

Each sentence has `grammar: string[]` (ids). Produced in two steps, the second one is mandatory:

1. **Candidate detection** (`grammar_links.py`): rule-based detectors on the sentence tokens and its word links.
   Examples for block 1: regular present verbs (finite verb form linked), W-question and yes/no question order (first
   token is a W-word, or the finite verb is first), negation `nicht` and `kein-` forms, definite and indefinite
   articles, accusative objects (`den`, `einen`, `keinen`, masculine accusative), personal pronouns, modal verbs
   (`kann, muss, möchte` plus infinitive at the end), possessive articles, `und` connections. Block 2: vowel-changing
   verbs, `mögen/dürfen/wollen`, Präteritum of `haben/sein`, Perfekt (`hat/ist` plus participle `ge-...-t`),
   `denn/oder/aber`, separable verbs (verb plus particle at the end), imperatives, `Sollen wir`, `Wollen wir`.
2. **Human confirmation** in `story-NN.overrides.json` (`grammar.add`, `grammar.remove`). The report shows, per sequence,
   the candidate points with the sentences that carry them; the author removes false positives and adds missed ones. A
   sentence may have zero points (most do).

"New" means **first occurrence in the story**: the report computes for every point which sentence in the published
story order carries it first; the drawer marks those with a "New in this story" label. Points that were taught in an
earlier block and merely occur again are listed in a second, quieter group "Also used here".

## What the drawer shows

- **Trigger sentence:** the sentence most recently *entered*, meaning the last sentence for which the learner
  submitted an attempt, pressed Next, or skipped. Hearing a sentence is not entering it, and replaying history does
  not change the drawer. Until the first submission in the session the drawer shows the sequence's points (the union
  of the sentence points in the sequence, "New in this sequence") so it is not empty.
- Content: the sentence text with the linked parts, then the cards for its points (title, rule, table), then the group
  "Also used here". If the sentence has no points: "No new grammar in this sentence" with the sequence list under it.
- Switching to a new trigger sentence never moves keyboard focus and never scrolls the page; the drawer content
  updates in place and the update is announced politely ("Grammar updated for the last sentence").
- Tapping a point expands its table inside the drawer. A link on each card opens the same lesson's grammar in the
  future, not in v1.

## Open, collapsed, and persistence

- Two ways to control it: the toggle button on the dictation screen (always visible) and a setting
  **Grammar drawer: keep open** in Settings, Dictation section.
- Stored as `dictationGrammarOpen: boolean` in `profiles.settings` (optional, synced) and mirrored in the local
  settings cache like every other setting, so it persists across reloads and devices. Unset means the viewport
  default: open at 1024 px and above, collapsed below. After a learner toggles it once, their choice wins on every
  device.
- Toggling updates the setting immediately (`handleUpdateSettings`), which uses the existing debounced sync.
- On phones the drawer is a bottom sheet; "keep open" on a phone means the sheet starts as a collapsed peek bar
  (title and chip with the number of points) that never covers the input; the full sheet opens on tap. While the
  on-screen keyboard is up the sheet is suppressed to the peek bar.
- Desktop: a 320 px side column, collapsible with an animation that respects `prefers-reduced-motion`.

## Rendering and safety

Cards are structured JSON rendered by React components (no `dangerouslySetInnerHTML`, no Markdown parser in the client).
All card content is German (`dir="ltr" lang="de"`); only the drawer's labels follow the interface direction.
Missing card (id with no card): skipped silently in production and caught by the content validation test in CI.

## As built (Phase 6)

- Cards live in `content/dictation/grammar/block-NN.json` (own words, German only, fixed ids). `build_story.py` writes
  `public/data/stories/story-NN.grammar.json` with the cards the story uses (examples resolved to text) and `first`
  (the first sentence of the story that carries each point).
- Detectors (`scripts/dictation/lib/grammar.py`) are conservative. Very common points (plain present, articles, subject
  order, "und") have the scope `sequence`: they are attached only to the first sentence of each sequence that carries
  them. Everything else is attached to every sentence that carries it. A story only gets points up to its own block.
- Human confirmation: `story-NN.overrides.json` has `grammar.add`, `grammar.remove` (sentence id to point ids) and
  `grammar.reviewed`; the story JSON carries `grammarReviewed`.
- Groups: "New in this story" (the card's block equals the story's block) and "Also used here" (earlier blocks). A card
  whose point first occurs in the trigger sentence shows "First time in this story".
- Wide screens (1024 px and up): 320 px column, toggle button always visible; setting `dictationGrammarOpen` (unset means
  open). Narrower: a peek bar in the page flow below the input (never covers it) opens a bottom sheet; the sheet closes
  while the on-screen keyboard is up.
