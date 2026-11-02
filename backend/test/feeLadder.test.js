const test = require("node:test");
const assert = require("node:assert/strict");
const { feeForOrderCount } = require("../utils/feeLadder");

test("fee ladder tiers: 1-2 → ₹20, 3-5 → ₹10, 6-10 → ₹5, 11+ → free", () => {
  const expected = { 0: 20, 1: 20, 2: 20, 3: 10, 5: 10, 6: 5, 10: 5, 11: 0, 500: 0 };
  for (const [count, fee] of Object.entries(expected)) {
    assert.equal(feeForOrderCount(Number(count)), fee, `count=${count}`);
  }
});

test("fee never increases as the pool grows", () => {
  let prev = Infinity;
  for (let n = 0; n <= 50; n++) {
    const fee = feeForOrderCount(n);
    assert.ok(fee <= prev, `fee rose at n=${n}`);
    prev = fee;
  }
});
