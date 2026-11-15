# 10. Edge and corner case catalogue

Each row: id, case, expected behavior. Ids are referenced from other documents (for example A14, A19 to A22, C1 to C8).
General principles that resolve anything not listed: (1) submission is never destructive and never penalized;
(2) audio problems never block progress (a plain skip is always available); (3) progress writes are idempotent and
monotonic; (4) the Leitner box changes only through the two explicit buttons; (5) an error in the dictation feature
never breaks the rest of the app (error boundary around the tab).

## A. Audio, autoplay, playback

| Id | Case | Expected behavior |
|---|---|---|
| A1 | iOS Safari blocks the first `play()` because it did not come from a gesture | The only entry to a sequence is the Start/Continue button; its tap creates and unlocks the single `HTMLAudioElement` (plays a silent 50 ms buffer) and starts the first sentence. Nothing plays before a tap |
| A2 | Chrome autoplay policy blocks `play()` after a long idle or on a restored tab | `play()` rejects with `NotAllowedError`; the stage shows "Tap to play" on the Replay button (state 7), no error toast. The next tap works and unlocks again |
| A3 | Autoplay of the next sentence after Next or Skip | Allowed because the preceding tap or key press is a gesture; if the browser still refuses, A2 applies |
| A4 | Page returns from background on iOS and audio is suspended | On `visibilitychange` visible, if a sentence was playing, stop and show Replay; never auto-resume mid-sentence |
| A5 | Phone call, Siri or another app takes the audio session | Playback `pause`/`error` events end the playback cleanly; Replay restarts the sentence from the beginning |
| A6 | Bluetooth headset connects or disconnects mid-sentence | Treated as A5; no state corruption, Replay available |
| A7 | Device ringer switch is silent (iOS) | Document in the manual matrix: HTMLAudio (Modes A, B) must play; Web Speech (Mode C) may be muted. If a sentence plays with no audible output the learner can switch mode; the Test button in Settings lets them check. No detection is attempted |
| A8 | Volume is zero or muted | Not detectable; the Replay and Test buttons are the remedy; first-run tip mentions headphones and volume |
| A9 | Audio element ends but `ended` never fires (rare WebKit bug) | A watchdog timer (duration from index `ms` plus 1.5 s) marks the sentence as finished playing |
| A10 | `play()` promise pending when the user presses Replay again | Token guard (`05-audio.md`): the old callbacks are ignored, the old audio is paused, the new playback starts |
| A11 | Audio file decodes but is silent or truncated | Index `ms` is compared with the real `duration` on `loadedmetadata`; a difference over 30 percent counts as a failure and the fallback chain runs; counted in `console.warn` and the beta feedback counters |
| A12 | MP3 not supported | Not expected on current browsers; treated as decode error (chain continues) |
| A13 | Autoplay setting off (setting `autoSpeak` exists for words) | Dictation always autoplays the sentence after a gesture, because dictation is meaningless without it; the existing `autoSpeak` setting does not apply to this feature and is not shown there |
| A14 | The whole fallback chain fails for a sentence (no file, offline, no device voice) | State 16: message, Retry; after the third failed attempt the message adds "You can skip this sentence"; the skip is a normal skip (`skipped`, no Leitner effect). Nothing is marked as a learner mistake |
| A15 | Rapid repeated clicks on Replay | 150 ms debounce plus the token; at most one playback at any time; no queue builds up |
| A16 | Replay pressed while a history sentence is playing | The history playback stops, the current sentence plays; same token |
| A17 | History sentence clicked while the current sentence plays | Stops the current playback and plays the history sentence; the typed draft is untouched |
| A18 | Two characters speak in segments of one sentence and the user presses Next mid-way | Token invalidates the remaining segments; the next sentence starts cleanly |
| A19 | Browser ignores `pitch` in Web Speech (Safari partially, Firefox often) | Characters sharing a voice sound alike; the speaker chip still names the speaker; no error. Manual matrix records which browsers honor pitch |
| A20 | Chrome desktop network voices cut off after about 15 seconds | Sentences average 5.6 words and the longest is 33 words, far below the limit; the watchdog (A9) covers any exception; no keep-alive hack |
| A21 | `speechSynthesis.getVoices()` is empty at start (Chrome, Safari, Android) | Reuse the existing wait of up to 1.5 s plus the `voiceschanged` listener; if still empty Mode C is unavailable and the chain continues |
| A22 | `speak()` right after `cancel()` is swallowed (Chrome and Safari race) | `storySpeaker` yields one macrotask (about 50 ms) between `cancel()` and `speak()`; on `onerror` with `interrupted` it does nothing (expected), on other errors it runs the chain |
| A23 | Device has no German voice | Mode C unavailable: Settings shows a notice and the Mode C radio stays selectable but is flagged; with C selected the chain goes to A, B |
| A24 | German voice list changes (user installs a voice) | `voiceschanged` recomputes the map only if a mapped voice vanished; otherwise the map stays (consistency) |
| A25 | Android WebView or in-app browser without Web Speech | `speechSynthesis` missing: Mode C unavailable, A and B work |
| A26 | Cache API unavailable or quota exceeded (private mode) | Prefetch is skipped silently; playback streams from the network each time |
| A27 | Cached audio for a key the index no longer references | Ignored and evicted by the LRU; never played |
| A28 | Piper or provider sentence with leading or trailing silence | Pipeline trims and pads; QA checks duration bounds (`05-audio.md`) |
| A29 | Mode switched mid-sentence in Settings | Applies to the next playback; the current one finishes or is stopped when the user leaves Settings |
| A30 | Speech speed changed while playing | Applies at the next playback; no live change |

