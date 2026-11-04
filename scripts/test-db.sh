#!/usr/bin/env bash
# Database tests: builds a throwaway database, applies every migration in
# supabase/migrations, then runs each supabase/tests/*.test.sql.
#
#   DATABASE_URL=postgres://postgres@localhost:5432/postgres scripts/test-db.sh
#
# The URL must point at a Postgres server where you may create databases.
# Nothing here touches a real Supabase project.
set -euo pipefail
cd "$(dirname "$0")/.."

: "${DATABASE_URL:?set DATABASE_URL to a superuser connection string}"
TEST_DB="poolit_test_$$"
ADMIN_URL="$DATABASE_URL"
TEST_URL="${DATABASE_URL%/*}/$TEST_DB"

psql "$ADMIN_URL" -v ON_ERROR_STOP=1 -qc "create database $TEST_DB"
trap 'psql "$ADMIN_URL" -qc "drop database if exists $TEST_DB with (force)" >/dev/null' EXIT

run() { psql "$TEST_URL" -v ON_ERROR_STOP=1 -q -f "$1"; }

run supabase/tests/00_stubs.sql
for f in supabase/migrations/*.sql; do
  echo "migrate  $(basename "$f")"
  run "$f"
done

status=0
for f in supabase/tests/*.test.sql; do
  [ -e "$f" ] || continue
  echo "test     $(basename "$f")"
  if ! run "$f"; then status=1; fi
done
[ $status -eq 0 ] && echo "ALL DATABASE TESTS PASSED" || echo "DATABASE TESTS FAILED"
exit $status
