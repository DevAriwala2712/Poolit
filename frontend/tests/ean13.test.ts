import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { ean13CheckDigit, ean13Svg, encodeEAN13, isValidEAN13 } from "../apps/vendor/src/lib/ean13.ts";

test("check digit matches the database's generated codes and real products", () => {
  // 2900000000018 is what generate_item_barcode() produced on the live DB.
  assert.equal(ean13CheckDigit("290000000001"), 8);
  assert.ok(isValidEAN13("2900000000018"));
  for (const f of readdirSync(new URL("../../dummy-barcodes/", import.meta.url))) {
    if (/^\d{13}\.svg$/.test(f)) assert.ok(isValidEAN13(f.slice(0, 13)), f);
  }
  assert.equal(isValidEAN13("2900000000019"), false);
});

test("encodes 95 modules with start, centre and end guards", () => {
  const bits = encodeEAN13("2900000000018");
  assert.equal(bits.length, 95);
  assert.equal(bits.slice(0, 3), "101");
  assert.equal(bits.slice(45, 50), "01010");
  assert.equal(bits.slice(-3), "101");
});

test("matches the repo's reference encoder output for a dummy code", () => {
  // Same tables as dummy-barcodes/generate.js: first left digit of 8901030821028 uses parity "LGGLLG" → digit 9 in L.
  assert.equal(encodeEAN13("8901030821028").slice(3, 10), "0001011");
});

test("SVG output is self-contained and refuses invalid codes", () => {
  assert.match(ean13Svg("2900000000018"), /^<svg xmlns=/);
  assert.throws(() => encodeEAN13("123"));
});
