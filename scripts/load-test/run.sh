#!/usr/bin/env bash
# Database-level capacity test with pgbench: many concurrent students placing orders and
# refreshing the app, using the real api_place_order and api_student_view functions.
#
#   PGHOST=/path/to/socket PGPORT=5432 PGUSER=postgres scripts/load-test/run.sh
#
# Measures the DATABASE side only (functions, locks, queries). It does not include the network,
# Supabase's REST layer, or the Supabase machine, which is smaller and shared. Read the numbers
# as "how much headroom the design has", and repeat on staging (the same Supabase size) before
# trusting them for capacity.
#
# Runs, each for DURATION seconds (default 30):
#   realistic  the stress scenario from the analysis: about 11 app refreshes/s and 0.2 orders/s
#   10x        ten times that
#   flat out   as fast as the machine will go
# then checks nothing was oversold and no order went missing.
set -euo pipefail
cd "$(dirname "$0")/../.."

DB="${LOAD_DB:-load_test}"
DURATION="${DURATION:-30}"
CLIENTS="${CLIENTS:-16}"
PSQL=(psql -X -q -v ON_ERROR_STOP=1)
OUT="$(mktemp -d)"

"${PSQL[@]}" -d postgres -c "drop database if exists $DB with (force)" -c "create database $DB"
"${PSQL[@]}" -d "$DB" -f supabase/tests/00_stubs.sql >/dev/null
for f in supabase/migrations/*.sql; do
  sed 's/^create extension if not exists pg_cron;/-- pg_cron stubbed/' "$f" | "${PSQL[@]}" -d "$DB" >/dev/null
done
"${PSQL[@]}" -d "$DB" -f scripts/load-test/setup.sql
echo "data ready: $("${PSQL[@]}" -d "$DB" -At -c "select count(*) from load.students") students, $("${PSQL[@]}" -d "$DB" -At -c "select count(*) from load.pools") open pools"

# percentile from a pgbench transaction log (column 3 = latency in microseconds)
pct() { python3 - "$1" <<'PY'
import sys, glob
lat = []
for f in glob.glob(sys.argv[1] + "*"):
    for line in open(f):
        p = line.split()
        if len(p) >= 3 and p[2].isdigit(): lat.append(int(p[2]) / 1000)
lat.sort()
if not lat:
    print("no transactions"); sys.exit()
q = lambda x: lat[min(len(lat) - 1, int(len(lat) * x))]
print(f"{len(lat):6d} calls   median {q(.5):7.1f} ms   p95 {q(.95):7.1f} ms   p99 {q(.99):7.1f} ms   max {lat[-1]:7.1f} ms")
PY
}

run() { # name, rate (total tps, 0 = unlimited), view weight, order weight
  local name="$1" rate="$2" vw="$3" ow="$4" args=()
  [ "$rate" != "0" ] && args+=(-R "$rate")
  pgbench "${args[@]}" -n -c "$CLIENTS" -j 4 -T "$DURATION" -l --log-prefix "$OUT/$name" \
    -f "scripts/load-test/view.sql@$vw" -f "scripts/load-test/order.sql@$ow" "$DB" > "$OUT/$name.txt" 2>&1 || true
  local tps; tps="$(grep -E '^tps' "$OUT/$name.txt" | head -1 | sed 's/ (.*//')"
  local fail; fail="$(grep -E 'failed|number of failed' "$OUT/$name.txt" | head -1 || true)"
  echo "== $name: $tps ${fail:+($fail)}"
  echo "   all calls:   $(pct "$OUT/$name")"
}

# 11 refreshes/s + 0.2 orders/s  is about 11.2 tps with 98% refreshes
run realistic 11.2 98 2
run 10x 112 98 2
run flat-out 0 20 1

echo
echo "== integrity after the runs"
"${PSQL[@]}" -d "$DB" -At -c "
  select 'orders placed:                       ' || count(*) from orders;
  select 'units taken out of stock:            ' || (select 425 * 2000000000::bigint - sum(stock_qty) from menu_items where name like 'Load Item%');
  select 'units in the saved orders:           ' || (select coalesce(sum((i->>'qty')::int), 0) from orders o, jsonb_array_elements(o.items) i);
  select case when (select 425 * 2000000000::bigint - sum(stock_qty) from menu_items where name like 'Load Item%')
                 = (select coalesce(sum((i->>'qty')::int), 0) from orders o, jsonb_array_elements(o.items) i)
              then 'OK: stock taken equals units ordered (nothing oversold, nothing lost)'
              else 'PROBLEM: stock taken differs from units ordered' end;
  select 'items with negative stock:           ' || count(*) from menu_items where stock_qty < 0;
  select 'students over the 3-per-pool cap:    ' || count(*) from (select student_id from orders group by student_id, slot_id having count(*) > 3) x;"
