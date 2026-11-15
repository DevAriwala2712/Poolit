import assert from "node:assert/strict";
import test from "node:test";
import { newIdempotencyKey, useSameKeyWhile } from "../packages/domain/src/idempotency.ts";

const VALID = /^[A-Za-z0-9._:-]{8,128}$/;

test("a new key is accepted by the database's key rule", () => {
  for (let i = 0; i < 50; i++) assert.match(newIdempotencyKey(), VALID);
});

test("keys do not repeat", () => {
  const keys = new Set(Array.from({ length: 2000 }, () => newIdempotencyKey()));
  assert.equal(keys.size, 2000);
});

test("still works where crypto.randomUUID is missing (older phones)", () => {
  const fake = { getRandomValues: (a: Uint8Array) => { for (let i = 0; i < a.length; i++) a[i] = (i * 37 + 11) % 256; return a; } };
  const key = newIdempotencyKey(fake as unknown as Crypto);
  assert.match(key, VALID);
});

test("works with no crypto at all", () => {
  assert.match(newIdempotencyKey(null), VALID);
});

test("the same request keeps its key, so a retry is recognised", () => {
  const holder = useSameKeyWhile();
  const a = holder.keyFor("order: 2 x Maggi");
  assert.equal(holder.keyFor("order: 2 x Maggi"), a);
});

test("a changed request gets a new key", () => {
  const holder = useSameKeyWhile();
  const a = holder.keyFor("order: 2 x Maggi");
  const b = holder.keyFor("order: 3 x Maggi");
  assert.notEqual(a, b);
  assert.equal(holder.keyFor("order: 3 x Maggi"), b);
});

test("after a success the next order starts with a fresh key", () => {
  const holder = useSameKeyWhile();
  const a = holder.keyFor("order: 2 x Maggi");
  holder.reset();
  assert.notEqual(holder.keyFor("order: 2 x Maggi"), a);
});
