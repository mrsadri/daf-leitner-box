# Stories first: plan for the embassy showcase (2026-11-24)

**Requests:**
1. English (with German) is the default language instead of Persian.
2. Visitors land on Stories and can use them without signing in; to continue, they are asked to sign in.
3. Stories is the main feature of the app.
4. In Persian the first story sits on the right; in English, on the left.
5. While reading a chapter, its picture stays at the top of the screen and the whole chapter's text scrolls under it.
6. Fix the Stories layout on phones.

Terms: a **book** has 6 **stories** (chapters, `S01-Q1` … `S10-Q6`). Each story has one picture, a short scene summary, the German text (built in "pages") and a quiz.

## 1. Findings

| # | Today | Root cause |
|---|---|---|
| 1 | Persian by default | `DEFAULT_LANG = 'fa'` (`src/i18n/format.ts`), `index.html` starts `lang="fa" dir="rtl"`, and `public/interface-language.js` only switches to English when chosen |
| 2 | Signed-out visitors see only the sign-in carousel | `AuthGate` renders `LoginScreen` when there is no session |
| 3 | The app opens on the Leitner dashboard; Stories is the 4th tab | `useState<ActiveTab>('dashboard')` in `LeitnerApp`; tab order in `Navbar` |
| 4 | The first book/story is on the **left** in Persian too | The library, book page and cover force `dir="ltr"` on their grids and lists |
| 5 | The reader is a paginated picture book: a cover, then one page at a time | `Reader.tsx` steps through `cover → page i → quiz` |
| 6 | Phone problems seen at 390 px | (a) each story row in a book shows its **whole** first page, because `line-clamp-2` is cancelled by `block`, so the list is very long; (b) direction mirrored wrongly (see 4); (c) the book grid's teasers are long; (d) a reading page is longer than the screen, so you scroll and turn pages |

## 2. Decisions (I chose a default for each; tell me to change any)

1. **Language.**
   - New visitors get **English**.
   - **Existing learners keep Persian.** A device that already has app data but no saved language choice is set to Persian once, so current Iranian users are not switched to English overnight.
   - A language saved in the account still applies after sign-in.
   - The language switch stays in the header.
2. **Guest reading.**
   - Signed-out visitors land on the Stories library with a slim header (app name, language switch, **Sign in**).
   - They can open every book and read the **first story of any book**, including its quiz. Later stories open in order, as today.
   - **"Continue"** asks them to sign in: the next story, a locked story, or saving a word to the Leitner box.
   - Tapping a word still shows its meaning and pronunciation without an account; only "add to my box" needs sign-in.
   - Guest progress stays on the device and is **carried into the account** after sign-in. Progress never goes backwards, which the existing merge rule guarantees.
   - After Google sign-in, the learner returns to the story they were reading.
3. **Stories first.** After sign-in the app opens on Stories, unless a link says otherwise (`?go=…`). Stories becomes the first tab, and the logo opens Stories. The dashboard, review and other features are unchanged.
4. **Reading direction of the interface.** The library grid, book page and scene list follow the interface language: right-to-left in Persian, left-to-right in English. German text itself stays left-to-right.
5. **Reader.** One scrolling chapter:
   - The picture is pinned at the top (with a compact toolbar: leave, text settings).
   - Under it come the title, the scene summary in the interface language, and then **all** of the German text.
   - At the end there is a **To the quiz** button.
   - No cover screen, no page turning. Without a picture, the header is just the toolbar and title.
   - The pinned picture takes at most about a third of the screen height on phones, so the text keeps room.
   - Reading progress is still saved as "page reached", measured by scrolling. "Continue reading" scrolls back to where the learner was.
6. **Phones.**
   - The excerpt is clamped to 2 lines and the book teasers to 3.
   - The library grid becomes one column below 480 px.
   - The reader is a single column with safe-area padding.
   - There is no horizontal scrolling anywhere (already tested).

Not changed: Leitner rules, database, scores and rewards (completing a quiz while signed in still gives its points). Guests earn no points; their completed quizzes count once they sign in.

## 3. Risks, corner cases and edge cases

