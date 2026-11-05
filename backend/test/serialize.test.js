const test = require("node:test");
const assert = require("node:assert/strict");
const { toOrderJSON } = require("../utils/serialize");

const base = { id: "o1", slot_id: "s1", student_name: "A", tip: 0, status: "placed", created_at: "2026-11-02T00:00:00Z" };

test("order JSON carries frozen line prices and subtotal when present", () => {
  const json = toOrderJSON({
    ...base,
    subtotal_paise: 10600,
    items: [{ menuItemId: "m1", qty: 2, name: "Colgate", unitPricePaise: 5300 }],
  });
  assert.equal(json.subtotalPaise, 10600);
  assert.deepEqual(json.items, [{ menuItemId: "m1", qty: 2, name: "Colgate", unitPricePaise: 5300 }]);
});

test("legacy orders without a snapshot serialize as before", () => {
  const json = toOrderJSON({ ...base, items: [{ menuItemId: "m1", qty: 1 }] });
  assert.deepEqual(json.items, [{ menuItemId: "m1", qty: 1 }]);
  assert.equal("subtotalPaise" in json, false);
});
