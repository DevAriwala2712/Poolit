// Integration tests: real migrations, real Postgres. Run with
//   DATABASE_URL=... ../scripts/db-test-setup.sh && DATABASE_URL=... npm run test:db
// Skipped when DATABASE_URL is not set so `npm test` stays dependency-free.
const test = require("node:test");
const assert = require("node:assert/strict");

const URL_ = process.env.DATABASE_URL;
const skip = !URL_ && "DATABASE_URL not set";
const { Pool } = skip ? {} : require("pg");
let pool;

test.before(() => { if (!skip) pool = new Pool({ connectionString: URL_, max: 10 }); });
test.after(async () => { if (pool) await pool.end(); });

const q = (sql, params) => pool.query(sql, params).then((r) => r.rows);
const one = async (sql, params) => (await q(sql, params))[0];

// One hostel + store + open pool + a few items, fresh per test.
async function world({ stock = 10, price = 53, window = 10 } = {}) {
  const h = await one("insert into hostels(name) values ('H-'||gen_random_uuid()) returning id");
  const v = await one("insert into vendors(name, hostel_id) values ('S', $1) returning id", [h.id]);
  const slot = await one(
    "insert into slots(hostel_id, vendor_id, status, opens_at, closes_at) values ($1,$2,'open', now(), now() + make_interval(mins => $3)) returning id",
    [h.id, v.id, window],
  );
  const item = await one(
    "insert into menu_items(vendor_id, name, category, price, unit, stock_qty) values ($1,'Soap','Essentials',$2,'pc',$3) returning id",
    [v.id, price, stock],
  );
  return { hostel: h.id, vendor: v.id, slot: slot.id, item: item.id };
}
const place = (w, qty = 1, extra = {}) =>
  one("select * from place_order($1,'Asha',null,null,0,null,null,$2::jsonb,null)", [
    extra.slot ?? w.slot,
    JSON.stringify([{ menuItemId: extra.item ?? w.item, qty }]),
  ]);

test("place_order freezes name and price, and later price edits don't change the order", { skip }, async () => {
  const w = await world({ price: 53 });
  const o = await place(w, 2);
  assert.equal(o.subtotal_paise, 10600);
  assert.deepEqual(o.items[0], { menuItemId: w.item, qty: 2, name: "Soap", unitPricePaise: 5300 });
  await q("update menu_items set price = 99 where id = $1", [w.item]);
  const again = await one("select * from orders where id = $1", [o.id]);
  assert.equal(again.subtotal_paise, 10600);
  assert.equal(again.items[0].unitPricePaise, 5300);
});

test("two simultaneous orders for the last unit: exactly one wins, stock never goes negative", { skip }, async () => {
  const w = await world({ stock: 1 });
  const results = await Promise.allSettled([place(w, 1), place(w, 1), place(w, 1)]);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.ok(results.filter((r) => r.status === "rejected").every((r) => /INSUFFICIENT_STOCK/.test(r.reason.message)));
  assert.equal((await one("select stock_qty from menu_items where id=$1", [w.item])).stock_qty, 0);
});

test("place_order rejects bad quantities, foreign-store items and closed pools; failed orders keep stock", { skip }, async () => {
  const w = await world({ stock: 5 });
  await assert.rejects(place(w, 0), /INVALID_QTY/);
  await assert.rejects(place(w, 101), /INVALID_QTY/);
  await assert.rejects(place(w, -3), /INVALID_QTY/);
  const other = await world({ stock: 5 });
  await assert.rejects(place(w, 1, { item: other.item }), /WRONG_VENDOR/);
  assert.equal((await one("select stock_qty from menu_items where id=$1", [w.item])).stock_qty, 5);
  await q("update slots set status='dispatched' where id=$1", [w.slot]);
  await assert.rejects(place(w, 1), /SLOT_NOT_OPEN/);
});

test("closing a pool locks the fee ladder for everyone in it", { skip }, async () => {
  const w = await world({ stock: 50 });
  for (let i = 0; i < 3; i++) await place(w, 1);
  const closed = (await one("select close_slot($1) as r", [w.slot])).r;
  assert.equal(closed.orderCount, 3);
  const fees = await q("select distinct delivery_fee_charged f, status from orders where slot_id=$1", [w.slot]);
  assert.equal(fees.length, 1);
  assert.equal(fees[0].status, "pooled");
  assert.equal(Number(fees[0].f), Number((await one("select fee_for_order_count(3) f")).f));
  assert.equal((await one("select close_slot($1) as r", [w.slot])).r.alreadyClosed, true);
});

test("restock_item enforces bounds and logs the restock", { skip }, async () => {
  const w = await world({ stock: 1 });
  await assert.rejects(q("select restock_item($1, 0)", [w.item]), /INVALID_AMOUNT/);
  await assert.rejects(q("select restock_item($1, 10001)", [w.item]), /INVALID_AMOUNT/);
  const r = (await one("select restock_item($1, 5) r", [w.item])).r;
  assert.equal(r.item.stock_qty ?? r.item.stockQty, 6);
  assert.equal((await one("select count(*)::int c from restock_logs where menu_item_id=$1", [w.item])).c, 1);
});

