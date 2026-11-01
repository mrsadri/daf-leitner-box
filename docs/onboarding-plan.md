# Onboarding (signed-out screen)

## Request
When the user isn't signed in, show an onboarding screen that introduces the app's features well. The illustrations use thiings.co icons, and the elements of each illustration get a little sensible motion, like Telegram's onboarding.

## Decisions (from the user)
- **Layout:** Telegram style. Swipeable slides with an animated illustration, a title and a short text, and page dots.
  - The **Google sign-in button stays at the bottom on every slide**, so returning users don't have to swipe.
- **Three slides:**
  1. **Leitner, the best way:**
     - each card comes back right before you would forget it (1, 2, 4 … 32 days);
     - knew it → next box; didn't → one box back.
  2. **From A1 to B1:**
     - master nouns with their meaning and their article (der / die / das), and the Perfekt of verbs;
     - over 3400 words from the DaF kompakt word list.
  3. **Competitive enough not to fall behind:**
     - weekly and overall leaderboard;
     - a notice when someone passes you;
     - silver cards for a strong day.

## Illustrations and motion
- **Every element is a separate layer** (thiings.co 3D icons plus small text chips). Each layer enters once when its slide opens (staggered), then keeps a small idle loop.
- **Leitner:**
  - word cards (1, 2, 4, 8 days) fly in an arc into the filing cabinet;
  - the alarm clock rings now and then;
  - the light bulb glows.
- **A1–B1:**
  - "der", "die", "das" pop out of the book in their app colours and float;
  - "hat gelernt" slides in;
  - the graduation cap drops onto the book;
  - the headphones (pronunciation) bob.
- **Competition:**
  - "You" overtakes in a mini leaderboard (the two rows swap places);
  - the silver medal swings;
  - the bell rings, the flame (streak) flickers, the trophy sparkles.

## Behaviour
- **Changing slides:** swipe (touch or mouse drag), page dots, ← / → keys, and arrow buttons on wider screens. Direction follows the language: in Persian the next slide comes from the left.
- **No auto-advance**, as in Telegram.
- **Replay:** the entrance animation plays again whenever a slide becomes active. Idle loops run only on the active slide.
- **Reduced motion:** a still composition, no animation.
- **Accessibility:**
  - the slides are a labelled carousel ("slide 1 of 3"); inactive slides are hidden from screen readers;
  - illustrations are decorative;
  - the text says it all.
- **Language switch** stays at the top.
- **Kept from the old screen:**
  - the independence disclaimer and "3D-Icons: thiings.co" (Credit);
  - the privacy link;
  - sign-in errors.
- **Sizes:** works at 320px and on desktop (a centred column), and in short landscape phones (the illustration shrinks first).

## Icons
- **Large versions** (360px) of filing-cabinet, book and trophy for the central objects.
- **New icons,** downloaded individually from their thiings.co pages: alarm-clock, bell, flame, party-popper.
- All listed in `docs/icon-credits.md`.

## Checklist
- [x] Icons (large versions + new), credits
- [x] Onboarding component + illustrations + keyframes (reduced motion)
- [x] fa / en strings
- [x] Playwright: swipe, dots, keys, RTL/LTR direction, 320px / 390px / desktop, reduced motion, sign-in button always visible, no console errors; screenshots
- [ ] PR, CI, merge, production deploy, live check
