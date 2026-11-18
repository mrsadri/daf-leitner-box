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

## Reproducible local restore rehearsal

`scripts/test-sql.sh` now invokes `scripts/test-restore.py` after seeding disposable synthetic fixtures. It takes a custom-format `pg_dump`, writes a marker after the snapshot, restores into a second temporary database, and compares schema, policies, function/table grants, triggers, scheduled jobs and learner-data counts. The marker must be absent after restore, and private schemas/answer banks must remain inaccessible. Temporary backup/database artifacts are deleted by the harness.

For a machine-readable local report:

```bash
DAF_RESTORE_REPORT=/tmp/daf-restore-report.json bash scripts/test-sql.sh /path/to/postgresql/bin
```

The measured local fixture restore is not a hosted recovery-time commitment. Hosted backup retention, Auth service/Storage recovery, independent disaster recovery, operator responsibility and agreed RPO/RTO still need the owner rehearsal described above. No production backup or learner data is used by this script.

## Owner-approved targets — 18 November 2026

The owner accepted a maximum 24-hour data-loss window (RPO) and restoration within 4 hours (RTO). These are acceptance targets, not evidence that the current hosted backup plan meets them. The production backup schedule/retention and hosted restore rehearsal must demonstrate both targets before task 25 is closed. The synthetic local/CI restore does not establish hosted compliance.