| # | Case | Risk | Handling |
|---|---|---|---|
| R1 | Existing Persian learners | Suddenly English | One-time migration: device with app data and no saved language → Persian |
| R2 | Persian learner on a new device, language never saved | Sees English | The switch is in the header. From now on, a Persian choice is saved to the account (it differs from the new default) |
| R3 | `index.html` title and meta were in Persian | Wrong shared-link preview for the embassy | Switched to English; the app still sets the title per language |
| R4 | Guest progress vs. account progress | Overwrite or loss | Import merges by the existing "never backwards" rule; guest data is removed only after import |
| R5 | Guest signs in with an account that already finished the story | Duplicate reward | Rewards come from server-side completion and are given once per story (existing rule) |
| R6 | OAuth redirect drops `?book=…&story=…` | Learner lands on the shelf | The reading location is saved before redirect and restored after sign-in |
| R7 | Stories kill switch off | Guests see an empty app | Guests fall back to the sign-in screen when `stories_enabled` is false |
| R8 | Guest taps "add to my box" | No account to save to | Opens the sign-in prompt instead |
| R9 | Guest opens a deep link to a locked story | Bypasses order | Same lock rule as signed-in learners; locked → book page plus the sign-in prompt |
| R10 | Picture pinned on short phones or in landscape | Text has no room | Height `clamp(120px, 32vh, 360px)`; in landscape on phones (height < 500 px) the picture is not pinned |
| R11 | Long chapter | Progress lost if the learner leaves mid-way | The highest text block seen is saved as `page`; reopening scrolls to it |
| R12 | Screen readers | The pinned picture is announced repeatedly | The image keeps its alt text once; text blocks are a labelled region |
| R13 | RTL mirroring | German or numbers flipped | German stays in `<De>` (LTR); only layout order follows the interface |
| R14 | Existing e2e tests use the cover and page buttons | Tests break | Tests are rewritten for the new reader; same coverage (quiz, word sheet, settings, resume) |
| R15 | Demo build has no sign-in | The guest flow can't be tested | Demo/dev only: `?guest=1` shows the guest shell; its "Sign in" opens the demo app |
| R16 | Privacy | Guests send nothing to the server | Guest progress is localStorage only; no requests to other hosts |
| R17 | Not official | Showcase to the embassy | No logos or wording suggesting an official app (rule 3); the footer credit stays |

## 4. Todo list

- [x] Research: code, screenshots on phone, plan
- [x] Language: default `en`, one-time migration for existing devices, `index.html` and `interface-language.js`
- [x] Guest shell (`GuestApp`): header with sign in; StoriesScreen in guest mode; sign-in prompt dialog; demo `?guest=1`
- [x] Guest progress store (local only) and import after sign-in; return-to-story after OAuth
- [x] WordSheet guest mode: meaning only, "sign in to save"
- [x] Stories first: default tab, tab order, logo
- [x] RTL/LTR order: remove forced `dir="ltr"` from library, book and cover layouts
- [x] Reader: pinned picture plus one scrolling chapter, progress by scroll, resume, quiz button
- [x] Phone fixes: clamps, one-column grid, reader spacing
- [x] Strings (fa/en) for guest and reader
- [x] Unit tests: language default and migration, guest import merge, scroll-progress helper
- [x] e2e: guest flow, RTL/LTR order, reader picture pinned and text scrolls, resume, phone with no sideways scroll
- [x] lint, unit, SQL (unchanged), build, e2e; screenshots fa/en × phone/desktop
- [ ] PR, CI, demo preview → owner's merge sentence → deploy → live check

## 5. Acceptance checklist

- [ ] A new visitor (no saved language) sees English; an existing Persian learner still sees Persian
- [ ] Signed out, the site opens on the Stories library, not on the sign-in screen
- [ ] A guest can read a first story, tap words for meanings and answer its quiz
- [ ] "Next story", locked stories and "add to my box" ask the guest to sign in
- [ ] After sign-in, the guest's progress is in the account and the learner is back at the story
- [ ] Signed in, the app opens on Stories; Stories is the first tab
- [ ] Persian: the first book and story are on the right; English: on the left
- [ ] While reading, the picture stays at the top and the whole chapter text scrolls beneath it
- [ ] "Continue reading" returns to the right place in the chapter; the quiz follows the text
- [ ] Phone (390 px): no sideways scrolling, short story rows, readable library, reader text has room
- [ ] Dark mode, reduce-motion and keyboard still work; no requests to other hosts
- [ ] lint, unit, e2e and build are green in CI; no database change

## 6. Verification log (local, 2026-11-24)

- `npm run lint`: clean. `npm test`: 245/245 passed (new: `tests/storiesFirst.test.ts`).
- `npm run e2e` (Chrome, phone and desktop): 108/108 passed. New or rewritten specs:
  - `guestStories.spec.ts`: guest reading, sign-in prompts, progress import, default language;
  - `stories-reading-layout.spec.ts`: pinned picture, one scrolling chapter, resume, RTL/LTR order, clamped excerpts.
- Production build (placeholder keys) and the Stories freshness check pass.
- Screenshots checked: guest landing, library, book page and reader, in Persian and English, phone and desktop.
- Extra fix found on the way: the app loaded the Stories chunk even when a link asked for another tab; the first tab now follows `?go=`.
