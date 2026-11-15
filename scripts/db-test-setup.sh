#!/usr/bin/env bash
# Builds a throwaway database that looks enough like Supabase for the
# migrations to run (supabase/tests/00_stubs.sql), then
# applies every migration in order. Used by the backend DB integration tests
# and CI. Usage: DATABASE_URL=postgres://... scripts/db-test-setup.sh
set -euo pipefail
: "${DATABASE_URL:?set DATABASE_URL}"
cd "$(dirname "$0")/.."

# A clean public schema, then the same Supabase stand-ins the SQL test suite uses
# (roles, auth, pg_cron, storage), so both suites see the same database shape.
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "drop schema if exists public cascade; create schema public;"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/00_stubs.sql >/dev/null

for f in supabase/migrations/*.sql; do
  # pg_cron is a Supabase-hosted extension; the stub above replaces it.
  sed 's/^create extension if not exists pg_cron;//' "$f" | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f - >/dev/null
done
echo "migrations applied"
