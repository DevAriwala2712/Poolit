import test from "node:test";
import assert from "node:assert/strict";
import { orderSubtotal } from "../packages/domain/src/format.ts";
import type { MenuItem, Order } from "../packages/domain/src/types.ts";

const menu = [{ id: "m1", price: 99 }] as unknown as MenuItem[];
const order = (o: Partial<Order>) => ({ items: [], ...o }) as Order;

test("uses the frozen subtotal, ignoring later menu price changes", () => {
  const o = order({ subtotalPaise: 10600, items: [{ menuItemId: "m1", qty: 2, unitPricePaise: 5300 }] });
  assert.equal(orderSubtotal(o, menu), 106);
});

test("falls back to frozen line prices, then to the current menu for legacy orders", () => {
  assert.equal(orderSubtotal(order({ items: [{ menuItemId: "m1", qty: 2, unitPricePaise: 5300 }] }), menu), 106);
  assert.equal(orderSubtotal(order({ items: [{ menuItemId: "m1", qty: 2 }] }), menu), 198);
});
