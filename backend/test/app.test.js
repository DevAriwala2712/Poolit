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
