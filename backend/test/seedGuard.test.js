const test = require("node:test");
const assert = require("node:assert/strict");
const { checkSeedTarget } = require("../utils/seedGuard");

test("allows a local Supabase", () => {
  assert.equal(checkSeedTarget("http://127.0.0.1:54321").ok, true);
  assert.equal(checkSeedTarget("http://localhost:54321").ok, true);
});

test("refuses a hosted project unless its ref is confirmed", () => {
  const r = checkSeedTarget("https://abcd1234.supabase.co");
  assert.equal(r.ok, false);
  assert.match(r.reason, /SEED_CONFIRM_PROJECT=abcd1234/);
  assert.equal(checkSeedTarget("https://abcd1234.supabase.co", "other").ok, false);
  assert.equal(checkSeedTarget("https://abcd1234.supabase.co", "abcd1234").ok, true);
});

test("refuses a missing or malformed URL", () => {
  assert.equal(checkSeedTarget(undefined).ok, false);
  assert.equal(checkSeedTarget("not a url").ok, false);
});
