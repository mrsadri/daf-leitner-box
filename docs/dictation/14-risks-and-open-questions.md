# 14. Risks and open questions

## Risks

| # | Risk | Likelihood and impact | Mitigation |
|---|---|---|---|
| R1 | Publishing textbook-derived grammar text (copyright) | Medium likelihood, high impact | Default of own-words cards (`08-grammar-drawer.md`); the gitignored files are never committed; decision in Phase 0 (Open Question 1) |
| R2 | Licence terms of the paid TTS or of Piper voices forbid the intended redistribution | Low to medium, high | Phase 0 reads the terms and keeps a copy; provider adapter allows a switch; generated files are kept forever |
| R3 | Wrong speaker on a sentence (a character with someone else's voice) | High before review, medium after, high visibility | Mandatory human review, confidence labels, overrides win, publish blocked on unreviewed rows |
| R4 | Piper has few German voices, so many characters sound alike in Mode B | High | Pitch and tempo offsets with minimum distances, validator rule, honest description of Mode B in Settings |
| R5 | The cedilla issue or another phoneme is dropped silently | Medium, medium | NFC plus hard failure on unknown phonemes, fixture test, listening check |
| R6 | iOS audio quirks (unlock, silent switch, PWA mode, background) | High, medium | Single reused element unlocked by the Start tap, token guard, watchdog, device matrix |
| R7 | Web Speech variability makes Mode C poor on some devices | High, low (it is a mode, not the default) | Default is A, fallback chain, honest Settings text, chip always names the speaker |
| R8 | Strictness frustrates learners (for example `ss` for `ß`, curly quotes, Persian keyboards) | Medium, medium | Tolerated normalizations for device limits only, ä ö ü ß buttons, categories explain the mistake, free resubmission, skip |
| R9 | Mis-linked word causes a wrong Leitner action (wrong card moved back) | Medium, high for trust | The sheet always shows the matched base form and card state before acting, Undo for 8 seconds, build-time link review, no automatic actions |
| R10 | Inflection coverage gaps: many unlinked words | Medium, low | Coverage report with a 97 percent target, `inflections.json`, custom-card path |
| R11 | Storage egress or size exceeds the plan | Low to medium, medium | Small files (about 20 KB), immutable caching plus Cache API prefetch, usage alarm at 70 percent, Open Question 8 |
| R12 | Illustrations arrive late | Medium, low | Placeholder state is a first-class UI state; the content test allows explicit `null` with a flag |
| R13 | Production database safety (real users) | Low if the process is followed, very high impact | Additive migration only, dev project for all testing, owner applies production SQL from a setup document with before and after counts, never an agent against production |
| R14 | Moving a card back lowers the all-time score, which some users may dislike or avoid using | Medium, low | Documented decision, Open Question 5 |
| R15 | Content scale: each new story needs review time | Certain, medium | Reports concentrate human attention on medium and low confidence rows; estimated one day per story |
| R16 | Beta feedback volume exceeds capacity | Low, low | Hot-sentence list, one feedback channel, kill switch |
| R17 | The new tab or chunk slows the app | Low, low | Lazy-loaded chunk, no new dependency, performance pass in Phase 7 |
| R18 | Service worker caches nothing, so offline use of the tab relies on the Cache API and may disappoint | Medium, low | Stated in the Beta scope; "download story" is a later feature |

## Open questions

Everything that cannot be determined from the repository, with the default this plan uses until the answer arrives.

| # | Question | Default used by this plan | Needed by |
|---|---|---|---|
| 1 | May text from the textbook's grammar pages be published in the app? | **Decided: no.** Own-words German cards, no book text committed (confirmed by the owner 2026-11-15) | Closed |
| 2 | Persian and English grammar explanations? | **Decided: not needed, German grammar is enough.** Cards are German only; only drawer labels are localized | Closed |
| 3 | Illustrations: exact file names and format, and when the 12 images exist | **Accepted:** placeholders until they exist; assumed naming `S01-Q1.png`, 4:3, converted to WebP | Phase 0, Phase 7 |
| 4 | Which German Piper voices exist now and what are their licences? | **Accepted:** settled in the Phase 0 spike; Mode B shares voices across characters with offsets | Phase 0 |
| 5 | Is it acceptable that "move back one compartment" lowers the all-time score (sum of boxes) and writes no review event? Confirm: box 0 stays put (due today) and mastered goes to box 5 | Yes to all, as in the nightly overdue rule | Phase 2 |
| 6 | Persian and English translations of individual sentences do not exist (only situation texts). Do you want them for the card back side or a "show translation" hint? | Not included | After the Beta |
| 7 | Final TTS provider, budget and licence confirmation for Mode A (ElevenLabs recommended, Google as backup); are Austrian-accented voices wanted if available? | ElevenLabs, standard German voices | Phase 0 |
| 8 | Supabase plan limits for Storage size and egress, and does a separate dev Supabase project already exist? | A dev project is created in Phase 0 | Phase 0 |
| 9 | Should spelled-out numbers (`neunzehn`) be accepted in place of digits in a later version? | No in v1 | After the Beta |
| 10 | Should words in skipped sentences be tappable for Leitner actions? (The brief says skipping has no Leitner effect) | No | After the Beta |
| 11 | Should dictation progress be part of the JSON backup in Settings? | No in v1 | After the Beta |
| 12 | Should a finished story be re-practicable (restart or a second run)? | Read-only browse, no retyping | After the Beta |
| 13 | A transcript or "show text on demand" mode for deaf and hard-of-hearing learners? | Not in v1; the text appears after a skip | After the Beta |
| 14 | Is a new `app_flags` table acceptable for the kill switch? | **Approved** by the owner 2026-11-15; table plus build-time constant | Closed |
| 15 | Is a small `dictation_events` table acceptable for Beta monitoring (no text, 60-day pruning)? | **Approved** by the owner 2026-11-15 | Closed |
| 16 | Should the three comprehension questions per sequence (`**Fragen**`, with `Lösungen`) become a feature? | Out of scope; data is parsed but unused | After the Beta |
| 17 | Final wording of the Beta label and the Persian copy (praise messages, hints) | Draft copy written during Phase 5 and reviewed by the owner | Phase 5 |
| 18 | Do special letters beyond ä ö ü ß (á, í, ş, ı for names like Lucía and Ayşe) need buttons? | No; names are rare in the dictation text; typing them is part of the exercise | Phase 5 |
| 19 | Where should audio and image originals be archived (not in Git)? | The local work folder, backed up by the owner | Phase 4 |
| 20 | Should the dictation tab sit in the main navigation next to Review and Catalog, or under the dashboard only? (The Navbar already has seven tabs on desktop) | A new tab, with a dashboard card as the second entry | Phase 5 |
