# Schema lifecycle

For a clean test installation, the canonical manifest is `scripts/database-schema.mjs`: baseline `supabase/schema.sql`, then all SQL files in `supabase/migrations/` in lexical order. Type generation and isolated SQL verification use this same manifest. The native test harness applies the equivalent order. These commands use synthetic Auth/Cron stand-ins and never target hosted data.

- `npm run test:sql:isolated`: fresh cluster per SQL test, with migration replay.
- `npm run db:types`: regenerate the checked-in public database types after a schema change.
- `npm run db:upgrade:check`: compare clean installation against a legacy-fixture upgrade and replay, including columns, constraints, indexes, policies, functions, triggers, views, sequences, grants and scheduled jobs; assert existing progress survives without invented ranked credit.
- `npm run db:types:check`: fail on drift between repository schema and generated types; runs in CI.
- `bash scripts/test-sql.sh /path/to/postgresql/bin`: native PostgreSQL assertions.

Existing hosted projects must apply only unapplied migrations through the owner workflow. Do not rerun historical cleanup SQL blindly; it may delete retired-feature data. Compare a sanitized installed schema/grant export with Git before upgrading. Record installed migration versions and recovery steps.

The baseline and historical adjective migration still overlap; they are retained for compatibility. The shared clean-install manifest and replay tests are the current source of truth. A future baseline squash must separately prove clean-install/upgrade equivalence and retain hosted migration history.
