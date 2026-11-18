# November 18 backlog release candidate

Base: `519a905` (main after PR37). This candidate implements the owner-approved requests recorded in `request-investigation-plan-2026-11-18.fa.md`.

## Implemented

- Removed the technical sync/offline banners from the signed-in study layout. Existing navbar status and settings recovery tools remain available.
- Speech retains all slash-separated German alternatives and pauses at comma/parenthesis boundaries; cancellation settles the previous request, and a timeout releases the button if the browser never fires completion.
- Each noun alternative uses its own explicit article. Story JSON was rebuilt; ambiguous articles keep their conservative handling.
- Catalog study queues use stable card IDs, including repeated words in different lessons. Lesson completion requires every word to have at least one review; a wrong answer counts as a review.
- Adjective summary shows the caller's rank in the selected board. Server ordering compares the top three scores with shared rank for complete ties. Snapshot legacy runs remain eligible.
- Added the book “راز عکسی از گراتس”, containing the existing ten stories with six scenes each. Existing content filenames and scene IDs remain compatible; domain types describe book, story and scene.
- Completing a scene's three-question quiz displays its sentence award using the existing Thiings trophy. The private server reward record is unique per user/scene and freezes the initial catalog points.
- Total = sum of current card boxes + completed scene points. Overtake notifications use the same total. Balance is signed card movements over 168 hours, including insert/delete/manual/overdue changes after migration.
- Silver and streak calculations include snapshot legacy review IDs and newly verified activity. Streak accepts positive movements, scene completion and positive adjective runs; clients register their local timezone.

## Validation

- 235 Node unit/integration tests passed.
- 30 Python content tests passed; generated story content is current.
- 70 Playwright checks passed in Chrome on phone/desktop, Persian/English, including quiz award and recovery/navigation paths.
- TypeScript/oxlint passed; production build passed.
- Isolated SQL suites passed with migration replay and negative authorization control, including the new legacy recovery/scene reward/balance regression.
- Clean-install and upgrade schemas, permissions, policies, triggers and functions matched.
- Generated database types matched. Runtime dependency audit: zero reported vulnerabilities.

## Publication sequence and remaining operator actions

1. Follow `supabase-reward-recovery-setup.md` to reconcile the snapshot, apply the migration transaction and inspect totals before committing. This candidate has not modified production.
2. Review a demo preview and the restored values for returning and hidden accounts. Verify real browser speech on the affected Android device; automated normalization and Chrome navigation checks cannot establish the quality of each OS speech engine.
3. Merge/deploy after the repository's owner release authorization, then verify production account sync and cross-device completion.

Historical limitations: existing review_day preserves local review dates, but some old manual/import/demotion events have no exact timestamps. Before cutover, balance uses accepted review receipt timestamps; after cutover every card balance movement is recorded by the server. Do not invent missing historical timestamps or claim a complete retrospective 168-hour balance. Historic timestamp-only activities fall back to Asia/Tehran until the account registers a zone. The first full 168-hour post-cutover window removes the legacy balance coverage limitation.

No full database rollback, blanket verified marking, extra silver increments, deployment or production data mutation was performed while preparing this candidate.
