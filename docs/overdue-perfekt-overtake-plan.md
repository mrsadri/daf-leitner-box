# Overdue rule, Perfekt guide, leaderboard notification, cleanup

## 1. Overdue cards move back one box

**Today:** an overdue card simply stays due until it is answered. There is no penalty.

**New rule (user's wording):** a card whose review is due and that is not reviewed for 3 days moves to the
*start* of the previous box. Example: a box-3 card due on day D and not reviewed on D, D+1, D+2 moves on
day D+3 to box 2, with its next review on D+3 + 4 days (box 2's interval).

- **Scope:** all cards (vocab and reflection) in boxes 1–5. Box 0 can't go lower and stays due. The archive (box 6) has no due date.
- **Long absences:** the rule repeats. Example: box 5, due 40 days ago:
  - D+3 → box 4, due D+19
  - D+22 → box 3, due D+30
  - D+33 → box 2, due D+37
  - D+40 → box 1, due D+42.

  The result depends only on (box, due date, today), so it is the same whenever and wherever it is computed.
- **Applies now, retroactively, to everyone.** It runs on the server (pg_cron, daily 00:05 Tehran time,
  plus one run at setup). That way users who never open the app also drop on the leaderboard, whose score
  is the sum of box numbers.
- **Safe update:** a card is changed only if its box and due date are still what the run read. A review saved in
  the meantime is never overwritten. No review events are written, so the weekly score and streaks are untouched.
  There is a dry-run mode for checking the effect first.
- **Popup:** the server logs each move (`overdue_demotions`). On the next app start an affected user sees a popup
  with what happened and why:
  - how many cards moved, grouped by "box X → box Y", and a few example words;
  - the rule.

  The first popup also introduces the rule as new. It shows once per batch; closing it marks the rows seen
  (RPC), so it doesn't come back on another device. Seen rows are deleted after 60 days.
- The app keeps working if the database part isn't installed yet: the popup query fails silently.
- The dashboard rules list gets the new rule.

## 2. Perfekt guide (verbs in boxes 0–2)

**Groups**, computed from infinitive and participle (`explainPerfekt`, tested over all 748 verbs):

| Group | Pattern | Example |
| --- | --- | --- |
| regular (schwach) | ge + stem + t / et | machen → gemacht, arbeiten → gearbeitet |
| irregular (stark) | ge + stem (often new vowel) + en | gehen → gegangen, sehen → gesehen |
| mixed (gemischt) | ge + changed stem + t | bringen → gebracht, kennen → gekannt |
| separable | prefix + ge + … | anrufen → angerufen, einkaufen → eingekauft |
| inseparable prefix | no ge | besuchen → besucht, verstehen → verstanden |
| -ieren | no ge, ends in t | studieren → studiert |

**Auxiliary:**
- sein for movement from A to B, change of state, and sein / bleiben / werden / passieren; haben otherwise;
- reflexive verbs always take haben;
- where the data accepts both (e.g. stehen), the note says that in Austria sein is used.

**Display:**
- **Review, boxes 0–2:**
  - before answering, a "Hint" button shows the group and its pattern, without the participle and without the auxiliary;
  - after answering, the full explanation: the participle split into colored parts (an | ge | ruf | en), the group, and why that auxiliary.
- **New-words session:** the full explanation is shown with the Perfekt (one-sided card), or after the practice answer (two-sided card).
- **Boxes 3–5:** no hint and no explanation.

## 3. Notifications

- **Class-break reminder (Sat–Wed 09:30):** removed. Its columns stay in the database unused; nothing is dropped.
- **Inactivity reminder:** kept as it is.
- **New: "someone passed you on the leaderboard":**
  - **Who gets it:** users who are visible on the leaderboard, have a score above 0, have reminders on, and haven't turned this notification off. A new switch in Settings → Notifications is on by default and stored in `profiles.settings.notifyOvertake`.
  - **Which table:** the all-time table.
  - **How it's detected:** the cron function (every 15 min) compares the user's current rank with a stored baseline rank (`push_state.overtake_rank`). Rank improves → the baseline follows silently. Rank gets worse → notify, e.g. "2 people passed you, you're now #7".
  - **When:** at most once per local day, 10:00–21:00 in the device's time zone. Outside that window the baseline isn't moved, so the notification goes out later only if the user is still behind.
  - **Visibility:** a user who hides from the leaderboard has their baseline cleared, so turning visibility back on doesn't trigger a notification.
  - **Spacing:** an overtake and an inactivity reminder are at least 2 hours apart.
  - **Opening it:** tapping the notification opens the leaderboard (`/?go=leaderboard`).
- **Settings text:** reminder texts are updated (no class reminder any more).

## 4. Cleanup (from the annotated screenshot)

- **Dashboard:**
  - remove the badges line under the title and the subtitle;
  - remove the "noun distribution & article mastery" block;
  - remove the "consolidated in memory" and "overall mastery rate" figures;
  - in each box card, remove the "2ⁿ = n days" badge and the "due today: N" row (the review button already shows the count).
- **Review screen:** remove the noun-mode switch. The setting stays only in Settings, renamed to "Noun-only mode" since it is no longer a default. The "show all cards" button on the empty noun queue applies to that session only.

## Database changes (additive; the user runs them in Supabase via Claude Desktop)

`supabase/migrations/20261030_overdue_overtake.sql`:
- **Table** `overdue_demotions`: RLS, own rows readable.
- **Functions:**
  - `apply_overdue_demotions(p_dry_run)`, cron only;
  - `mark_overdue_demotions_seen()`, users;
  - `leaderboard_ranks()`, service role only.
- **Columns:** `push_state.overtake_rank` and `push_state.last_overtake_at`.
- **Cron job** `daf-overdue-demotions`, plus the first run.

**Edge Function `send-reminders`:** redeploy with the new code.

**Order:**
1. Run the migration: dry run first, then the real run.
2. Redeploy the Edge Function.
3. Deploy the frontend.

The frontend tolerates each step being missing.

## Tasks

- [x] Dashboard + review cleanup, settings rename (fa/en)
- [x] `explainPerfekt` + unit tests over all verbs; hint / explanation UI in review and new words
- [x] Migration SQL; test on a local Postgres 16 with a stub `auth` schema (rule examples, chained drops, box 0, archive, concurrency guard, dry run, idempotency, popup RPC, ranks)
- [x] Popup in the app (summary, examples, why; mark seen), rules list entry
- [x] Edge function: remove class reminder, add overtake logic (`reminders.ts` pure logic + tests), regenerate `index.ts`, Deno check
- [x] Settings: overtake switch; reminder texts; notification click → leaderboard
- [x] Supabase instructions for Claude Desktop (`docs/supabase-overdue-overtake-setup.md`)
- [x] tsc, unit tests, build, Playwright demo e2e (fa/en, mobile/desktop)
- [ ] PR, CI, merge, production deploy, live smoke test
