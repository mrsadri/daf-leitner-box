# Design inspired by Austria (and a little Germany): plan

Status: **plan for approval, not implemented.**

## Goal and limits

The app gets a visual identity inspired by Austria (and a little by Germany), built from:
- national colours;
- cultural symbols;
- the visual language of public signage (road, station and trail signs).

It must not look like an official product of the embassy or the Austrian Cultural Forum: it is an independent volunteer project.

### Decisions (from the user)

| Topic | Decision |
| --- | --- |
| Inspiration | National colours and cultural symbols, plus public signage (without copying any transport company's logo) |
| Countries | Austria first, a little Germany |
| 3D icons | thiings.co, free licence, with visible attribution |
| Disclaimer | Yes, under the credit line |

## Legal and safety rules (checked)

| Element | Rule | In the app |
| --- | --- | --- |
| Austrian federal coat of arms / eagle | Wappengesetz §7, §8: private use must not suggest public authority; misuse is an offence | **Never used**, not even stylised. The double-headed Habsburg eagle is not used either. |
| German federal eagle / coat of arms | §124 OWiG: for official use only; needs permission | **Never used** |
| Flag colours red-white-red / black-red-gold | Colours and plain flags are freely usable; protected only against disparagement | Used as **colours and stripes**. Flags are drawn exactly as SVG (correct proportions and stripes), never taken from AI icons. |
| Logos of the ÖKF, embassy, Wiener Linien, ÖBB, ASFINAG, Ampelmann | Trademarks / official signs | **Not used, not imitated** (e.g. no blue square with a white "U" for the U-Bahn) |
| Austrian road-sign typeface Tern, German government fonts | Licensed / official | Not used. A free signage-style font is used instead (see Typography). |
| thiings.co icons (free licence) | Personal and non-commercial use only; **visible attribution "thiings.co"** required; individual downloads only; no redistribution as standalone files | **Licence:** our app is free and non-commercial, so the free licence applies. **Credit:** "3D-Icons: thiings.co" with a link, in the footer, under Settings → about, and in the README. **Records:** each icon is downloaded individually, with its source URL and date logged in `docs/icon-credits.md`. Icons are used inside the app only, never offered for download. |
| Names | — | The app name stays "DaF & Mind Leitner". No "Austria", "Embassy" or "Kulturforum" in the name or logo. The Cultural Forum is only named in the factual credit line, followed by the disclaimer. |

### Cultural sensitivity

The audience is in Tehran, so these stay out:
- alcohol (beer, wine, schnapps);
- pork;
- religious symbols (summit crosses, church buildings such as Stephansdom as icons);
- blackletter / Fraktur fonts, which carry historical connotations.

### Disclaimer

Placed under the credit line on the loading screen, the login screen and in Settings. German, always shown:

> Unabhängiges, ehrenamtliches Projekt – kein offizielles Angebot des Österreichischen Kulturforums oder der Österreichischen Botschaft.

A Persian or English translation follows, depending on the interface language.

## Visual system

### 1. Colours: signage colours + red-white-red

The app currently uses indigo as its main colour. It moves to colours taken from public signs. The RAL values below are approximations; the exact sRGB values are checked during implementation.

| Role | Inspiration | Approx. | Where |
| --- | --- | --- | --- |
| **Primary** | Traffic blue (RAL 5017, information and motorway signs in AT/DE) | `#005387` | Buttons, links, active navigation |
| **Austria accent** | Red of the flag (often given as Pantone 186 C) | `#C8102E` | Red-white-red stripe, trail markers, decorative details. **Never** for buttons or states. |
| Success | Traffic green (RAL 6024) | `#008754` | "Got it" / "Knew it", correct answers |
| Warning / due | Traffic yellow (RAL 1023) | `#F7B500` | Due today, the back button |
| Error | Darker red in the rose range (distinct from the brand red) | — | Wrong answers. Always with an icon (✕) and text, never colour alone. |
| Neutral | Asphalt grey and white | — | Text, surfaces |
| Germany (sparingly) | Black-red-gold | — | Only small details (e.g. a German fact on a silver card) |

**Technique:** Tailwind v4 lets us redefine the indigo scale in `@theme`, so every existing `indigo-*` class adopts traffic blue without hundreds of edits. A light and a dark scale are both defined.

**Contrast:** all text/background pairs must reach WCAG AA (4.5:1), in light and dark mode. Traffic blue on white is about 8:1.

**Brand red vs error red:** red already means "wrong" in the app. The brand red therefore appears only as a stripe or mark, never as a status colour, and error states always carry an icon.

### 2. Red-white-red stripe

- A thin stripe (3px, red | white | red) at the top of the header, below the phone's safe area. It also appears on the loading screen and at the top of popups.
- **Dark mode:** the white part becomes a light grey, so it doesn't glare.
- **RTL:** the stripe is symmetric, so nothing changes.
- **Not the flag:** it is a stripe, not a flag, so there is no confusion with a state symbol.

### 3. Leitner boxes as a trail to the summit (Austrian trail markers)

On Austrian hiking trails, the route is marked with **red-white-red** blazes (an Alpine club convention, not a state emblem). The Leitner boxes become one route:

| Box | Name | Interval |
| --- | --- | --- |
| 0 | Valley (Tal) | 1 day |
| 1 | Pasture (Alm) | 2 days |
| 2 | Forest edge | 4 days |
| 3 | Hut (Hütte) | 8 days |
| 4 | Ridge (Grat) | 16 days |
| 5 | Summit (Gipfel) | 32 days |
| Archive | Summit book (Gipfelbuch) | mastered |

- **On each box:** a small trail marker (a red-white-red bar) and an altitude line.
- **Dashboard:** a mountain silhouette (our own simple SVG) shows how many cards are at each height. On phones it falls back to a simple list.
- **No summit cross:** a summit **flag in red-white-red** is used instead.
- **The overdue rule:** it fits the metaphor ("a card that waits too long slips back one stage").
- **Names are decoration only:** the stage names appear only in the mountain illustration on the dashboard. Box labels everywhere else (cards, rules, popups, notifications) stay "Box 0 … Box 5".

### 4. Signage components (inspired, not copied)

- **Section headings as sign plates:**
  - a blue plate with white text and a pictogram, like information signs, with rounded corners and generous padding;
  - used only for main headings ("Leitner boxes", "Leaderboard"), not everywhere.
- **Session progress as a station display:**
  - "Station 12 of 37" with a line and dots, inspired by stop displays in Vienna;
  - our own colours, **no Wiener Linien logo**, no "U" square.
- **Lessons on the dashboard (phase 5):**
  - the 30 lessons as stations on one line (a metro map), coloured by level (A1, A2, B1), with a "you are here" marker;
  - tapping a station opens the word list filtered to that lesson;
  - finished lessons are filled, the current one is highlighted;
  - the RTL direction is respected (the line starts on the right in Persian);
  - on phones the line runs vertically.
- **Stamps in the swipe cards** become round sign shapes:
  - "Got it": a green round sign with a tick;
  - "Skip": a white round sign with a red border, like a "no entry" sign but **with no traffic meaning or traffic symbol**.

### 5. 3D icons (thiings.co) where they add warmth

| Place | Icons (examples, to be checked on the site) |
| --- | --- |
| Silver cards | One icon per fact instead of the emoji (coffee cup, Ferris wheel, piano/notes, book, pretzel, mountains, edelweiss, alarm clock …) |
| Empty states | "All done today", "All words added", empty archive |
| Popups | Overdue (an hourglass), silver card earned (a medal) |
| Dashboard | A small coffee house scene next to the greeting |

**Rules:**
- **Pick by hand:** every icon is checked by eye. AI icons can contain errors (wrong flags, odd text, brand logos); anything with text, flags, logos, alcohol, pork or religious symbols is rejected.
- **Formats:** WebP (with a PNG fallback), at most about 128px at 2×, about 10 KB each, loaded lazily.
- **Accessibility:** the icons are decorative, so `alt=""` and `aria-hidden`; meaning always lives in the text.
- **Credit:** see the legal table.
- **Downloading:** I fetch each icon individually from thiings.co and log its source URL and date in `docs/icon-credits.md`.

### 6. Typography

| Text | Font |
| --- | --- |
| Persian | **Vazirmatn**, unchanged |
| Latin interface | Plus Jakarta Sans, unchanged |
| **Numbers, box labels, station displays, plate headings** | **D-DIN** (Datto, SIL OFL licence): a free typeface in the style of DIN 1451, the classic German signage font. Self-hosted, Latin only. |
| German words on cards | Unchanged (readability first) |

### 7. App icon and PWA

- **New icon:** "L" on traffic blue with a thin red-white-red stripe.
  - No eagle, no flag, no ÖKF shapes.
  - Regenerate the 192 and 512 icons, the maskable icon and the Apple icon.
- **Theme colour:** `theme-color` and `manifest.webmanifest` move to traffic blue.
- **Notification icon:** the same.

## Corner cases

| Case | Handling |
| --- | --- |
| Looking official | Disclaimer; no state symbols, logos or official fonts; no "Republik Österreich"; no forms or stamps in an official style |
| Brand red vs error red | Brand red only decorative; errors always with icon and text |
| Dark mode | Separate colour scale; stripe in light grey instead of white; contrast checked |
| Colour-blind users | Status never by colour alone (icons, labels) |
| RTL | Stripe symmetric; metro line starts on the right; the arrows of the station display follow the reading direction |
| Phones from 320px | Mountain silhouette falls back to a list; plate headings wrap; the metro line runs vertically |
| Performance | Icons small and lazy; font self-hosted with subset and `font-display: swap`; no external requests |
| Flags | Drawn exactly as SVG (AT 3 equal horizontal stripes, red-white-red; DE black-red-gold), never from AI images |
| AI icons | Checked by hand; credit; list of sources |
| Cultural sensitivity | No alcohol, pork, religious symbols or Fraktur |
| Box names | Decoration on the dashboard only; everywhere else the box labels stay as they are |
| Existing users | Purely visual: no data or database changes; no change to how the app works |
| Accessibility | Decorative images hidden from screen readers; focus outlines in the new primary colour |

## Phases

1. **Foundation:**
   - colour system (traffic blue scale, light and dark), red-white-red stripe;
   - disclaimer;
   - D-DIN for numbers and labels;
   - new app icon / PWA colours.
2. **Trail metaphor:** box names and trail markers, mountain silhouette on the dashboard, summit flag for the archive.
3. **Signage:** plate headings, station display in the sessions, round sign stamps.
4. **3D icons:** silver cards, empty states, popups (after deciding who downloads the icons), plus the credit page and `docs/icon-credits.md`.
5. **Metro map of the lessons** on the dashboard.

Each phase:
- one PR, tested in light and dark mode, Persian and English, 320, 390 and 1280px;
- visual checks with screenshots;
- deployed to production only after your approval.

## Decisions on the open questions

1. **Primary colour:** indigo goes away completely; traffic blue becomes the primary colour.
2. **Mountain names:** decoration on the dashboard only. Box labels stay "Box 0 … Box 5" everywhere else.
3. **3D icons:** I fetch them one by one from thiings.co (free licence, individual downloads, credit "thiings.co").
4. **Metro map of the lessons:** yes, **on the dashboard**. Tapping a station opens the word list filtered to that lesson. New words are still offered in book order: no "start from this lesson" option.

## Sources (legal check)

- [Wappengesetz §7 (jusline)](https://www.jusline.at/gesetz/wapg/paragraf/7.pdf)
- [Wappengesetz §8 (jusline)](https://www.jusline.at/gesetz/wapg/paragraf/8.pdf)
- [Wappengesetz full text (gesetzefinden.at)](https://gesetzefinden.at/bundesrecht/bundesgesetze/10000782)
- [§ 124 OWiG (gesetze-im-internet.de)](https://www.gesetze-im-internet.de/owig_1968/__124.html)
- [Use of the federal coat of arms (IT-Recht Kanzlei)](https://www.it-recht-kanzlei.de/verwendung-bundeswappen-hoheitszeichen.html)
- [thiings.co terms](https://www.thiings.co/terms)
