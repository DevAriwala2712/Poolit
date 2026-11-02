const test = require("node:test");
const assert = require("node:assert/strict");
const { rateLimit } = require("../middleware/rateLimit");

function fakeRes() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    setHeader(k, v) { this.headers[k] = v; },
    status(c) { this.statusCode = c; return this; },
    json(b) { this.body = b; return this; },
  };
}

test("allows up to max per window, then 429 with Retry-After", () => {
  let t = 1_000;
  const limiter = rateLimit({ windowMs: 60_000, max: 3, now: () => t });
  const req = { ip: "1.2.3.4" };
  for (let i = 0; i < 3; i++) {
    let called = false;
    limiter(req, fakeRes(), () => { called = true; });
    assert.ok(called, `request ${i + 1} should pass`);
  }
  const res = fakeRes();
  let called = false;
  limiter(req, res, () => { called = true; });
  assert.equal(called, false);
  assert.equal(res.statusCode, 429);
  assert.equal(res.headers["Retry-After"], "60");

  t += 60_000; // new window
  called = false;
  limiter(req, fakeRes(), () => { called = true; });
  assert.ok(called, "window resets");
});

test("limits are per IP", () => {
  const limiter = rateLimit({ windowMs: 60_000, max: 1, now: () => 0 });
  let passed = 0;
  limiter({ ip: "a" }, fakeRes(), () => passed++);
  limiter({ ip: "b" }, fakeRes(), () => passed++);
  assert.equal(passed, 2);
});

test("shared store: counts come from the store, and a store failure falls back to memory", async () => {
  const { rateLimit: rl } = require("../middleware/rateLimit");
  const calls = [];
  const store = { hit: async (key) => (calls.push(key), { count: calls.length, resetAt: Date.now() + 30_000 }) };
  const limiter = rl({ windowMs: 60_000, max: 1, name: "t", store });
  const run = (req) => new Promise((resolve) => {
    const res = fakeRes();
    res.json = function (b) { this.body = b; resolve({ res, passed: false }); return this; };
    limiter(req, res, () => resolve({ res, passed: true }));
  });
  assert.equal((await run({ ip: "1.1.1.1" })).passed, true);
  const second = await run({ ip: "1.1.1.1" });
  assert.equal(second.passed, false);
  assert.equal(second.res.statusCode, 429);
  assert.equal(calls[0], "rl:t:ip:1.1.1.1");

  const broken = rl({ windowMs: 60_000, max: 5, name: "b", store: { hit: async () => { throw new Error("down"); } } });
  const ok = await new Promise((resolve) => broken({ ip: "2.2.2.2" }, fakeRes(), () => resolve(true)));
  assert.equal(ok, true);
});

test("signed-in users are limited per user, not per shared IP", async () => {
  const { byIpOrUser } = require("../middleware/rateLimit");
  assert.equal(byIpOrUser({ user: { id: "abc" }, ip: "9.9.9.9" }), "u:abc");
  assert.equal(byIpOrUser({ ip: "9.9.9.9" }), "ip:9.9.9.9");
});
