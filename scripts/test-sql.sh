#!/usr/bin/env bash
# Runs the Supabase SQL (schema + migrations) and supabase/tests/*.test.sql on a throwaway local PostgreSQL.
# Needs PostgreSQL binaries (e.g. brew install postgresql@16). Never touches the real project.
# Usage: scripts/test-sql.sh [pg_bin_dir]
set -euo pipefail
PG="${1:-/opt/homebrew/opt/postgresql@16/bin}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DATA="$(mktemp -d)"
PORT=54331
trap '"$PG/pg_ctl" -D "$DATA" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DATA"' EXIT
"$PG/initdb" -D "$DATA" -U postgres --auth=trust >/dev/null
"$PG/pg_ctl" -D "$DATA" -o "-p $PORT -k '' -c listen_addresses=127.0.0.1" -l "$DATA/log" start >/dev/null
for _ in $(seq 1 30); do "$PG/pg_isready" -h 127.0.0.1 -p $PORT >/dev/null 2>&1 && break; sleep 0.3; done
run() { "$PG/psql" -h 127.0.0.1 -p $PORT -U postgres -v ON_ERROR_STOP=1 -q "$@"; }
run -f "$ROOT/supabase/tests/stub-supabase.sql"
run -f "$ROOT/supabase/schema.sql"
for f in "$ROOT"/supabase/migrations/*.sql; do run -f "$f"; done
# Migrations must be safe to run twice
for f in "$ROOT"/supabase/migrations/*.sql; do run -f "$f"; done
for t in "$ROOT"/supabase/tests/*.test.sql; do echo "== $(basename "$t")"; run -f "$t" 2>&1 | grep -E "ok:|FAILED|ERROR|PASSED" ; done
