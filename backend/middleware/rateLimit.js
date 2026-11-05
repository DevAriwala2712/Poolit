/**
 * Fixed-window rate limiter.
 *
 * Default store is in-process memory: on Vercel each warm instance keeps its
 * own counts, so that is a speed bump, not a guarantee. When UPSTASH_REDIS_REST_URL
 * and UPSTASH_REDIS_REST_TOKEN are set, `defaultStore()` returns a shared Redis
 * store so limits hold across instances. A store failure fails OPEN (logged):
 * an outage of the limiter must not take ordering down with it.
 *
 * `keyBy(req)` picks who is limited: the signed-in user when there is one
 * (a whole hostel shares one IP, a vendor's phone does not), else the IP.
 */
const byIpOrUser = (req) => (req.user?.id ? `u:${req.user.id}` : `ip:${req.ip || req.socket?.remoteAddress || "unknown"}`);

function upstashStore({ url, token, fetchImpl = fetch }) {
  return {
    async hit(key, windowMs) {
      const res = await fetchImpl(`${url}/pipeline`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify([["INCR", key], ["PEXPIRE", key, windowMs, "NX"], ["PTTL", key]]),
      });
      if (!res.ok) throw new Error(`Upstash ${res.status}`);
      const out = await res.json();
      const count = out[0].result;
      const ttl = out[2].result;
      return { count, resetAt: Date.now() + (ttl > 0 ? ttl : windowMs) };
    },
  };
}

function defaultStore() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? upstashStore({ url, token }) : null;
}

function rateLimit({ windowMs, max, name = "default", now = () => Date.now(), store = null, keyBy = byIpOrUser }) {
  const hits = new Map(); // in-memory fallback: key -> { count, resetAt }

  const respond = (res, next, entry, t) => {
    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retry = Math.max(1, Math.ceil((entry.resetAt - t) / 1000));
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ code: "rate_limited", message: `Too many requests — try again in ${retry}s` });
    }
    next();
  };

  const memoryHit = (key, t) => {
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }
    return entry;
  };

  return (req, res, next) => {
    const t = now();
    const key = `rl:${name}:${keyBy(req)}`;
    const shared = store ?? defaultStore();
    if (!shared) return respond(res, next, memoryHit(key, t), t);

    shared.hit(key, windowMs).then(
      (entry) => respond(res, next, entry, t),
      (err) => {
        console.error(JSON.stringify({ level: "error", msg: "rate limit store failed, allowing", requestId: req.id, error: err.message }));
        respond(res, next, memoryHit(key, t), t);
      },
    );
  };
}

module.exports = { rateLimit, upstashStore, byIpOrUser };
