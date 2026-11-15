# Checklist: deploy and operations work

For the owner (and Claude Code under the owner's explicit instruction). Production has real users: every step marked
**PROD** is done deliberately, by the owner or on their exact instruction, and nothing here is run by an agent against
production on its own. Order matters: database, then media, then app, then flag.

Reference: `11-release-plan.md`, `09-data-model.md`, `05-audio.md`.

## A. Preparation (no production contact)

- [ ] All items in `CHECKLIST-dev.md` through Phase 7 are ticked, and the PRs are merged to `main`
- [ ] `scripts/test-sql.sh` green locally (migration twice, RLS tests, existing tests)
- [ ] Final content built and committed: `public/data/stories/index.json`, `story-01.json`, `story-02.json`, audio indexes for modes A and B
- [ ] Audio QA report (`audio-qa.md`) shows zero failures; listening sample signed off
- [ ] Setup document `docs/supabase-dictation-setup.md` is on the `main` branch, readable at its GitHub raw URL, and the migration file path in it is correct
- [ ] Known secrets are absent from the build: `dist/` search for `service_role`, `sk_`, `ELEVEN` returns nothing
- [ ] Previous production deployment URL noted (for rollback by promotion)
- [ ] A person is available for the first 24 hours after the flip
- [ ] Decide the release date outside the owner's travel or class days; avoid Friday evening

## B. Production database (PROD, owner runs the setup document in the Supabase dashboard)

Follow `docs/supabase-dictation-setup.md` step by step; stop and report on any error.

- [ ] B1 Read-only before checks: card count, profile count, `review_events` count (write the numbers down)
- [ ] B2 Run the full migration `2026MMDD_story_dictation.sql` (additive; no existing row changes)
- [ ] B3 Read-only after checks: the three counts equal the before numbers; the new tables exist with RLS enabled; the new functions exist
- [ ] B4 Insert the flag row **off**: `insert into public.app_flags (key, value) values ('dictation_enabled', 'false') on conflict (key) do update set value = 'false';`
- [ ] B5 Run Supabase security and performance advisors; no new warnings caused by the migration
- [ ] B6 Confirm existing features still work on the production app (current version): sign in, review a card, sync dot green

## C. Production Storage (PROD)

- [ ] C1 Create bucket `story-media`: public read, file size limit 2 MB, allowed types `audio/mpeg` and `image/webp`, no insert, update or delete policies for `anon` or `authenticated`
- [ ] C2 Run `upload_media.py 01 --dry-run`, review the list (counts: audio files for A and B, 6 images per story)
- [ ] C3 Run the real upload for story 01 with `--target <production-project-ref> --yes`; service-role key from the shell only; then story 02
- [ ] C4 Verify by hand: open three audio URLs and one image URL in a browser (200, correct type, `Cache-Control` shows the long max-age)
- [ ] C5 Verify CORS: a `fetch` from the production origin (browser console on the app) to an audio URL succeeds
- [ ] C6 Count objects in the bucket equals the index entries (A, B, images); no stray files
- [ ] C7 Confirm Storage usage is far below the plan limit (Open Question 8)

## D. App deploy (PROD)

- [ ] D1 `main` is the commit to release; `npm run build` passes locally one more time
- [ ] D2 Deploy: `vercel deploy --prod` (CLI based; the project is not connected to GitHub). The merge step needs the owner's literal request: "merge PR #N with admin and deploy to production"
- [ ] D3 Open the production site with a normal account: the Dictation tab is **not** visible (flag off), everything else unchanged
- [ ] D4 Admin preview: sign in as the admin account and open `?dictation=1`; the tab appears for the admin only

## E. Owner smoke test in production (flag still off for everyone else)

- [ ] E1 Story 1, sequence 1: Start plays audio; type a sentence correctly (praise), with errors (marks), skip one, replay a history sentence
- [ ] E2 Modes A, B and C each play; Test buttons work in Settings; the fallback note appears when a mode is unavailable
- [ ] E3 Leitner: add a word, move back a card, undo; verify in Review that no other card changed; verify skipping changed nothing
- [ ] E4 Progress: finish three sentences on the phone, open the laptop, resume at the right sentence
- [ ] E5 Grammar drawer: open, collapse, reload (persists), phone sheet behavior
- [ ] E6 iPhone Safari and one Android Chrome check (autoplay unlock, umlaut buttons, keyboard layout)
- [ ] E7 `dictation_events` and the progress tables received rows (owner SQL in the setup document); no `save_failed` events
- [ ] E8 Go or no-go decision recorded

## F. Release moment (PROD)

- [ ] F1 Flip the flag on: `update public.app_flags set value = 'true', updated_at = now() where key = 'dictation_enabled';`
- [ ] F2 Reload as a normal (non-admin) account: the Dictation tab and Beta badge appear
- [ ] F3 Post the short release note (dashboard card text); no push notification in the Beta
- [ ] F4 Note the time of the flip in the release log

## G. Watch (first 72 hours)

Run the monitoring queries from the setup document at 1 hour, 6 hours, 24 hours and 72 hours.

- [ ] G1 Usage: users who opened a story, finished sentences per day
- [ ] G2 Audio failures and fallbacks by mode and client (`dictation_events`): `audio_failed` under 2 percent of plays; no 404 spike
- [ ] G3 Save failures: none sustained
- [ ] G4 Skip rate per story under 35 percent; hot-sentence list reviewed
- [ ] G5 Storage egress and database size within plan; advisors clean
- [ ] G6 Existing features: review, sync, leaderboard, reminders unaffected (spot check a test account and the Supabase logs)
- [ ] G7 Feedback issues triaged the same day
- [ ] G8 Day-3 decision recorded: keep, fix forward, or switch off

## H. Rollback (use the fastest level that solves the problem)

- [ ] H1 **Kill switch** (instant): `update public.app_flags set value = 'false', updated_at = now() where key = 'dictation_enabled';`
- [ ] H2 **Previous version**: promote the previous production deployment (`vercel rollback` or `vercel promote <previous-url>`)
- [ ] H3 **Content**: revert the content PR, redeploy; media is immutable, nothing to revert in Storage
- [ ] H4 **Database**: do nothing; the objects are inert. The drop script in the setup document is only for abandoning the feature
- [ ] After any rollback: verify review and sync on a real account; tell the owner what changed

## I. Routine operations after the Beta starts

- [ ] I1 Prune events monthly: `delete from public.dictation_events where created_at < now() - interval '60 days';`
- [ ] I2 Audio regeneration for a corrected sentence: edit the Markdown or override, rebuild, `gen_audio.py`, `upload_media.py` (dry run first), PR, deploy; old keys stay for at least 30 days
- [ ] I3 Orphan cleanup: `gen_audio.py --gc` lists unreferenced keys; delete only with `--delete` and only keys older than 30 days
- [ ] I4 Adding a story (3 to 10): follow "Onboarding a new story" in `04-content-pipeline.md`; upload media before deploying the new index
- [ ] I5 Rotate the provider API key and the service-role key if they are ever pasted into a chat, a log or a file
- [ ] I6 Remove the Beta badge and the flag check in a normal release after the exit criteria (`11-release-plan.md`)
