# Offline support and recovery

## Supported now

Once loaded, cards and story progress are kept locally and queued for synchronization. Disconnection does not guarantee a successful cold restart: the service worker handles notifications and deliberately does not cache the application shell or catalog. Keep the app open until pending work reports saved. Browser storage is device-specific and can be cleared by the browser/user.

Cold-offline reopening is deferred by the owner (18 November 2026). If added later, version shell/content caches and test updates, sign-out, private data isolation, and rollback before enabling it.

## User backups

Version 2 exports contain cards, settings and locally saved story progress. Review history and contest results are excluded. Import requires confirmation and stores the previous cards/settings under `daf_before_import_<user id>` in localStorage. This local recovery copy is not a server backup. Use merge to retain cards absent from the selected file, or explicitly confirm replacement. Story progress merges forward. Ranked history must never be fabricated by importing a file.

## Operator recovery rehearsal

The owner must record the hosted backup plan and retention, responsible operator, recovery-point objective (maximum acceptable lost data), and recovery-time objective (maximum acceptable outage). No production recovery is authorized by this document.

1. Restore a selected backup into a separate staging project using the owner's Supabase workflow.
2. Compare user/card/event/story counts and sampled synthetic records; verify identity references, RLS, RPC grants, indexes, triggers, and scheduled jobs.
3. Disable staging reminders until explicitly testing synthetic destinations.
4. Run authorization and sync regressions using staging identities.
5. Record backup timestamp, restore start/end, recovered revision, measured lost-data window, and permission checks.
6. Test the compatible frontend against the restored schema and document the owner-approved production procedure.

Never assume rolling back a frontend undoes a database migration or restores deleted rows.
