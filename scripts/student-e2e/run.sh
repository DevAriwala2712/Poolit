#!/usr/bin/env bash
# End-to-end run of the real student app on the Supabase backend, against a
# local Postgres (see run.cjs for the picture). Checks browsing, the one-call
# catalogue, placing an order as a signed-in student, polling and the Orders screen.
#
#   PGHOST=/path/to/socket-or-host PGPORT=5432 PGUSER=postgres scripts/student-e2e/run.sh
#
# Needs: a local Postgres where you may create databases, psql, Node, and
# Playwright with Chromium (not a project dependency; NODE_PATH is set to the
# global install if you have not set it). Touches nothing real: the app is
# built against http://localhost:54400, served by fake-postgrest.cjs.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="e2e_student"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
OUT="$(mktemp -d)"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  # pg_cron only exists on Supabase; its stand-in is in 00_stubs.sql.
  sed 's/^create extension if not exists pg_cron;/-- pg_cron stubbed/' "$f" | "${PSQL[@]}" -d "$DB" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f scripts/student-e2e/fixture.sql

ANON="x.$(printf '{"role":"anon"}' | base64 -w0 | tr '+/' '-_' | tr -d '=').y"
(cd frontend/apps/student &&
  VITE_BACKEND=supabase VITE_SUPABASE_URL=http://localhost:54400 VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" \
  npx vite build --outDir "$OUT/dist" --emptyOutDir >/dev/null)

export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
PSQL_ARGS=()
[ -n "${PGHOST:-}" ] && PSQL_ARGS+=(-h "$PGHOST")
[ -n "${PGPORT:-}" ] && PSQL_ARGS+=(-p "$PGPORT")
[ -n "${PGUSER:-}" ] && PSQL_ARGS+=(-U "$PGUSER")
node scripts/student-e2e/run.cjs "$OUT/dist" "$DB" "${PSQL_ARGS[@]}"
