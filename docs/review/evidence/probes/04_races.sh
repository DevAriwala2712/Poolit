#!/usr/bin/env bash
# Concurrency probes. Run against a COPY of a throwaway database that already has the
# fixtures from 01_access_matrix.sql (it commits changes):
#   createdb -T poolit_review poolit_race && DB=poolit_race ./04_races.sh
# Needs PGHOST/PGUSER/PGPASSWORD for a local superuser. Never point this at a real project.
set -u
R="psql -d ${DB:?set DB} -qAt"
call() { $R -c "select set_config('request.jwt.claims', json_build_object('sub', rv.id('$1'), 'role', 'authenticated')::text, false)" \
            -c "set role authenticated" -c "$2" 2>&1 | tail -1 | cut -c1-90; }
order="jsonb_build_array(jsonb_build_object('menuItemId', rv.id('iX'), 'qty', 1))"

echo "== 1: six simultaneous orders from one student (limit is 3)"
for i in 1 2 3 4 5 6; do call studentB "select 'placed' from (select api_place_order(rv.id('sOpen'), 'B', $order)) x" & done; wait
$R -c "select 'active orders for B: '||count(*) from orders where student_id=rv.id('studentB') and status='placed'"

echo "== 2: seven accounts order 1 unit each, stock is 5"
$R -c "update menu_items set stock_qty=5 where id=rv.id('iX')"
for a in stranger studentA studentB staffX ownerX ownerY admin; do call $a "select 'placed' from (select api_place_order(rv.id('sOpen'), 'R2', $order)) x" & done; wait
$R -c "select 'R2 orders: '||count(*)||', stock now: '||(select stock_qty from menu_items where id=rv.id('iX')) from orders where student_name='R2'"

echo "== 3: same idempotency key sent twice at once"
$R -c "update menu_items set stock_qty=50 where id=rv.id('iX')"
for i in 1 2; do call stranger "select left(api_place_order(rv.id('sOpen'), 'K', $order, null, null, 0, 'COD', null, 'race-key-0001')::text, 46)" & done; wait
$R -c "select 'orders named K: '||count(*) from orders where student_name='K'"

echo "== 4: two staff tap Deliver on the same order at once"
for a in staffX ownerX; do call $a "select api_mark_delivered(rv.id('oD'))->>'message'" & done; wait
$R -c "select 'delivered rows: '||count(*) from orders where id=rv.id('oD') and status='delivered'"

echo "== 5: student cancels while the expired pool is being closed"
# close_slot locks the pool, then updates its orders. api_cancel_order locks the order,
# then (pool expired) calls close_slot. Opposite order, so the two can deadlock.
$R -c "update slots set closes_at = now() - interval '1 second' where id = rv.id('sOpen')"
( $R -c "begin" -c "select 1 from slots where id = rv.id('sOpen') for update" -c "select pg_sleep(2)" \
     -c "update orders set status='pooled' where slot_id = rv.id('sOpen') and status='placed'" -c "commit" 2>&1 \
   | grep -i -E "ERROR|deadlock" | head -2 | sed 's/^/closer: /' ) &
sleep 0.7; call studentA "select api_cancel_order(rv.id('oA'))->>'message'" | sed 's/^/canceller: /'; wait
$R -c "select 'order oA status: '||status from orders where id=rv.id('oA')"