test("adjust_stock sets exact counts and audits before/after; can't remove more than exists", { skip }, async () => {
  const w = await world({ stock: 10 });
  const set = (await one("select adjust_stock($1,'set',7,'count',null,'shelf count') r", [w.item])).r;
  assert.equal(set.adjustment.previous_qty, 10);
  assert.equal(set.adjustment.new_qty, 7);
  const rm = (await one("select adjust_stock($1,'remove',2,'damaged',null,null) r", [w.item])).r;
  assert.equal(rm.adjustment.new_qty, 5);
  await assert.rejects(q("select adjust_stock($1,'remove',99,'damaged',null,null)", [w.item]), /NOT_ENOUGH_STOCK/);
  assert.equal((await one("select stock_qty from menu_items where id=$1", [w.item])).stock_qty, 5);
});

test("generated barcodes are valid EAN-13 in the in-store range, unique, and idempotent", { skip }, async () => {
  const w = await world();
  const a = (await one("select (generate_item_barcode($1)).barcode b", [w.item])).b;
  assert.match(a, /^29\d{11}$/);
  assert.equal((await one("select ean13_check_digit($1) d", [a.slice(0, 12)])).d, a[12]);
  assert.equal((await one("select (generate_item_barcode($1)).barcode b", [w.item])).b, a);
  const item2 = await one("insert into menu_items(vendor_id,name,category,price,unit,stock_qty) values ($1,'B','Snacks',10,'pc',1) returning id", [w.vendor]);
  assert.notEqual((await one("select (generate_item_barcode($1)).barcode b", [item2.id])).b, a);
});

test("pool rotation: expired pool with orders closes and a new one opens; empty one restarts", { skip }, async () => {
  const w = await world({ stock: 10 });
  await place(w, 1);
  await q("update slots set closes_at = now() - interval '1 minute' where id=$1", [w.slot]);
  const next = await one("select * from ensure_open_slot($1)", [w.hostel]);
  assert.notEqual(next.id, w.slot);
  assert.equal(next.status, "open");
  assert.equal((await one("select status from slots where id=$1", [w.slot])).status, "closed");

  await q("update slots set closes_at = now() - interval '1 minute' where id=$1", [next.id]);
  const same = await one("select * from ensure_open_slot($1)", [w.hostel]);
  assert.equal(same.id, next.id, "an empty expired pool is restarted, not replaced");
  assert.ok(new Date(same.closes_at) > new Date());
});

test("sweep_expired_slots rotates every hostel and keeps going past a bad one", { skip }, async () => {
  const a = await world({ stock: 5 });
  await place(a, 1);
  await q("update slots set closes_at = now() - interval '1 minute' where id=$1", [a.slot]);
  const rotated = (await one("select sweep_expired_slots() n")).n;
  assert.ok(rotated >= 1);
  assert.equal((await one("select status from slots where id=$1", [a.slot])).status, "closed");
});

test("the public API roles can't read or write anything directly", { skip }, async () => {
  const client = await pool.connect();
  try {
    for (const role of ["anon", "authenticated"]) {
      await client.query(`set role ${role}`);
      for (const table of ["orders", "menu_items", "students", "vendor_users", "idempotency_keys", "stock_adjustments"]) {
        await assert.rejects(client.query(`select * from ${table} limit 1`), /permission denied/, `${role} read ${table}`);
      }
      await assert.rejects(client.query("select place_order(gen_random_uuid(),'x',null,null,0,null,null,'[]'::jsonb,null)"), /permission denied/, `${role} place_order`);
      await assert.rejects(client.query("select sweep_expired_slots()"), /permission denied/);
      await client.query("reset role");
    }
  } finally { client.release(); }
});

test("daily revenue sums frozen subtotals", { skip }, async () => {
  const w = await world({ stock: 20, price: 10 });
  await place(w, 3);
  await q("update menu_items set price = 500 where id=$1", [w.item]);
  const rows = await q("select * from vendor_daily_revenue($1, 7)", [w.vendor]);
  assert.equal(rows.reduce((s, r) => s + Number(r.revenue), 0), 30);
  assert.equal(rows.length, 7);
});

test("idempotency keys older than a day are purged", { skip }, async () => {
  await q("delete from idempotency_keys where scope='t'");
  await q("insert into idempotency_keys(scope,key,request_hash,created_at) values ('t','old-key-12345678','h', now() - interval '25 hours'), ('t','new-key-12345678','h', now())");
  assert.ok((await one("select purge_idempotency_keys() n")).n >= 1);
  const left = await q("select key from idempotency_keys where scope='t'");
  assert.deepEqual(left.map((r) => r.key), ["new-key-12345678"]);
});
