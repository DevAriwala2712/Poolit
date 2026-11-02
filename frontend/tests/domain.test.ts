import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { FEE_TIERS, feeForOrderCount, nextTierFee, ordersUntilNextTier } from "../packages/domain/src/feeLadder.ts";

const require = createRequire(import.meta.url);
const backend = require("../../backend/utils/feeLadder.js") as { feeForOrderCount: (n: number) => number };

test("frontend and backend fee ladders agree for 0..200 orders", () => {
  for (let n = 0; n <= 200; n++) {
    assert.equal(feeForOrderCount(n), backend.feeForOrderCount(n), `mismatch at ${n} orders`);
  }
});

test("FEE_TIERS table matches feeForOrderCount", () => {
  for (const tier of FEE_TIERS) {
    assert.equal(feeForOrderCount(tier.minOrders), tier.fee);
    if (Number.isFinite(tier.maxOrders)) assert.equal(feeForOrderCount(tier.maxOrders), tier.fee);
  }
});

test("next-tier hints point at the next cheaper fee", () => {
  assert.equal(ordersUntilNextTier(1), 2);
  assert.equal(nextTierFee(1), 10);
  assert.equal(ordersUntilNextTier(5), 1);
  assert.equal(nextTierFee(5), 5);
  assert.equal(ordersUntilNextTier(11), null);
  assert.equal(nextTierFee(11), null);
});
