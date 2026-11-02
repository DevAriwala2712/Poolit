const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

/** Tiny stand-in for the supabase query builder: rows keyed by table. */
function fakeDb(tables) {
  return {
    from(table) {
      const filters = [];
      const q = {
        select() { return q; },
        eq(col, val) { filters.push([col, val]); return q; },
        async maybeSingle() {
          const row = (tables[table] || []).find((r) => filters.every(([c, v]) => r[c] === v));
          return { data: row || null, error: null };
        },
      };
      return q;
    },
  };
}

function fakeRes() {
  return { statusCode: 200, body: null, status(c) { this.statusCode = c; return this; }, json(b) { this.body = b; return this; } };
}

const db = fakeDb({
  vendor_users: [
    { user_id: "u-owner", vendor_id: "v1", role: "owner" },
    { user_id: "u-staff", vendor_id: "v1", role: "staff" },
  ],
  menu_items: [{ id: "item-1", vendor_id: "v1" }],
  slots: [{ id: "slot-1", vendor_id: "v1" }],
  orders: [{ id: "order-1", slot_id: "slot-1" }],
});

async function run(mw, req) {
  const res = fakeRes();
  let nextCalled = false;
  await mw(req, res, () => { nextCalled = true; });
  return { res, nextCalled };
}

test("does nothing unless ENFORCE_VENDOR_SCOPING=true", async () => {
  delete process.env.ENFORCE_VENDOR_SCOPING;
  const { nextCalled } = await run(requireVendorAccess(vendorFrom.param, { db }), { params: { vendorId: "v2" }, user: { id: "x" } });
  assert.ok(nextCalled);
});

test("enforced: linked user passes, others get 403, missing resource 404", async () => {
  process.env.ENFORCE_VENDOR_SCOPING = "true";
  try {
    const mw = requireVendorAccess(vendorFrom.menuItem, { db });
    assert.ok((await run(mw, { params: { itemId: "item-1" }, user: { id: "u-staff" } })).nextCalled);

    const denied = await run(mw, { params: { itemId: "item-1" }, user: { id: "u-rival" } });
    assert.equal(denied.res.statusCode, 403);

    const missing = await run(mw, { params: { itemId: "nope" }, user: { id: "u-staff" } });
    assert.equal(missing.res.statusCode, 404);
  } finally {
    delete process.env.ENFORCE_VENDOR_SCOPING;
  }
});

test("enforced: owner-only routes reject staff", async () => {
  process.env.ENFORCE_VENDOR_SCOPING = "true";
  try {
    const mw = requireVendorAccess(vendorFrom.param, { roles: ["owner"], db });
    assert.ok((await run(mw, { params: { vendorId: "v1" }, user: { id: "u-owner" } })).nextCalled);
    assert.equal((await run(mw, { params: { vendorId: "v1" }, user: { id: "u-staff" } })).res.statusCode, 403);
  } finally {
    delete process.env.ENFORCE_VENDOR_SCOPING;
  }
});

test("orders resolve to their store through the slot", async () => {
  assert.equal(await vendorFrom.order({ params: { orderId: "order-1" } }, db), "v1");
  assert.equal(await vendorFrom.order({ params: { orderId: "missing" } }, db), null);
});
