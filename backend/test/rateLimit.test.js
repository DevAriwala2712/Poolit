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
