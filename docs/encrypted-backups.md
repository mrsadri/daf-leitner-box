# Encrypted off-site database backups (Supabase Free)

Owner decision, 18 November 2026: keep Free and prepare encrypted off-site backups. Target: at most 24 hours lost data and recovery within 4 hours. **Prepared, not active:** no backup connection secrets, private destination or decryption identity have been configured. Do not mark recovery accepted until a real encrypted snapshot is downloaded, decrypted and restored in an isolated Supabase environment.

## Design and custody

The opt-in GitHub workflow runs at 02:17 and 14:17 UTC. `pg_dump` streams a consistent custom-format snapshot into `age` public-key encryption. No plaintext dump is written to disk. Only ciphertext is uploaded to a **separate private GitHub repository**, outside Supabase. The workflow refuses a public destination. No decryption key belongs in GitHub, Supabase, Vercel, this repository or chat.

GitHub schedules can be delayed or disabled. Twice-daily scheduling provides margin, not a 24-hour guarantee. The operator must check the latest successful uploaded snapshot every day and start a manual run if it approaches 24 hours. GitHub Actions/storage quotas apply; this setup does not authorize paid usage. Keep the destination private and monitor quota. A separate provider/account copy protects against GitHub account loss.

Operator: repository owner (Masih); until a second custodian is appointed, recovery has a single-person dependency. Retain 30 days of snapshots; the operator removes older `database-backup-*` releases monthly **only after** a newer snapshot has been restored successfully. No automatic deletion is enabled.

## Activation

1. On an offline/trusted machine install age. Run `age-keygen -o /secure/offline/daf-backup.identity` and copy only its public `age1…` recipient. Store two protected copies of the identity separately; verify access to both. Never paste the identity into chat.
2. Create a private backup repository. Use a fine-grained token with contents read/write on that destination only; set an expiry and renewal reminder. The source repository's default token cannot write there.
3. In source repository Actions variables set `BACKUP_REPOSITORY=owner/private-repository` and `BACKUP_AGE_RECIPIENT=age1…`. Keep `BACKUP_ENABLED` unset for now.
4. In Actions secrets set `BACKUP_PGHOST`, `BACKUP_PGPORT`, `BACKUP_PGUSER`, `BACKUP_PGPASSWORD`, and `BACKUP_REPOSITORY_TOKEN`. Use Supabase's direct connection or **session** pooler; do not use the transaction pooler. Obtain these from the project's Connect panel. The public anon/service API keys are not PostgreSQL credentials. Use a credential with complete read access to every backed-up schema; a restricted role must be tested for RLS/managed-schema completeness. Do not reset the database password merely to configure backups.
5. The workflow installs PostgreSQL 17 client; verify the source major version is no newer than 17, or update the pinned client. TLS is required. A full logical dump includes private schemas and sensitive Auth/configuration records; encryption and destination restrictions are essential.
6. Set `BACKUP_ENABLED=true`, run the workflow manually, verify a private release exists, download the ciphertext and perform the restore drill below. If it fails, disable the variable and resolve the failure before relying on it. Enable Actions failure notifications in your GitHub notification settings.

## Restore drill and incident procedure

Download the chosen release asset to a trusted encrypted disk. Decrypt with `age --decrypt -i /secure/offline/daf-backup.identity -o /secure/restore/database.dump database.dump.age`. First inspect with `pg_restore --list /secure/restore/database.dump`. Never restore onto production or execute the dump blindly.

A Supabase logical dump is not a portable full service image. Managed roles, Auth/Storage schemas, extension ownership and version differences require a reviewed restore procedure on a fresh compatible Supabase stack; follow [Supabase's CLI backup/restore guide](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore). The raw full custom dump intentionally preserves evidence; selectively restore managed schemas only after comparing the target's managed schema/version. Do not assume `pg_restore --clean` against an existing project is safe.

Disable Cron/reminders and all external provider delivery in the isolated target before restoring jobs. Compare users, cards, reviews, stories, revisions, verified results, function/table privileges, RLS, indexes and triggers; run cross-user denial and sync tests. Reconfigure OAuth redirect URLs, Edge Functions and secrets through the platform, not dump replay. Database backups exclude Storage object bytes, provider settings and deployed function code; this app's static assets and worker source are in Git, while live provider secrets need separate owner custody.

Record snapshot start, last successful upload, incident start, restore completion, validation completion, measured loss window and operator. The 4-hour RTO includes setup, decryption, restore, service configuration and application validation. Delete decrypted files from the encrypted working volume after validation. A local synthetic restore demonstrates tooling only, not hosted recovery or the 24h/4h targets.

Reference: [Supabase database backups](https://supabase.com/docs/guides/platform/backups). Automatic managed daily backups are a paid-plan feature; this workflow does not change the Supabase plan.
