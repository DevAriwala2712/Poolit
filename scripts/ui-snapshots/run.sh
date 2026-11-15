#!/usr/bin/env bash
# Screenshots of every student and vendor screen at several sizes, to prove a styling change did
# not alter the look (or to see exactly what it altered).
#
#   PGHOST=... PGPORT=... PGUSER=... scripts/ui-snapshots/run.sh <out-dir> [baseline-dir]
#
# With a baseline dir it also compares pixel by pixel and lists every screen that differs, with
# the share of pixels that changed, and writes a side-by-side image for each into <out-dir>/diff.
# Needs a local Postgres, psql, Node, Playwright with Chromium. Touches nothing real.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT_DIR="$(realpath -m "${1:?usage: run.sh <out-dir> [baseline-dir]}")"
BASELINE_DIR="${2:+$(realpath "$2")}"
mkdir -p "$OUT_DIR"

DB="e2e_snapshots"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
BUILD="$(mktemp -d)"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  sed 's/^create extension if not exists pg_cron;/-- pg_cron stubbed/' "$f" | "${PSQL[@]}" -d "$DB" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f scripts/student-e2e/fixture.sql
"${PSQL[@]}" -d "$DB" -f scripts/vendor-e2e/fixture.sql >/dev/null

ANON="x.$(printf '{"role":"anon"}' | base64 -w0 | tr '+/' '-_' | tr -d '=').y"
for app in student vendor; do
  (cd frontend/apps/$app &&
    VITE_BACKEND=supabase VITE_SUPABASE_URL=http://localhost:54400 VITE_SUPABASE_PUBLISHABLE_KEY="$ANON" \
    npx vite build --outDir "$BUILD/$app" --emptyOutDir >/dev/null)
done

export NODE_PATH="${NODE_PATH:-$(npm root -g)}"
PSQL_ARGS=()
[ -n "${PGHOST:-}" ] && PSQL_ARGS+=(-h "$PGHOST")
[ -n "${PGPORT:-}" ] && PSQL_ARGS+=(-p "$PGPORT")
[ -n "${PGUSER:-}" ] && PSQL_ARGS+=(-U "$PGUSER")
node scripts/ui-snapshots/run.cjs "$BUILD/student" "$BUILD/vendor" "$DB" "$OUT_DIR" "${BASELINE_DIR:-}" "${PSQL_ARGS[@]}"
