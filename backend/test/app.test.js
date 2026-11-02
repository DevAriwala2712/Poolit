const test = require("node:test");
const assert = require("node:assert/strict");

process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";
process.env.ALLOWED_ORIGINS = "https://vendor.example";
const app = require("../app");

let server;
let base;
test.before(async () => {
  server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  base = `http://127.0.0.1:${server.address().port}`;
});
test.after(() => server.close());

test("health check responds without x-powered-by", async () => {
  const res = await fetch(`${base}/`);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get("x-powered-by"), null);
  assert.equal(res.headers.get("cache-control"), "no-store");
});

test("disallowed CORS origin → 403, not 500", async () => {
  const res = await fetch(`${base}/`, { headers: { Origin: "https://evil.example" } });
  assert.equal(res.status, 403);
});

test("malformed JSON → 400", async () => {
  const res = await fetch(`${base}/slots/x/orders`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{not json",
  });
  assert.equal(res.status, 400);
  assert.match((await res.json()).message, /not valid JSON/);
});

test("vendor mutations require a bearer token", async () => {
  const res = await fetch(`${base}/menu-items/abc/restock`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ amount: 5 }),
  });
  assert.equal(res.status, 401);
});

test("unknown route → 404 JSON", async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});

test("GET /me requires a signed-in student", async () => {
  const res = await fetch(`${base}/me`);
  assert.equal(res.status, 401);
});

test("STUDENT_LOGIN_REQUIRED: anonymous orders and order lists are refused", async () => {
  process.env.STUDENT_LOGIN_REQUIRED = "true";
  try {
    const order = await fetch(`${base}/slots/00000000-0000-0000-0000-000000000000/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ studentName: "x", items: [{ menuItemId: "m", qty: 1 }] }),
    });
    assert.equal(order.status, 401);
    assert.match((await order.json()).message, /Sign in/);

    const list = await fetch(`${base}/vendors/v1/orders`);
    assert.equal(list.status, 401);
    const slotList = await fetch(`${base}/slots/s1/orders`);
    assert.equal(slotList.status, 401);
  } finally {
    delete process.env.STUDENT_LOGIN_REQUIRED;
  }
});

test("GET /vendor/overview requires a signed-in vendor", async () => {
  const res = await fetch(`${base}/vendor/overview`);
  assert.equal(res.status, 401);
});

test("barcode generation and stock adjustment require a signed-in vendor", async () => {
  for (const [method, path] of [
    ["POST", "/menu-items/x/barcode"],
    ["POST", "/menu-items/x/adjust"],
    ["GET", "/menu-items/x/stock-history"],
    ["POST", "/vendors/v1/barcodes"],
  ]) {
    const res = await fetch(`${base}${path}`, { method, headers: { "content-type": "application/json" }, body: method === "POST" ? "{}" : undefined });
    assert.equal(res.status, 401, `${method} ${path}`);
  }
});

test("GET /vendor/analytics requires a signed-in vendor", async () => {
  const res = await fetch(`${base}/vendor/analytics?vendorId=v1`);
  assert.equal(res.status, 401);
});
