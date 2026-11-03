# Silver cards collection: earned cards were squashed

## Bug
In «کارت‌های نقره‌ای من», earned cards showed as thin strips (34px instead of 126–171px): text and icon were cut off. This happened on every screen size and with any number of earned cards. Locked tiles looked normal.

## Root cause
- The card grid was itself the scrolling area, inside a dialog limited to 90% of the screen height, so the grid got a fixed height.
- In CSS Grid, an item that clips its overflow (`overflow: hidden`, which the card face has so long words stay inside) has a minimum height of 0.
- With the height limited, the browser kept the locked tiles at their content height and shrank the earned cards to fit.
- The bug dates from when silver cards were added (6ec9b6f).

## Why the tests missed it
- The screenshot test for all 30 cards removed the dialog's height limit to capture everything, which also removed the condition that causes the bug.
- The other test only counted the locked tiles and never measured an earned card.

## Fix
- **Scroll on a wrapper:** scrolling moved to a plain block wrapper (`min-h-0 flex-1 overflow-y-auto`), so the grid no longer has a fixed height. The header doesn't shrink (`shrink-0`).
- **New layout (agreed with the user):** earned cards in full on top. The locked ones become small numbered tiles in one compact block, with a heading «هنوز بازنشده (n)» and a label per tile («کارت ۵، هنوز بازنشده»).
- **Bad totals:** a negative, too large or non-numeric total is clamped to 0–30 (`collectionSlots`, unit-tested).
- **Complete collection:** at 30 the "complete" message is shown in the collection too.
- **Other dialogs:** they scroll in plain block layout and don't have this problem. They are checked by the same test.

## Tests
- **Unit:** `collectionSlots` (earned/locked split, clamping).
- **Browser** (`silver-collection-e2e`):
  - 0, 1, 3, 15, 29 and 30 cards at 1414×842, 390×844 and 844×390 (landscape);
  - every element that clips its overflow must show all its content; every earned card at least 90px tall;
  - the last item can be scrolled into view, the header stays visible, no horizontal scroll;
  - English dark mode, Escape, tile labels, clamped totals;
  - the same clipping check on the overdue notice and the box list dialog.
- The test was first run against the old code and failed there, then passed with the fix.

## Checklist
- [x] Reproduce with measurements, confirm the cause (wrapping the grid fixes it in the browser)
- [x] Fix + compact locked tiles + strings (fa / en)
- [x] Unit + browser tests (fail before, pass after), regressions
- [ ] PR, CI, merge, production deploy, live check