## N. Network

| Id | Case | Expected behavior |
|---|---|---|
| N1 | Connection lost while the sentence audio loads | One retry after 500 ms, then the chain; if all sources fail, A14 |
| N2 | Connection lost while typing | Nothing is affected: checking is local; progress queues |
| N3 | Connection lost between submit and the progress save | The row stays in the persisted queue and syncs on `online`/next flush; UI shows the existing sync dot as offline |
| N4 | Story JSON not cached and the network is down at open | State 2 with Retry; if the JSON was loaded earlier in the session it stays in memory |
| N5 | Very slow network (audio over 8 s) | Timeout, then the chain; slow audio never blocks typing |
| N6 | Network returns after a long offline session with many queued rows | Flushed in batches of up to 500 rows; failure of one batch keeps the rest queued |
| N7 | Server rejects the save (RLS, suspended account) | Retry with backoff like `cloudSync`; the suspended case is handled by the existing presence check (SuspendedScreen) |
| N8 | Storage returns 404 for a key (upload forgotten) | Chain continues to the next source; the 404 is logged once per key per session for the beta report |
| N9 | Storage CORS blocks fetch into the Cache API | The player falls back to streaming through `audio.src` without caching; a CORS test is part of the deploy checklist |
| N10 | Supabase or Storage outage | Same as N1 and N3; Mode C keeps working offline |

## K. Keyboards and text input

| Id | Case | Expected behavior |
|---|---|---|
| K1 | iOS or Android autocorrect changes a word | The textarea sets `autocorrect="off" autocapitalize="off" spellcheck="false"`; where a keyboard still corrects, the corrected text is what is checked (the learner sees it and can fix it) |
| K2 | Keyboard auto-capitalizes the first letter | Capitalization is a rule anyway; the first letter of a sentence must be uppercase, so this helps; with `autocapitalize="off"` it does not happen |
| K3 | iOS smart punctuation turns `"` into curly quotes and `...` into `…` | Quote and ellipsis normalization make these equal (`06-answer-checking.md`); no mistake |
| K4 | iOS double-space-to-period | May insert `. ` and trigger an early submit; harmless: the mismatch shows, the learner edits and resubmits. Not prevented |
| K5 | Smart dashes (`--` to `–`) | Dash folding; no mistake |
| K6 | Learner uses a non-German keyboard layout (English, Persian) | The ä ö ü ß buttons insert the characters; typing `ae` instead of `ä` is the `umlaut-substitution` mistake by rule. Persian keyboard letters give `wrong-word` marks; no special handling |
| K7 | Physical German keyboard on desktop | Works unchanged; the buttons stay available |
| K8 | macOS dead keys and Option shortcuts produce decomposed characters (a + U+0308) | NFC normalization before comparing; no mistake |
| K9 | Uppercase `ẞ` (U+1E9E) typed | Treated as a different character from `ß`; a mistake (the text never contains it) |
| K10 | Virtual keyboard covers the stage on phones | `visualViewport` resize keeps the input and umlaut bar above the keyboard (sticky); illustration collapses (03-ui-states) |
| K11 | Umlaut button tapped while the keyboard is closed | The button focuses the textarea first (keyboard opens) and then inserts at the last known caret |
| K12 | Selection replaced by an umlaut button | The selection is replaced; the caret ends after the inserted character |
| K13 | Voice dictation typed by the OS (speech to text) | Treated as normal text input; allowed; the check is the same (the learner chose it) |
| K14 | Learner presses Enter in the textarea | Submits (like Check); `Shift+Enter` does nothing; no newline ever enters the text |
| K15 | Browser spellcheck underlines | Disabled via `spellcheck="false"` |
| K16 | Password managers or autofill try to fill the field | `autocomplete="off"` and a non-credential name; no fill |
| K17 | Learner types digits with a different numeric keyboard layout | Same ASCII digits; Persian or Arabic-Indic digits (`۱۲`) are typed as different characters and are a mistake; a hint on `digits` sentences says "type digits 0 to 9" |
| K18 | Trailing space after the final period | Trimmed by normalization; no mistake |
| K19 | Space before a punctuation mark | `spacing` mistake (rule) |
| K20 | Very fast typists trigger the submit while the previous check is rendering | Checks are synchronous and cheap (under 1 ms for 33 words); the latest input always wins |

