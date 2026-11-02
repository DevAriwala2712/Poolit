#!/usr/bin/env bash
# Dump the live Supabase schema (no data) into a baseline migration.
# Usage: SUPABASE_DB_URL=postgresql://... ./scripts/export-schema.sh
set -euo pipefail
: "${SUPABASE_DB_URL:?Set SUPABASE_DB_URL to the project's Postgres connection string}"
out="supabase/migrations/20261101000000_baseline.sql"
npx --yes supabase@latest db dump --db-url "$SUPABASE_DB_URL" --schema public -f "$out"
echo "Wrote $out — review it, then commit."
