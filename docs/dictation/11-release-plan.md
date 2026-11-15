# 11. Release plan

One release to all users, with a visible **Beta** label, as decided in the brief. "One release" means one production
deploy after which every signed-in user sees the Dictation tab. Risk is managed by what ships dark first and by the
switches that exist, not by staged audiences.

## Feature scoping

| In the Beta | Out of the Beta (later) |
|---|---|
| Stories 1 and 2, 12 sequences, about 960 sentences | Stories 3 to 10 (content tasks after the Beta) |
| Audio modes A, B, C with fallback | Offline "download story" |
| Strict checker, ä ö ü ß buttons, feedback highlights, praise | Spelled-out numbers accepted as correct |
| Manual add and move back from the feedback view | Leitner actions on skipped sentences, bulk "add all mistakes" |
| Grammar drawer for blocks 1 and 2 | The three comprehension questions per sequence, transcript mode |
| Progress, resume across devices, drafts per device | Restart a story, progress in the JSON backup, leaderboard or streak effects, push reminders for dictation |

Dictation does not touch the leaderboard, streaks, silver cards or reminders. It writes to `cards` only through the two
explicit Leitner buttons.

## Beta label and communication

- Badge text "Beta" (Persian "آزمایشی") on the tab, the story list and the dictation header; the intro dialog on first
  visit (`dictationIntroSeen`) says: this is new, audio comes in three modes, checking is strict, nothing changes your
  box unless you press a button, and where to report problems.
- A "Report a problem" link opens the existing GitHub issue template with the sentence id and mode in the title.
- No announcement push notification in the Beta. A short release note on the dashboard card only.

## Release sequence

1. **Dark deploy.** Production DB migration applied by the owner through `docs/supabase-dictation-setup.md` (additive, with
   before and after row counts). Media uploaded to `story-media`. `app_flags.dictation_enabled` set to `false`.
   Deploy the new app (`vercel deploy --prod`). Existing features are verified unchanged (login, review, sync, new words).
2. **Owner smoke test in production** with the real account: both stories, all three audio modes, one device of each
   class (the manual matrix subset in `13-test-plan.md`). The flag is still false for others; the owner's check uses a
   local override (`?dictation=1` honored only when the signed-in user is an admin, `profile.isAdmin`).
3. **Flip.** `update public.app_flags set value = 'true', updated_at = now() where key = 'dictation_enabled';` Everyone sees
   the tab on their next load. This is the release moment.
4. **Watch** for 72 hours with the monitoring queries below; a person is on hand for the first 24 hours.
5. **Decide** to keep, fix forward, or switch off.

## Monitoring (no new tooling required)

Console errors alone cannot be seen in production, so the Beta adds the small `dictation_events` table
(`09-data-model.md`) and owner SQL in the setup document:

| Question | Source | Alarm threshold |
|---|---|---|
| Are people using it | `story_progress` rows created per day, active users per day from `last_active_at` | informational |
| How far do they get | `finished_count / total_count` per user and story | informational |
| Skip rate | `skips > 0` rows over finished rows | above 35 percent per story suggests content or audio trouble |
| Mistake rate | `mistakes / attempts` | informational; very high on one sentence means a content or audio defect on that sentence |
| Audio problems | `dictation_events` of type `audio_fallback` and `audio_failed` grouped by mode, detail and client | `audio_failed` above 2 percent of plays, or any 404 spike, means a missing upload or a bad file |
| Sync problems | `save_failed` events | any sustained rise |
| Hot sentences | sentences with the highest `skips` and `attempts` | list reviewed daily in week one, fixed through content PRs |
| Storage egress and size | Supabase dashboard usage | 70 percent of the plan quota (Open Question 8) |
| Existing features regress | owner checks review, sync, leaderboard on the day of the flip, and Supabase advisors | any new error |

## Rollback levels (fastest first)

1. **Kill switch, instant, no deploy.** `app_flags.dictation_enabled = false` hides the tab and shows the paused state.
   Data stays. Used for anything user-facing and serious (wrong audio, crashes, data worries).
2. **Redeploy the previous version.** Vercel CLI deploys are immutable deployments: promote the previous production
   deployment (`vercel rollback` or `vercel promote <previous-url>`), which removes the code without touching data.
3. **Content rollback.** Revert the content PR and redeploy; media is content-addressed and immutable, so nothing in
   Storage needs reverting, and a bad file is simply no longer referenced by the index.
4. **Database.** Nothing to roll back: the new objects are inert without the app. The drop script exists only for
   abandoning the feature and deletes only dictation progress and events.

A rollback never affects Leitner cards created or moved through the Beta: those are normal cards. If a user used Move
back in error, they use the in-app Undo or the existing box controls.

## Exit criteria for the end of the Beta (suggested)

Two weeks with no data-integrity issues, audio failure rate under 1 percent, no unresolved high-severity feedback, the
hot-sentence list empty, and the owner decides to remove the badge and the flag check in a normal release.