## I. IME, composition, paste

| Id | Case | Expected behavior |
|---|---|---|
| I1 | IME composition active (CJK or Persian IME, Android Gboard word composition) | `compositionstart` suspends the trigger and the live evaluation; `compositionend` resumes. No submit mid-composition |
| I2 | Paste into the input | Allowed (it is the learner's text); normalized for display; never auto-submits; if the pasted text equals the expected text it is accepted when Check is pressed like any text (no anti-cheat measures: this is a self-study tool) |
| I3 | Paste with line breaks or tabs | Replaced by single spaces |
| I4 | Paste of very long text (over 2,000 characters) | Truncated at 1,000 characters with a short notice; checking stays fast |
| I5 | Drag and drop of text into the input | Same as paste |
| I6 | Undo and redo (`Ctrl+Z`) | Native browser undo is left alone; the draft debounce records the final text; after an undo the previous feedback is cleared |
| I7 | Emoji or non-BMP characters | Compared by code point; shown as wrong characters; no crash |
| I8 | Right-to-left characters typed into the LTR input | Rendered inside the LTR box (`dir="ltr"`, `unicode-bidi: isolate`); counted as wrong characters |
| I9 | Text autofill from keyboard suggestions (Android suggestion strip) | A tapped suggestion inserts a word and a space; checked as typed; `autocorrect="off"` reduces suggestions on iOS |

## E. Empty and degenerate submissions

| Id | Case | Expected behavior |
|---|---|---|
| E1 | Check pressed with empty text | Check is disabled when the trimmed text is empty; Enter does nothing; no attempt is recorded |
| E2 | Whitespace-only text | Same as E1 |
| E3 | Only a terminal mark typed (for example `.`) | Auto-submits (caret at end, balanced); the result is a normal mismatch with many missing words; recorded as an attempt. This is a deliberate tap on submit; fine |
| E4 | Next pressed before any submission | Disabled; the learner uses Skip if stuck |
| E5 | Skip pressed repeatedly | Debounced; only the current sentence is skipped once; the next sentence starts and Skip works on it |
| E6 | Check pressed again with unchanged text | Recorded as another attempt with the same result (attempts count is analytics only) |
| E7 | Sentence with only one word (`Danke!`) | Normal flow; the trigger is the `!` |
| E8 | All words correct but the final mark is missing | Not auto-submitted (no terminal mark typed); Check or Enter submits and reports a missing `punctuation` mark |

## Q. Quotes, numbers, punctuation, long sentences

| Id | Case | Expected behavior |
|---|---|---|
| Q1 | Sentence starts with a quote and ends with a tag (`„Wie geht’s?“, fragt Lucía.`) | One sentence; the inner `?` does not submit (open quote); the final `.` does |
| Q2 | Sentence ends with a closing quote after a mark (`„Danke!“`) | The `!` does not submit while the quote is open; the closing quote right after the mark does |
| Q3 | Learner omits the opening quote | The `?` then submits early (balance already equal); the result shows a missing quote mark; the learner can still type the rest and resubmit |
| Q4 | Learner types straight quotes `"` instead of `„ “` | Equal after folding; no mistake |
| Q5 | Nested single quotes `‚…‘` | Folded with `’ '`; counts not used by the trigger; a missing one is a `punctuation` mistake |
| Q6 | Dates with ordinal dots (`19. Oktober`) | The period after digits does not trigger a submit; a mid-sentence period never ends the sentence |
| Q7 | Sentence ending in digits plus period (`endsDigitDot`) | The auto trigger is off for that period; hint under the input says to press Enter or Check; the sentence works normally otherwise |
| Q8 | Times (`1:52`), decimals (`3,5`), thousands (`1.000`), phone numbers (`0664 23 59`) | One token each; compared exactly (spacing included); the number hint chip shows |
| Q9 | Audio says a spelled-out number but the text has digits | The pipeline `speech` field is reviewed so audio and digits agree; the learner types digits (v1), spelled-out is a mistake; stated on the hint chip |
| Q10 | Abbreviations (`Tel.`) | The period does not trigger; compared as written |
| Q11 | Ellipsis typed as `...` or `…` | Equal after folding; the trigger fires on `…` or the third dot |
| Q12 | A single `.` typed where `…` is expected | Submits, reported as `punctuation`; resubmission free |
| Q13 | Hyphenated words and `E-Mail` | One token; hyphen folding applies only to dash characters, not to a missing hyphen (`EMail` is a typo) |
| Q14 | Names with accents (`Lucía`, `Ayşe`, `Yıldız`) | Compared by code point after NFC; typing `Lucia` is a wrong-letter mistake. A button row for special letters beyond ä ö ü ß is out of scope (Open Question 18) |
| Q15 | Very long sentence (up to 33 words in stories 1 and 2) | Plays as one audio file; the textarea grows; the diff stays under a millisecond; the Replay speed can be lowered in Settings; no splitting |
| Q16 | A quote spanning two sentences (S5 split) | The first part has an unclosed quote; its own `quoteBalance` makes the trigger fire at its terminal mark despite the open quote |
| Q17 | Sentence with parentheses | Folded as plain punctuation; compared exactly |
| Q18 | Capitalization of `Sie` (polite) versus `sie` | Exact case required; the `case` mark is shown |

## S. Sessions, devices, tabs

| Id | Case | Expected behavior |
|---|---|---|
| S1 | Same user continues on a second device | Rows load on start; the frontier is computed from them; the learner resumes at the first unfinished sentence; drafts do not transfer |
| S2 | Two devices progress the same story at the same time | Merge keeps the highest status and the highest counters; the frontier is the first sentence not finished in the merged view; no data loss of finished sentences |
| S3 | Two tabs open on the same device | Each loads rows at start; a `storage` event on the queue key refreshes the other tab's local state (same as `cloudSync` caches); at worst a sentence is shown as new in one tab and finished in the other, and finishing it again just merges |
| S4 | User signs out and another signs in on the same device | `dictationSync` state is keyed by user id and cleared on sign out (like `resetSharedState`); drafts and queues are per uid |
| S5 | Account suspended mid-session | RLS rejects writes; the existing presence check shows the suspension screen; queued rows stay local |
| S6 | Browser back button pressed | Leaves the app's current state like the rest of the app (no router); the dictation screen keeps its state in memory and the draft is saved, so reopening the tab continues where the learner was |
| S7 | Page reload mid-sentence | Reopens the sequence at the frontier; the draft for that sentence is restored if the hash matches; audio restarts only after a tap (A1) |
| S8 | Opening a sequence later than the frontier (free navigation) | Allowed; progress rows are per sentence; the story frontier is unchanged unless the earlier sentences are finished |
| S9 | Learner opens a sequence and finishes sentences out of order | Allowed; history shows finished ones in story order; the next sentence offered is the first unfinished one in that sequence |
| S10 | Story completed, learner opens it again | Read-only browse: sentences listed, replay works, no retyping in v1 (Open Question 12) |
| S11 | Local clock far from server time | Progress rows use server `now()`; the Leitner move uses the local date like the rest of the Leitner code; no new clock dependency |
| S12 | Cleared site data | Local queue and drafts are lost; server progress remains; the first sync restores it |
| S13 | Importing a JSON backup in Settings | Replaces cards and settings as today; dictation progress is untouched (not in the backup, Open Question 11) |
| S14 | Admin deletes the account | Cascade removes the new rows (FK `on delete cascade`) |

## C. Content edits after a user has progress

| Id | Case | Expected behavior |
|---|---|---|
| C1 | Typo fixed in a finished sentence (same id, new hash) | Status kept; the new text shows in history |
| C2 | Text of the current sentence edited | The draft with the old hash is discarded; the new text is expected |
| C3 | Sentence inserted before the frontier | It has no row, so it is new; the frontier moves back to it; the stage shows it with the normal flow |
| C4 | Sentence retired (removed) | History omits it; its row is ignored in counts; the frontier skips it |
| C5 | Speaker changed for a sentence | Audio key changes, new file generated; progress unaffected |
| C6 | Audio regenerated while the learner has the page open | The old index still points to old keys that remain in Storage for at least 30 days, so playback continues; the new index is picked up at the next load |
| C7 | Story JSON cached by the browser while a new version deploys | `index.json` and story files are fetched with `cache: 'no-cache'` (revalidate) and carry `contentVersion`; a version change at load triggers C1 to C4 handling |
| C8 | Grammar card removed or renamed | Missing id is skipped at runtime and fails the CI content test beforehand |
| C9 | A link range no longer matches a token after a text edit | CI validation fails the PR; at runtime the link is ignored and the word is not tappable |

## M. Images

| Id | Case | Expected behavior |
|---|---|---|
| M1 | Illustration file missing for a sequence (`image: null` or 404) | Placeholder panel with the sequence title (state 20); dictation works fully |
| M2 | Image loads slowly | A skeleton with the right 4:3 aspect ratio reserves space (no layout shift); `loading="eager"` for the current sequence, `lazy` for tiles |
| M3 | Image fails after loading started | The placeholder replaces it; no retry loop |
| M4 | Narrow screen crops the image | `object-fit: cover`, `object-position: center`; the visual bible keeps faces away from the edges |
| M5 | Dark mode | The watercolor image is shown unchanged on a neutral card background; no filter |
| M6 | High-density screens | `srcset` with the 800 px and 1600 px WebP files |
| M7 | Alt text missing | The sequence title is used as the alt text; the content test requires alt text for `fa` and `en` |

## X. Accessibility

| Id | Case | Expected behavior |
|---|---|---|
| X1 | Screen reader user needs the audio | Audio is the exercise itself; the speaker label and Replay are reachable; after a skip the text is read; a transcript mode is out of scope for v1 (Open Question 13) and said so in the help text |
| X2 | Screen reader and the diff | Marks are `<mark>` elements with `aria-label` ("capitalization", "missing comma") and a visually hidden prefix; the summary line is announced in the polite live region |
| X3 | Keyboard only | Full flow without a pointer: Tab order Replay, input, umlaut buttons, Check, Skip, Next, grammar toggle; `Ctrl/Cmd+Enter` replays; `Escape` closes the sheet |
| X4 | Focus after actions | After a submission with mistakes focus stays in the input; after correct, focus moves to Next; after Next or Skip it moves to the input; a sheet returns focus to the tapped word |
| X5 | Reduced motion | No pulsing, no sliding drawer animation |
| X6 | Zoom to 200 percent or large text | Layout reflows to one column; the umlaut bar wraps; no horizontal scrolling |
| X7 | High contrast and color blindness | Every mark has a shape or line style; praise and error text are words, not only colors |
| X8 | Captions | The speaker name chip is the live "caption" of who is speaking; the sentence text appears after submission or skip by design (it is a dictation) |
| X9 | Touch target size | 44 by 44 px for buttons, the umlaut keys and history items |
| X10 | Screen reader announcements flood | The live region is throttled to one message per 500 ms and never announces keystroke-level changes |

## R. RTL Persian UI around LTR German text

| Id | Case | Expected behavior |
|---|---|---|
| R1 | German text in the RTL page | Always `dir="ltr" lang="de"` with `unicode-bidi: isolate`; left aligned in both interface directions |
| R2 | Sentence ending in `?` or `!` | The mark stays at the right end of the German text (isolation); verified in the Persian UI |
| R3 | Mixed Persian label and German word in one line (for example the word sheet "heißen: فعل") | The German token is isolated with `<bdi dir="ltr">`; the Persian text follows the page direction |
| R4 | Numbers in the Persian UI | Interface counters use `num()` (Persian digits); digits inside German sentences are never localized |
| R5 | Umlaut buttons in RTL | Fixed left-to-right order; not mirrored |
| R6 | Arrows and chevrons | Use `rtl:-scale-x-100` like other components; Next and Back keep their logical meaning |
| R7 | Side drawer position | In RTL the drawer sits on the start side (right), in LTR on the left; in both cases after the main column in the DOM order for reading |
| R8 | Persian keyboard active while typing German | Wrong characters are marked normally; no automatic layout switch |
| R9 | Mark ranges in bidi text | Ranges are computed on logical string offsets, rendered inside the isolated LTR container, so highlights do not jump |
| R10 | Language switched while on the screen | Static labels update; the German content stays as is; the current sentence, draft and audio are untouched |

## L. Leitner actions

| Id | Case | Expected behavior |
|---|---|---|
| L1 | Word tapped is already in the box | Sheet shows its compartment and due date; the button is Move back |
| L2 | Word not in the box | Button is Add to my box |
| L3 | Word matches two catalog entries (duplicates) | The id the user already has is used; otherwise the lowest eligible lesson |
| L4 | Inflected form (`heiße`) | Maps to `heißen` through the build-time link; the sheet names the base form |
| L5 | Separable verb split in the sentence | Both parts are the same link group; either opens the same sheet |
| L6 | Noun stored with the article | The sheet shows the article; adding uses the catalog card |
| L7 | Word not in the catalog | Offer a custom card prefilled in the existing modal; the sentence is the example |
| L8 | Card in box 0 | Move back becomes "already in the first compartment"; no change except due today |
| L9 | Card mastered (box 6) | Moves to box 5, due = entry day plus 32, clamped to today |
| L10 | Card is overdue and moved back | Due date is clamped to today, so the nightly rule does not demote it again |
| L11 | `lastReviewedAt` is null (card never reviewed) | Entry day is today; box 0 rule or box minus one with due = today plus interval of the new box |
| L12 | Double tap on Move back | One move per second; each is a separate undoable action |
| L13 | Undo after the card was synced | Undo writes the previous snapshot as a normal card update |
| L14 | Offline while adding | Same as any card write: local first, synced later |
| L15 | Learner skips a sentence | No sheet, no action, no change to any card |
| L16 | Learner presses Next with mistakes | No automatic Leitner change; the tapped-word sheet is only reachable while the feedback view is open |
| L17 | Card limit reached (10,000 cards) | The existing server trigger error surfaces as a sync error; the sheet shows "could not add"; nothing partial |
| L18 | `reflection` or `shared_` cards | Never linked, never moved |

## B. Beta release behavior

| Id | Case | Expected behavior |
|---|---|---|
| B1 | Beta badge | On the tab, the story list header and the dictation header; links to the feedback issue template |
| B2 | First visit | One-time intro (`dictationIntroSeen`) explaining audio, strict checking and that nothing changes the Leitner box automatically |
| B3 | Kill switch (`app_flags.dictation_enabled = false`) | The tab shows the maintenance state; running sessions finish the current sentence and then see the paused state at the next navigation; progress already queued still syncs |
| B4 | Flag fetch fails | Fail open: use the build-time constant `DICTATION_ENABLED` |
| B5 | Database migration not installed yet in an environment | The tab loads the content but progress saving fails quietly; progress stays in local storage and a one-line notice says it is not synced yet (same philosophy as `fetchUnseenOverdueMoves`) |
| B6 | Storage bucket not reachable | Chain falls to Mode C; text-only fallback; no crash |
| B7 | Old app version cached by a tab while a new one deploys | The service worker caches nothing; JSON uses revalidation; a reload gives the new code; stale code that calls a changed RPC fails safely (RPC signature never changes within v1) |
| B8 | Feedback from beta users | A "Report a problem" link opens the existing GitHub issue template with the sentence id prefilled; no personal data is added |
| B9 | Heavy load day | Static content on the CDN and Storage; the DB sees batched writes only |
| B10 | Beta ends | Remove the badge and the flag check in a normal release; the data model stays |
