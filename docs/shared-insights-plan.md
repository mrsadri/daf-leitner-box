# Public insight cards

## Request
A user wrote: «کاش می‌شد کارت‌های insights مون رو با اعضا به اشتراک بذاریم».

The idea:
- For every 256 points, a user may make one of their insight cards public.
- Others can browse public cards and add them to their own boxes.
- The author sees whose boxes the card is in.
- While public, the author can't edit or delete it.
- Once unpublished, it stays in others' boxes, but without the author's name.

## Decisions (from the user)
- **Quota:** a user may make `floor(current score ÷ 256)` publications in all. The score is the leaderboard score: the sum of box numbers over all cards.
  - Every publication counts for good. Unpublishing, or an admin takedown, does not give the slot back.
  - If the score falls, public cards stay public, but no new one can be published until the score is back up.
- **Names:** the author sees the names of the people who added the card.
  - Before adding, the adder is told the author will see their name.
  - Adders hidden from the leaderboard appear as «یک کاربر ناشناس».
- **Moderation:** every public card has a "report" button.
  - Reports appear on the admin page.
  - An admin takedown unpublishes the card **and removes all copies from everyone's boxes**. This is the one exception to "stays in others' boxes".
- **Copies:** an added card is read-only. The adder can only remove it from their box, which also takes them off the author's list.

## Defaults I chose (open to change)
- **What can be published:** only the user's own insight cards. Words and cards added from others can't be published.
- **Size limits:** title at most 120 characters, text at most 1500 for a public card. A longer card must be shortened first, since a public card can't be edited.
- **The public version is a fixed copy** (snapshot) stored on the server at publish time. It never changes.
  - Each adder gets their own copy in Box 0, due today.
  - So nothing the author does to their own card can change other people's boxes.
- **The author's own card:** while public it shows a «عمومی» badge, and edit and delete are hidden.
  - "Reset progress" or restoring a backup can still remove the author's own private card. The public version stays, and the author can still unpublish it from «منتشرشده‌های من».
- **The author's name** is shown on the card even if they are hidden from the leaderboard. The publish dialog says so and shows the name.
  - It is read live, so a name change shows everywhere. After unpublishing, the name disappears from all copies.
- **Republishing:** after unpublishing, the author can publish the same card again. That is a new publication and uses a new slot.
- **Auto-hide:** a card with 3 reports from different people is hidden from the public list until an admin checks it.
  - The admin can either keep it (reports cleared, visible again) or remove it.
  - With few active admins, this is a safety net.
- **Suspended accounts:**
  - a suspended author's cards are hidden from the list, and their name is not shown on copies;
  - suspended adders are not listed to the author.
- **Deleted accounts:** the author's publications are deleted. Copies stay in others' boxes without a name, like an unpublish.
- **No notification** to the author when someone adds the card. This could be a follow-up push.
- **Points:** an added copy is a normal card of the adder, so it counts towards their score like any insight card.
- **No reshare:** an adder can't publish a copy they added.

## Corner cases
| Case | Behaviour |
|---|---|
| Two taps on "publish" at once / two devices | Per-user lock on the server; the quota is checked inside the lock |
| The card's latest edit hasn't reached the server yet | Pending changes are sent first; the server publishes what is stored for the card. "Not found" means offline / not saved yet |
| Card already public | Server refuses (one live publication per card) |
| Score below the next threshold | Publish button disabled, showing "x more points for the next publication" |
| Author unpublishes while someone is adding | The add checks "still public" inside the server call, so it fails cleanly ("this card is no longer public") |
| Adding the same card twice / on two devices | The copy's id is `shared_<public id>`, which can only exist once per user |
| Adding your own card | Refused ("this is your card") |
| Adder removes the copy, then adds it again | Allowed while it is public |
| Copy forged by writing straight to the cards table | A trigger silently drops new `shared_…` rows that don't come from the add call, so nobody appears in an author's list without really adding |
| Admin takedown while an adder's app is open | The copy is deleted on the server. The open app may still show it until the next load. If that app saves it again (review), the trigger drops the write, so it doesn't come back. The sync queue never gets stuck (no error, just skipped) |
| Backup restore containing a removed or deleted copy | Silently skipped, as above |
| Offline | Browse, add, publish and report need a connection; a clear message is shown. Reviewing copies works offline like any card |
| Adder suspended / hidden | Not listed / listed as anonymous |
| Author deleted | Publications go away; copies stay, nameless |
| Very long words / mixed Persian–German text | `dir="auto"`, `overflow-wrap:anywhere` |
| Reporting your own card / reporting twice | Refused / counted once |
| Many public cards | The list is paged (30 at a time, newest first) |
| The old reflection rules (overdue, leaderboard) | Unchanged: copies are ordinary insight cards |

## Server (new migration `20261101_shared_insights.sql`, additive only)
- **Table `shared_insights`:** id, author, source card id, title, content, category, published_at, unpublished_at, removed_at, reviewed_at.
  - Partial unique index: one live publication per card.
- **Table `insight_reports`:** one per reporter per card, with an optional reason (at most 300 characters).
- RLS is on for both, with no direct access. Everything goes through SECURITY DEFINER functions.
- **Functions:**
  - `share_quota`, `publish_insight`, `unpublish_insight`;
  - `get_public_insights`, `adopt_insight`, `my_insights`, `insight_attribution`, `report_insight`;
  - admin: `admin_list_insights`, `admin_remove_insight`, `admin_keep_insight`.
- **Trigger** on `cards` (before insert, only for `shared_…` ids) and a small partial index on `cards(id)` for those ids.
- **No change to existing rows or functions.**

## Checklist
- [x] Plan and corner cases (this file)
- [x] Migration + local SQL tests (quota, races, adding, triggers, takedown, report hiding, permissions)
- [x] Client service (+ demo-mode fake for local testing) and pure quota logic + unit tests
- [x] Insights page: tabs «کارت‌های من» / «کارت‌های عمومی» / «منتشرشده‌های من»; publish and unpublish dialogs; read-only copies with author name; locked public cards
- [x] Public list: add (with name notice), report, "already in your box", "your card"
- [x] Author name on copies in review
- [x] Admin page: public cards, reports, keep / remove
- [x] fa / en strings
- [x] Unit + SQL + Playwright e2e (fa/en, 390px, desktop); regressions
- [x] Claude Desktop instructions: `docs/supabase-shared-insights-setup.md`
- [ ] PR, CI, migration on the real project, merge, production deploy, live check
