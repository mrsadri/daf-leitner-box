#!/usr/bin/env bash
# Streams a consistent logical database snapshot directly into public-key encryption.
set -euo pipefail
umask 077
if [[ $# != 1 || "$1" != *.dump.age || -e "$1" ]]; then
  echo 'Usage: encrypt-dump.sh NEW-OUTPUT.dump.age' >&2; exit 2
fi
: "${BACKUP_AGE_RECIPIENT:?Set the public age recipient}"
: "${PGHOST:?Set database host}"
: "${PGUSER:?Set database user}"
: "${PGDATABASE:?Set database name}"
command -v age >/dev/null
command -v pg_dump >/dev/null
output="$1"
partial="${output}.partial"
if [[ -e "$partial" ]]; then echo 'Partial output already exists' >&2; exit 2; fi
trap 'rm -f -- "$partial"' EXIT
# Do not echo connection settings or server errors: these may include sensitive details.
# PG* environment variables keep credentials out of process arguments.
if ! pg_dump --format=custom --no-password 2>/dev/null |
  age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" > "$partial" 2>/dev/null; then
  echo 'Encrypted backup failed; check connection, permissions and client/server versions privately.' >&2
  exit 1
fi
[[ -s "$partial" ]]
mv -- "$partial" "$output"
echo 'Encrypted snapshot created.'
