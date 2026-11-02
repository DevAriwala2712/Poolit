import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import test from "node:test";
import { isPlausibleBarcode } from "../apps/vendor/src/lib/barcode.ts";

test("accepts every dummy EAN-13 in the repo", () => {
  const codes = readdirSync(new URL("../../dummy-barcodes/", import.meta.url))
    .filter((f) => /^\d{13}\.svg$/.test(f))
    .map((f) => f.slice(0, 13));
  assert.ok(codes.length >= 8);
  for (const c of codes) assert.ok(isPlausibleBarcode(c, "ean_13"), c);
});

test("rejects a misread (wrong check digit)", () => {
  assert.equal(isPlausibleBarcode("8901030821029", "ean_13"), false);
});

test("validates UPC-A and EAN-8 check digits", () => {
  assert.ok(isPlausibleBarcode("036000291452", "upc_a"));
  assert.equal(isPlausibleBarcode("036000291453", "upc_a"), false);
  assert.ok(isPlausibleBarcode("96385074", "ean_8"));
});

test("non-GTIN formats only need a sensible length", () => {
  assert.ok(isPlausibleBarcode("ABC-12345", "code_128"));
  assert.equal(isPlausibleBarcode("ab", "code_128"), false);
  assert.equal(isPlausibleBarcode("", "qr_code"), false);
});
