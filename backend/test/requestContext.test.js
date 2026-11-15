const test = require("node:test");
const assert = require("node:assert/strict");
const { requestContext } = require("../middleware/requestContext");

function run({ headers = {}, status = 200, body = { ok: true } } = {}) {
  const logs = [];
  const handlers = {};
  const sent = {};
  const res = {
    statusCode: status,
    setHeader: (k, v) => (sent[k] = v),
    json(b) { sent.body = b; return this; },
    on: (ev, fn) => (handlers[ev] = fn),
  };
  const req = { headers, method: "GET", originalUrl: "/x?secret=1", ip: "1.2.3.4" };
  requestContext({ log: (l) => logs.push(l) })(req, res, () => {});
  res.json(body);
  handlers.finish();
  return { req, sent, logs };
}

test("assigns a request id, echoes it, and logs without the query string", () => {
  const { req, sent, logs } = run();
  assert.ok(req.id);
  assert.equal(sent["X-Request-Id"], req.id);
  assert.equal(logs[0].path, "/x");
  assert.equal(logs[0].level, "info");
});

test("keeps a well-formed inbound id, replaces a malformed one", () => {
  assert.equal(run({ headers: { "x-request-id": "abc-12345678" } }).req.id, "abc-12345678");
  assert.notEqual(run({ headers: { "x-request-id": "bad id!" } }).req.id, "bad id!");
});

test("error bodies gain code + requestId, success bodies are untouched", () => {
  const err = run({ status: 404, body: { message: "Not found" } });
  assert.equal(err.sent.body.code, "not_found");
  assert.equal(err.sent.body.message, "Not found");
  assert.equal(err.sent.body.requestId, err.req.id);
  assert.deepEqual(run().sent.body, { ok: true });
});

test("an explicit code from a controller wins", () => {
  const { sent } = run({ status: 409, body: { code: "slot_closed", message: "x" } });
  assert.equal(sent.body.code, "slot_closed");
});
