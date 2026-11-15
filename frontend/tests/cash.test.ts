import assert from "node:assert/strict";
import test from "node:test";
import { cashDueRupees, isCashOnDelivery } from "../packages/domain/src/cash.ts";

test("recognises the cash on delivery choices the student app sends", () => {
  assert.equal(isCashOnDelivery("Cash on delivery"), true);
  assert.equal(isCashOnDelivery("cash on delivery"), true);
  assert.equal(isCashOnDelivery("  COD "), true);
  assert.equal(isCashOnDelivery("Cash"), true);
});

test("other payment choices are not cash", () => {
  for (const m of ["UPI", "Hostel wallet", "Card", "", undefined, null]) assert.equal(isCashOnDelivery(m as string | undefined), false, String(m));
});

test("cash due is in whole rupees from paise", () => {
  assert.equal(cashDueRupees(13600), 136);
  assert.equal(cashDueRupees(7050), 70.5);
  assert.equal(cashDueRupees(undefined), undefined);
});
