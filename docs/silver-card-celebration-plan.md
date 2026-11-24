# Silver card celebration: plan, risks, todo and checklist

**Request (2026-11-24):** while a learner is doing the daily review, show the silver card as soon as they earn it. The card should come in with a gentle motion and sprinkles, and show its message (the card's fact).

## 1. What I found

| Area | Current behaviour |
|---|---|
| Rule | A day with more than 15 correct vocabulary answers earns the next card (`silverLogic.ts`). There is at most one per day and 30 in total. The server is the authority (`get_verified_silver_status`). |
| Review hook | `ReviewSession.handleVocabAnswer` calls `recordSilverCorrect()` and opens `SilverCardEarned` if it returns a number. |
| **Bug** | `recordSilverCorrect()` returns `null` unless the app is in **demo mode** ("Competitive rewards are confirmed only by the server", added in #32). **In production the earned dialog never opens.** Learners only see the count change on the dashboard widget. |
| Server confirmation | Answers are queued and flushed 800 ms later (`cloudSync`). When the queue goes back to `idle`, `refreshSilver()` reads the verified total. A card is confirmed about 1–2 s after the 16th correct answer when the device is online. |
| Dialog | `SilverCardEarned` is a plain `<Dialog>` with `SilverCardFace`. It has no motion. |
| Motion | The app has its own CSS keyframes in `src/index.css` (`ob-*`, `story-*`) and respects `prefers-reduced-motion`. There is no confetti library. The app must not request other hosts, and the bundle should stay small. |

## 2. Design

**Trigger: server-confirmed, not guessed.** The celebration fires when the *verified* silver total goes up and today's card is earned. It does not fire on the local 16th answer. This keeps the anti-cheat rule from #32, and the device never shows a card the server would refuse. In demo mode the local counter is the authority, so the same code path works there.

- `silver.ts` stores a per-user **"seen" mark** (`daf_silver_seen_<uid>`): the highest card number already celebrated on this device.
- A card is **pending** when `total > seen` **and** `earnedToday` **and** the state is for today.
- The pending card is shown by a hook (`usePendingSilver`) inside `ReviewSession`. That covers the card screen and the "review finished" screen.
- If the card is confirmed after the learner has left review, it stays pending and opens the next time they open review **that same day**.
- Closing the dialog marks the card as seen.
- **Baseline:** the first time a device runs this version, `seen` is set to the current total, so old cards are never celebrated after the update. In production this waits for the first server status; in demo mode the local state is used.
- Older cards that were never seen on this device (earned on another day or on another device) are marked seen without being shown.

**Visuals, CSS only with no new dependency:**
1. **Card reveal (gentle motion):** the card rises about 24 px, tilts back from 14° to 0° and grows from 92% to 100% over about 0.8 s with a soft ease-out. The medal in the title pops in, then one light **shimmer** sweeps across the silver face. After that the card floats very slightly (±3 px, 4 s loop).
2. **Sprinkles:** 32 small rounded bars and dots in silver, sky, rose, amber, emerald and violet. They burst out from behind the card in two soft waves, drift down and fade within about 2.6 s. They play once, and their positions come from a fixed pattern so tests are stable. The layer is `pointer-events-none` and `aria-hidden`.
3. **Message:** the card's fact in the interface language, as it is shown today. It is not animated, so it can be read at once and screen readers announce it through the dialog.
4. **Sound and haptics:** the existing `playMastered` chime, which respects the sound switch, and the app's short vibration, which respects the haptics setting.
5. **`prefers-reduced-motion`:** no sprinkles, no float or shimmer, only a short fade-in.

## 3. Questions and suggestions for the owner

I picked a default for each question so the work is not blocked. Tell me if you want a different one.

1. **Server-confirmed vs. instant (default: server-confirmed).** Instant at the 16th answer would feel snappier. It would also break the rule that only the server confirms rewards, and offline learners could see a card that later doesn't count. Online, the delay is about 1–2 s.
2. **Where it may appear (default: only in review).** If the card is confirmed after the learner left review, it waits until they open review again that day. The other option is to show it on the dashboard as well.
3. **Card #30 (default: the same celebration plus the existing "collection complete" line).** It could get a bigger effect.
4. **Suggestion:** a small "Today 12/16" chip in the review header would show progress towards the card. This is not included; it is a separate change.
5. **Suggestion:** a "view collection" button in the celebration dialog. This is not included, to keep the moment simple.

## 4. Risks, corner cases and edge cases

| # | Case | Risk | Handling |
|---|---|---|---|
| R1 | Production never showed the dialog (demo-only path) | The whole feature silently does nothing for real users | Trigger from the verified total (§2); e2e covers it in demo |
| R2 | First launch after the update | Every old card, or yesterday's card, pops up | Baseline `seen` = current total on first authoritative status |
| R3 | Earned on phone, then review opened on laptop the same day | Second celebration on the laptop | Accepted: shown once per device, because the "seen" mark is local. It is still the learner's card for today |
| R4 | Offline during the 16th answer | No confirmation until the queue is flushed | The card stays pending; it opens after sync, in review, the same day |
| R5 | The learner leaves review before the server confirms | Celebration lost | Pending until the next review that day; after midnight it is marked seen quietly |
| R6 | The day changes during the session (review past midnight) | Yesterday's card pops up today, or the count resets | Pending requires `earnedToday` for today; `rollDay` already resets |
| R7 | Network reply for user A arrives after switching to user B | Wrong user's card | `refreshSilver` already drops replies when `uid !== userId`; the seen mark is per user |
| R8 | Two tabs open | Both celebrate | Accepted (rare); each closes independently and both write the same seen value |
| R9 | Another dialog is open (edit card, conjugation) | Stacked dialogs | `Dialog` supports a stack; the celebration opens on top and focus returns |
| R10 | Learner keeps swiping or pressing keys while it opens | Answer recorded by accident | `Dialog` makes the background inert and review shortcuts check `isDialogOpen()` |
| R11 | Collection already full (30) | Index out of range | Server total is clamped to `SILVER_MAX`; `SilverCardFace` returns null for unknown indexes; no pending beyond 30 |
| R12 | `prefers-reduced-motion` / vestibular sensitivity | Motion sickness | Fade-only fallback; no particles |
| R13 | Low-end Android phones | Jank | 32 elements, transforms and opacity only (GPU friendly), one-shot, no JS animation loop |
| R14 | RTL vs LTR | Mirrored or misplaced burst | Burst is symmetric from the centre; text direction is unchanged |
| R15 | Dark mode | Silver card washes out | Existing dark silver face; sprinkle colours checked on both backgrounds |
| R16 | Sound off, or iOS without user gesture | Unwanted audio | Uses `soundService` (respects the switch, ignores errors) |
| R17 | localStorage blocked (private mode) | Celebration repeats on every refresh | try/catch; falls back to in-memory seen, so a card is celebrated at most once per page load |
| R18 | Server migration not installed (RPC error) | Never confirmed | Same as today (silently skipped); demo still works |
| R19 | Screen readers | Decorative noise | Sprinkles are `aria-hidden`; the title and fact are read through the dialog's label and description |
| R20 | Leitner rules | Changing intervals or points needs the owner's OK | Not touched: display only |

## 5. Todo list

- [x] Research the current flow and find the root cause (R1)
- [x] Write this plan
- [x] Pure logic: `pendingCelebration(state, seen, today, max)` in `silverLogic.ts`, plus unit tests
- [x] `silver.ts`: per-user seen mark, baseline, `getPendingSilver()`, `acknowledgeSilver()`, and change notifications
- [x] `usePendingSilver()` hook; `ReviewSession` uses it instead of the demo-only return value
- [x] `SilverCardEarned`: reveal motion, shimmer, float, sprinkles, chime and haptics
- [x] CSS keyframes in `index.css` with a `prefers-reduced-motion` fallback
- [ ] ~~Add it to the component gallery~~: skipped, because `shared/ui/Gallery` does not import feature code. Check it in demo review instead.
- [x] e2e (demo): 16 correct answers open the celebration with sprinkles and the fact; closing it does not open it again
- [x] `npm run lint`, `npm test`, `npm run build`, `npm run e2e`
- [ ] PR, CI green, demo-mode preview for the owner
- [ ] Owner: "merge PR #N with admin and deploy to production"
- [ ] `vercel --prod` from `main` (check `.vercelignore` first) and a live check

## 6. Acceptance checklist

- [ ] In production, the 16th correct answer of the day opens the silver card within a few seconds while online
- [ ] The card shows its number ("Silver card N of 30"), its icon and its fact in the interface language
- [ ] The card rises gently into place, one shimmer passes, and sprinkles burst once and fade
- [ ] With "reduce motion" there is only a fade and no sprinkles
- [ ] It appears once per card per device; reloading after closing doesn't bring it back
- [ ] The first launch after the update shows no old cards
- [ ] A card confirmed after leaving review opens at the next review the same day, and not after midnight
- [ ] No more than one card per day, none above 30, and the Leitner rules are unchanged
- [ ] Review keys and swipes do nothing while the card is open; focus returns afterwards
- [ ] Works in Persian (RTL) and English, light and dark, phone and desktop
- [ ] No new dependency and no requests to other hosts (smoke test)
- [ ] lint, unit tests, e2e and build are green in CI
- [ ] No database change, so no owner-run SQL is needed

## 7. Verification log (2026-11-24, local)

- `npm run lint`: clean. `npm test`: 242/242 passed, including the new celebration tests in `tests/silver.test.ts`.
- `npm run e2e` (Chrome, phone and desktop): 92/92 passed, including `e2e/silverCelebration.spec.ts`.
- Screenshots with motion on were checked in Persian and English, light and dark, at 390 px and 1280 px. The sprinkles stay inside the dialog, and the fact text is readable once the burst is over.
- Production path (server confirmation after a sync) is covered by the shared logic and unit tests; it still needs a live check after deploy, because e2e runs in demo mode only.

## 8. Follow-up (same day): newest first, and 30 more cards

**Requests:** (1) show the most recently earned cards first in the collection; (2) research and add 30 more cards.

**Done**
- The collection lists earned cards newest first. Locked tiles stay in ascending order: they show what comes next.
- Cards 31–60 were added (`silverFacts.ts`):
  - 5 grammar shortcuts: compound-noun articles, feminine endings, the plural *die*, verb-second order, and writing ae/oe/ue;
  - 7 idioms and proverbs;
  - 5 word stories;
  - 10 culture and history facts: Gutenberg, Luther, Grimm, Silent Night, Edelweiss, Riesenrad, Beethoven/Schiller, Kafka, Bertha Benz, Röntgen;
  - 1 learning-science fact (the testing effect, Roediger & Karpicke 2006);
  - 1 final "collection complete" card.
- Card 30 no longer says "you collected all"; it now says "halfway there".
- Facts that sources disagree on are worded cautiously: Silent Night is sung in "hundreds of languages", Bertha Benz drove "about 100 km", Luther "helped shape" written German, and Brezel "probably" comes from *bracchium*. A beer idiom was left out on purpose, given the audience.
- Server cap raised to 60: `supabase/migrations/20261124150000_silver_sixty.sql`, tested in `supabase/tests/silver_sixty.test.sql`. Owner guide: `docs/supabase-silver-sixty-setup.md`.

**Risks**

| # | Case | Handling |
|---|---|---|
| R21 | Frontend deployed but migration not run yet | Server still reports at most 30; learners pause at card 30 until the SQL runs. Nothing breaks |
| R22 | Migration run but old frontend still cached | Old app clamps to its own 30 |
| R23 | Learners who already passed 30 | None can exist yet (cards started 2026-10-31); the guide includes a read-only check |
| R24 | Persian/German mixed direction | German phrases are wrapped in LTR isolates with the « » outside, matching card 1; checked on screen |
| R25 | Leaderboard shows the old maximum | Same migration updates `get_verified_leaderboard` |
| R26 | Fact accuracy | Uncertain claims were checked against sources (see the PR) and worded cautiously |
