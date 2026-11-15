# 02. User flows

Terms: **story** (10 exist, 2 in the first release), **sequence** (6 per story, each with one illustration),
**sentence** (the dictation unit), **frontier** (the first sentence of the story not yet finished, the resume point),
**finished** (correct or skipped).

## Flow 1: Enter and choose

1. The learner taps the new **Dictation** tab (label with a Beta badge). Entry points: Navbar tab, a dashboard card,
   and `?go=dictation`.
2. Story list: one card per published story (from `public/data/stories/index.json`): title, lesson range, progress
   bar (finished sentences / total), and a "Continue" button on the story with the latest activity.
3. Story detail: six sequence tiles, each with its illustration thumbnail, title, and progress. Locked sequences do
   not exist: the learner may open any sequence (decision: free navigation, because a learner may revisit or jump
   ahead; progress per sentence is tracked independently, the story frontier is just the first unfinished sentence).
4. Opening a sequence shows the illustration large, the Persian or English situation text (per interface language),
   and one primary button **Start** (or **Continue** when the sequence has progress). The tap is the user gesture
   that unlocks audio (see `05-audio.md`).

## Flow 2: The dictation loop (one sentence)

State machine: `idle -> playing -> typing -> submitted(correct | mistakes) -> next` with `skip` as a side exit.

1. **Play.** After Start, Next or Skip, the current sentence is played once automatically in its speaker's voice.
   The speaker's name chip is shown above the input (also for screen readers). Replay is unlimited: a Replay
   button and the shortcut `Ctrl+Enter` / `Cmd+Enter`. Plain `Enter` submits; `Shift+Enter` does nothing (no line
   breaks in dictation text).
2. **Type.** The learner types in a single-line-growing textarea. Under it: buttons **ä ö ü ß** (plus uppercase
   **Ä Ö Ü** via a shift toggle) inserting at the cursor. The input has the attributes that disable autocorrect,
   autocapitalize and spellcheck (`06-answer-checking.md`).
3. **Submit trigger.** The attempt is submitted when the learner types a terminal mark (`.`, `!`, `?`, or `…`) at
   the end of the text with no open quotation mark (rule in `06-answer-checking.md`). A visible **Check** button and the
   `Enter` key submit as well, so the flow never depends on the automatic trigger. Resubmitting is always allowed.
4. **Feedback.**
   - Correct: the input is replaced by the sentence in a success style and a short praise message appears (a pool of
     messages per language, never the same twice in a row). Focus moves to **Next**.
   - Mistakes: the learner's text stays editable. Mistakes are highlighted inside it with a category (missing,
     extra, wrong letter, capitalization, punctuation, umlaut or ß substitution, word order, spacing). A one-line
     summary says how many mistakes there are, not what the answer is. The learner edits and submits again, or taps a
     highlighted word for the Leitner sheet (`07-leitner-integration.md`), or presses **Next**.
5. **Next** is available after any submission (correct or not), and when pressed with mistakes the sentence is
   recorded as `attempted` and the correct sentence is **revealed in the history** (it must be, since the history shows
   correct text). It then plays the next sentence. Next is disabled before the first submission, which is what makes
   **I didn't get it** a separate, deliberate action.
6. **I didn't get it** (always available while typing): reveals the correct sentence, records `skipped`
   (no Leitner effect, no counted mistake), and moves to the next sentence, which plays automatically.
7. **History.** Finished sentences stack above the current one as correct text with the speaker label. Clicking or
   pressing Enter on one replays it in its speaker's voice (a replay never changes progress except the `listens`
   counter). Skipped sentences are marked with a small "skipped" glyph. Long histories are virtualized by sequence:
   only the current sequence is rendered, earlier sequences collapse into a "show earlier sentences" disclosure.
8. **Sequence end.** After the last sentence: summary (finished, skipped, sentences with mistakes), the three
   comprehension questions are **not** part of this feature (no UI, listed as out of scope), buttons **Next
   sequence** and **Back to story**. After the last sequence of the story: story complete screen.

## Flow 3: Leitner action from feedback (manual)

1. After a submission with mistakes, the learner taps a highlighted word.
2. A bottom sheet (mobile) or popover (desktop) shows: the correct word form, the matched course word if any
   (base form, article, meaning), the card state (not in box, or in compartment N, due date).
3. Actions: **Add to my box** (when not in the box) or **Move back one compartment** (when in the box). Both give an
   undo toast for 8 seconds. Nothing happens automatically, and skipping never offers or performs an action.
   Details: `07-leitner-integration.md`.

## Flow 4: Resume on any device

1. On sign-in, `dictationSync` loads `story_progress` and `story_sentence_progress` for the published stories.
2. The story list shows the progress; **Continue** opens the sequence that contains the frontier and positions the
   current sentence at the frontier. Sentences before it appear as history.
3. A half-typed draft is kept per device (localStorage, keyed by sentence id and content hash); it is not synced.
4. If the same user types on two devices, the frontier moves forward only (`greatest`), see `09-data-model.md`.

## Flow 5: Audio mode and grammar preferences

1. Settings, section **Dictation**: audio mode A, B or C (radio group with a one-line description each and a Test
   button), speech speed (reuses `speechRate`), and the grammar drawer default (open or collapsed).
2. Changing the mode applies from the next sentence; the current sentence can be replayed with the new mode at once.
3. If the chosen mode is not available for a sentence, the fallback chain in `05-audio.md` applies with a visible
   note.

## Flow 6: Error and degraded flows

| Situation | What the learner experiences |
|---|---|
| Story JSON fails to load | Retry card with a retry button; the rest of the app is unaffected |
| Audio file fails | Fallback chain; a small note "Using another voice"; Replay retries the original first |
| Offline | Typing and checking work (pure client logic); audio works if cached, otherwise Mode C fallback; progress queues locally and syncs later |
| Progress save fails | Silent retry with backoff (same pattern as `cloudSync`); a sync dot in the Navbar already exists and is reused |
| Feature disabled by kill switch | Tab shows "Dictation is paused for maintenance", nothing else changes |
