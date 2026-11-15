#!/usr/bin/env bash
# End-to-end run of the real vendor console on the Supabase backend, against a
# local Postgres (see run.cjs). A store owner closes a pool, dispatches it,
# delivers an order and restocks; a student account is refused; a second store's
# owner sees only their own store.
#
#   PGHOST=/path/to/socket-or-host PGPORT=5432 PGUSER=postgres scripts/vendor-e2e/run.sh
#
# Needs a local Postgres where you may create databases, psql, Node, and Playwright
# with Chromium (not a project dependency). Touches nothing real.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="e2e_vendor"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
OUT="$(mktemp -d)"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  sed 's/^create extension if not exists pg_cron;/-- pg_cron stubbed/' "$f" | "${PSQL[@]}" -d "$DB" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f scripts/student-e2e/fixture.sql
"${PSQL[@]}" -d "$DB" -f scripts/vendor-e2e/fixture.sql >/dev/null

ANON="x.$(printf '{"role":"anon"}' | base64 -w0 | tr '+/' '-_' | tr -d '=').y"
(cd frontend/apps/vendor &&
  VITE_BACKEND=supabase VITE_SUPABASE_URL=http://localhost:54400 VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" \
  npx vite build --outDir "$OUT/dist" --emptyOutDir >/dev/null)

export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
PSQL_ARGS=()
[ -n "${PGHOST:-}" ] && PSQL_ARGS+=(-h "$PGHOST")
[ -n "${PGPORT:-}" ] && PSQL_ARGS+=(-p "$PGPORT")
[ -n "${PGUSER:-}" ] && PSQL_ARGS+=(-U "$PGUSER")
node scripts/vendor-e2e/run.cjs "$OUT/dist" "$DB" "${PSQL_ARGS[@]}"
