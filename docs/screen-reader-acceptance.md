# Screen-reader acceptance (task 21)

Status: automated keyboard/focus/language checks pass; **human VoiceOver/NVDA observation remains pending**. DOM and browser accessibility assertions cannot establish what a screen reader actually announces.

Use a demo preview with synthetic data, not a learner's production account. Record OS, browser, screen reader/version, language and date. Repeat in Persian and English; German story text must switch pronunciation independently of the interface language.

| Step | Expected observation | Result / evidence |
|---|---|---|
| Open the app, navigate landmarks and tabs | Header/navigation/main identifiable; current tab announced | Pending |
| Open Settings, navigate fields | Every field has a useful label; toggle state and validation are announced | Pending |
| Open a dialog, then a nested dialog | Focus enters topmost dialog; background is unavailable; Escape closes topmost only; focus returns to trigger | Pending |
| Open a story, move through text and word lookup | German text pronounced as German; lookup controls have a name; instruction language matches the chosen UI; keyboard word movement follows visible focus | Pending |
| Review a card, reveal answer, save a result | Reveal and progress are understandable; no hidden answer is announced early | Pending |
| Disconnect after load; queue work, reconnect | Pending/saved/failure messages are discoverable without moving focus unexpectedly | Pending |
| Set large text and narrow viewport | Reading and focus order remain meaningful; no controls disappear | Pending |

Attach a short transcript of actual announcements and any defects. Do not mark passed merely because keyboard navigation works. Resolve defects and repeat affected steps before checking V21.
