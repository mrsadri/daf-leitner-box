# Disposable database authorization checks

Run `bash scripts/test-sql.sh /path/to/postgresql/bin` as a non-root user with permission to start local PostgreSQL. The script creates a temporary cluster, applies the base schema and migrations, replays migrations, runs SQL assertions, and removes the cluster. It does not use production credentials or a hosted database URL.

The database CI job installs PostgreSQL 16 on Ubuntu and invokes the same harness. A successful hosted run is still required before treating it as a release gate.

`supabase/tests/authorization.test.sql` uses actual `SET ROLE` transitions and unique fixtures inside a rolled-back transaction:

- Anonymous users cannot read/write cards or invoke admin listing.
- An owner can read/update their card but cannot insert, update, delete, or reassign another owner's data.
- Authenticated users cannot edit the protected suspension column or call admin listing without authorization.
- Suspended users cannot read or insert cards.
- An explicitly authorized administrator can list accounts.

Denial blocks catch only SQLSTATE 42501 (`insufficient_privilege`). Syntax errors, missing columns/functions, and other unexpected errors fail the harness. The local auth stub includes the timestamps consumed by admin listing; it is still a minimal stand-in, not a full Supabase Auth service.

Remaining hosted coverage includes full Auth/PostgREST behavior and installed Supabase grants/API configuration; admin mutation scenarios and real provider delivery also need staging review. Local coverage now includes deliberate RLS mutation detection, concurrent quotas/story merges and transport retries. Demo browser tests do not prove database authorization.

## Expanded local verification, 18 November 2026

The native harness now also runs `scripts/test-sql-concurrency.sh` with two actual PostgreSQL connections. It verifies one winning revisioned transaction, quota enforcement near 10,000 cards, non-regressing concurrent story upserts, and an atomic delete/insert at quota. The isolated runner includes a negative control: disabling cards RLS must make the authorization assertions fail. Sync, challenge, reminder lease and per-device delivery tests cover their new grants, ownership and retry contracts. Hosted Auth/PostgREST and installation equivalence with an existing owner's schema still require staging verification.
