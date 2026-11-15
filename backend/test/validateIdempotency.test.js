process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";
const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");
const { validate } = require("../middleware/validate");
const { idempotency } = require("../middleware/idempotency");
const S = require("../schemas");

// Minimal in-memory stand-in for the supabase query builder on idempotency_keys.
function fakeDb({ failInsert } = {}) {
  const rows = new Map();
  const k = (f) => `${f.scope}|${f.key}`;
  return {
    rows,
    from() {
      const f = {};
      let op;
      const b = {
        insert(r) { op = "insert"; Object.assign(f, r); return b; },
        update(r) { op = "update"; f.patch = r; return b; },
        delete() { op = "delete"; return b; },
        select() { op = "select"; return b; },
        eq(c, v) { f[c] = v; return b; },
        maybeSingle() { return b; },
        then(res, rej) {
          let out;
          if (op === "insert") {
            if (failInsert) out = { error: { code: "XX000", message: "db down" } };
            else if (rows.has(k(f))) out = { error: { code: "23505" } };
            else { rows.set(k(f), { request_hash: f.request_hash, status: "in_progress" }); out = { error: null }; }
          } else if (op === "select") out = { data: rows.get(k(f)) ?? null, error: null };
          else if (op === "update") { Object.assign(rows.get(k(f)), f.patch); out = { error: null }; }
          else { rows.delete(k(f)); out = { error: null }; }
          return Promise.resolve(out).then(res, rej);
        },
      };
      return b;
    },
  };
}

async function serve(db, handler) {
  const app = express();
  app.use(express.json());
  app.post("/restock/:itemId", validate({ body: S.restockBody }), idempotency({ db }), handler);
  const server = app.listen(0);
  await new Promise((r) => server.once("listening", r));
  const call = (body, headers = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/restock/i1`, {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: JSON.stringify(body),
    });
  return { call, close: () => server.close() };
}

test("validation rejects bad bodies with a code and issue list", async () => {
  const s = await serve(fakeDb(), (req, res) => res.json({ ok: true }));
  const r = await s.call({ amount: 0 });
  const body = await r.json();
  assert.equal(r.status, 400);
  assert.equal(body.code, "validation_failed");
  assert.equal(body.issues[0].path, "body.amount");
  assert.equal((await s.call({ amount: "5" })).status, 400);
  assert.equal((await s.call({ amount: 5 })).status, 200);
  s.close();
});

test("a retry with the same key replays the first response without re-running", async () => {
  let runs = 0;
  const s = await serve(fakeDb(), (req, res) => res.status(201).json({ n: ++runs }));
  const h = { "idempotency-key": "key-12345678" };
  const a = await s.call({ amount: 5 }, h);
  await new Promise((r) => setTimeout(r, 20));
  const b = await s.call({ amount: 5 }, h);
  assert.equal(a.status, 201);
  assert.equal(b.status, 201);
  assert.deepEqual(await b.json(), { n: 1 });
  assert.equal(b.headers.get("idempotent-replay"), "true");
  assert.equal(runs, 1);
  s.close();
});

test("same key with a different body → 422; no key → runs every time", async () => {
  let runs = 0;
  const s = await serve(fakeDb(), (req, res) => res.json({ n: ++runs }));
  const h = { "idempotency-key": "key-abcdefgh" };
  await s.call({ amount: 5 }, h);
  const r = await s.call({ amount: 6 }, h);
  assert.equal(r.status, 422);
  assert.equal((await r.json()).code, "idempotency_key_reuse");
  await s.call({ amount: 5 });
  await s.call({ amount: 5 });
  assert.equal(runs, 3);
  s.close();
});

test("a 5xx is not stored, so the retry runs again", async () => {
  let runs = 0;
  const s = await serve(fakeDb(), (req, res) => (++runs === 1 ? res.status(500).json({ message: "boom" }) : res.json({ ok: true })));
  const h = { "idempotency-key": "key-retry-500" };
  assert.equal((await s.call({ amount: 5 }, h)).status, 500);
  await new Promise((r) => setTimeout(r, 20));
  assert.equal((await s.call({ amount: 5 }, h)).status, 200);
  s.close();
});

test("a malformed key is a 400; an unavailable store fails open", async () => {
  const s = await serve(fakeDb({ failInsert: true }), (req, res) => res.json({ ok: true }));
  assert.equal((await s.call({ amount: 5 }, { "idempotency-key": "short" })).status, 400);
  assert.equal((await s.call({ amount: 5 }, { "idempotency-key": "key-12345678" })).status, 200);
  s.close();
});
