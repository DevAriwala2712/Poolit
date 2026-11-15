const crypto = require("crypto");
const defaultDb = require("../config/supabaseClient");

const KEY_RE = /^[\w.:-]{8,100}$/;

/**
 * Idempotency for retried writes. A client sends `Idempotency-Key: <uuid>`;
 * the first request runs normally and its response is stored, and any retry
 * with the same key gets that same response back (header `Idempotent-Replay:
 * true`) instead of running again — no double order, no double restock.
 *
 *  - No header → no effect (optional, so old clients keep working).
 *  - Same key, different body → 422 `idempotency_key_reuse`.
 *  - Same key while the first is still running → 409 `idempotency_in_progress`.
 *  - 5xx responses are not stored, so a retry after a server error runs again.
 *  - If the idempotency table is unreachable the request proceeds un-keyed
 *    (logged) rather than failing orders.
 *
 * Scope is the signed-in user (or client IP) plus the route, so one user can't
 * collide with or read another's stored responses.
 */
function idempotency({ db = defaultDb } = {}) {
  return async (req, res, next) => {
    const key = req.headers["idempotency-key"];
    if (key === undefined) return next();
    if (typeof key !== "string" || !KEY_RE.test(key)) {
      return res.status(400).json({ code: "invalid_idempotency_key", message: "Idempotency-Key must be 8–100 characters (letters, digits, . _ : -)" });
    }

    const scope = `${req.user?.id || req.ip || "anon"}:${req.method} ${req.baseUrl}${req.route?.path || ""}`;
    const hash = crypto.createHash("sha256").update(JSON.stringify(req.body ?? {}) + JSON.stringify(req.params)).digest("hex");

    try {
      const { error: insErr } = await db
        .from("idempotency_keys")
        .insert({ scope, key, request_hash: hash });

      if (insErr) {
        if (insErr.code !== "23505") throw insErr; // not a duplicate → real failure
        const { data: row, error: selErr } = await db
          .from("idempotency_keys")
          .select("request_hash, status, response_status, response_body")
          .eq("scope", scope)
          .eq("key", key)
          .maybeSingle();
        if (selErr) throw selErr;
        if (row) {
          if (row.request_hash !== hash) {
            return res.status(422).json({ code: "idempotency_key_reuse", message: "This Idempotency-Key was already used with a different request" });
          }
          if (row.status === "completed") {
            res.setHeader("Idempotent-Replay", "true");
            return res.status(row.response_status).json(row.response_body);
          }
          return res.status(409).json({ code: "idempotency_in_progress", message: "The original request is still being processed — retry shortly" });
        }
        // Row vanished between insert and select (purged): fall through un-keyed.
        return next();
      }
    } catch (err) {
      console.error(JSON.stringify({ level: "error", msg: "idempotency store unavailable, continuing without", requestId: req.id, error: err.message }));
      return next();
    }

    // First time we've seen this key: run the handler and remember the result.
    const json = res.json.bind(res);
    res.json = (body) => {
      const status = res.statusCode;
      const settle = status >= 500
        ? db.from("idempotency_keys").delete().eq("scope", scope).eq("key", key)
        : db.from("idempotency_keys").update({ status: "completed", response_status: status, response_body: body }).eq("scope", scope).eq("key", key);
      Promise.resolve(settle).catch((e) =>
        console.error(JSON.stringify({ level: "error", msg: "idempotency store write failed", requestId: req.id, error: e.message })),
      );
      return json(body);
    };
    next();
  };
}

module.exports = { idempotency };
