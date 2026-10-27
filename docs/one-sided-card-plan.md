# One-sided card in the new-words session

## Goal
While studying new words to add them to the Leitner box, the learner sees everything on a single side:
the word with its article, meaning, plural, Formen, Perfekt, Austria note and example. No flipping.

## Decisions (from the user)
- **Article guess:** removed in one-sided mode; the article is shown in its colour from the start.
  Article practice stays in the Leitner review.
- **Perfekt:** shown openly (no practice quiz, no masking) in one-sided mode. The Perfekt quiz stays in review.
- **Setting:** one-sided is the default; a switch in Settings brings back the old two-sided card
  (with article guess and Perfekt practice, unchanged).

## Data / database
- New optional key `newWordsFlipCard: boolean` in `AppSettings` (default `false` = one-sided).
- Stored inside the existing `profiles.settings` jsonb like the other settings. No schema change, no migration.
  Existing users have no key, so they get the default (one-sided). Backup import merges with defaults as before.

## Layout (one-sided)
1. Meta row: source · lesson · level · Wortart (no flip indicator, card not clickable).
2. Word with coloured article + pronounce button (speaks the article too) + conjugation button (always enabled).
3. Meaning.
4. Perfekt box (verbs with a Perfekt), plural, Formen, Austria note (all unmasked).
5. Example with pronounce button and translation.
6. Keyboard hints (pointer devices only): Space = pronounce, Enter = add.
7. Actions: Skip / Add to box 0.

## Corner cases
- Long cards on small phones: the action buttons stay reachable (sticky bar at the bottom on mobile,
  with safe-area padding for the home-screen app).
- After Add/Skip from the bottom of a long card, scroll back so the next word's top is visible.
- Auto-speak speaks the full word with article (nothing to spoil any more).
- Nouns without a quiz article (plural-only, custom) show the word as stored.
- Verbs without a Perfekt (e.g. "geboren sein") show no Perfekt box; split verbs (b/c cards) each show their own.
- Setting changes take effect at the next session start (no layout switch mid-card).
- Space in a focused input/button must not trigger shortcuts; the conjugation dialog keeps blocking shortcuts.
- RTL/LTR and dark mode: reuse the existing `De`/`Auto` components and colours.
- Review session is not affected.

## Tasks
- [ ] Add `newWordsFlipCard` to `AppSettings` / defaults
- [ ] Extract the card details into a shared component used by both modes
- [ ] One-sided layout, shortcuts, auto-speak, scroll reset, sticky actions
- [ ] Settings switch (fa/en strings)
- [ ] Type-check, unit tests, build
- [ ] Playwright e2e in demo mode: fa/en, mobile/desktop, noun/verb, setting toggle back to flip mode
- [ ] PR, CI, admin merge, production deploy, live smoke test
