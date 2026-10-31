# Swipe cards and round buttons (new words + review)

## Problem
On phones the bottom bar of the new-words session was too tall and unbalanced:
- the main label wrapped onto three lines;
- the back button was a bare "›" (in RTL it means "back", but it reads as "next");
- the three buttons had different weights.

## Decisions (from the user)
- **Dating-app interaction:**
  - drag the card sideways: **right = "Got it" / "Knew it"**, **left = skip / "Didn't know"**;
  - while dragging, a stamp ("یاد گرفتم ✓" / "رد شد") fades in and the card tilts;
  - on release past the threshold the card flies out and the next one comes in.
- **Round buttons** in one compact row, same physical order as the swipe directions (left = skip, right = got it):
  - new words: ✕ skip · ↶ back (small) · ✓ got it;
  - review: ✕ didn't know · ✓ knew it;
  - reflection cards: one ✓ "read" button.
- **Labels:** single-line ("یاد گرفتم", "بلد بودم"). The extra hints ("مرور فردا", "یک خانه جلو") move to tooltips / aria labels.
- **Review:** gets the same model.

## Behaviour
- **Back (new words):**
  - the previous card flies back in from the left (a rewind);
  - also available on the end screen;
  - disabled on the first word.
- **Back on a word added in this session:**
  - the left button becomes "remove from Box 0" (undo) and the right one "next";
  - swiping either way moves on (never adds twice).
- **Review, swiping right while "Knew it" is locked** (Perfekt not answered correctly, or wrong article guess): the card springs back and a short message says why.
- **Reflection cards:** swipe right = read; swipe left springs back.
- **Keyboard (desktop):**
  - new words: ← skip, → got it, Enter got it, Backspace back, Space pronounce;
  - review: ← / 1 didn't know, → / 2 knew it, Space flip.
- **Haptics:** a short vibration on a committed swipe where supported (Android), only if "haptic feedback" is on.
- **First-time hint:** on touch devices, "swipe right: got it · left: skip" under the card until the first successful swipe (remembered on the device).

## Corner cases
- **Vertical scrolling** of a long card stays native (`touch-action: pan-y`). A drag counts only after clear horizontal movement (more than 10px and 1.5× the vertical movement); a vertical start cancels it.
- **Drags never start** on buttons, links, inputs or the Perfekt field.
- **Mouse:** no drag (text stays selectable); desktop uses buttons and keys.
- **Only the first pointer counts.** pointercancel springs back.
- **While a card is flying out,** buttons, keys and new drags are ignored, so a double tap can't answer two cards.
- **Threshold:** 30% of the card width (at most 120px), or a fast flick (more than 0.6 px/ms and more than 40px).
- **Two-sided card:** a tap flips; a drag doesn't flip, because the click after a drag is suppressed.
- **Last card:** the fly-out leads to the end screen.
- **Reduced motion** (`prefers-reduced-motion`): no fly or tilt animation, just the change.
- **Dialogs** (conjugation, silver card) cover the card, so no swipes reach it.
- **Small phones:** the bar fits at 320px. It stays fixed at the bottom with safe-area padding.
- **iOS Safari edge-swipe:** the card has a 16px margin from the screen edge. In the installed app there is no browser back gesture.

## Follow-up (user feedback)
- **Desktop (mouse/trackpad):** no card motion. Buttons and keys change the card at once. A 200ms pause after each answer keeps an accidental double click from answering two cards.
- **Bottom bar:** fixed at the bottom of the screen on every screen size, desktop included.
- **Perfekt guide:** sits outside the card, below it, collapsed by default ("How is the Perfekt of this verb formed?" ▾). Inside the Perfekt quiz it is collapsed too.

## Tasks
- [x] `SwipeCard` component (pointer gestures, stamps, fly-out / spring-back / enter animations, imperative fly for buttons and keys, reduced motion, lock while animating)
- [x] `RoundActionBar` (round buttons, physical left→right order, labels, fixed on phones)
- [x] New-words session: swipe + round bar (skip / back / got it; added state: undo / back / next), keys, first-time hint
- [x] Review: swipe + round bar (didn't know / knew it; reflection: read), locked-right message, keys
- [x] fa/en strings, haptics
- [x] Unit tests for the gesture decision (threshold, flick, direction lock); Playwright touch e2e (swipe, scroll vs swipe, buttons, back, locked, 320px/390px, desktop keys); regressions
- [ ] PR, CI, merge, production deploy, live check
