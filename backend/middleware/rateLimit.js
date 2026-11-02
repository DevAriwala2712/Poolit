/**
 * Minimal fixed-window rate limiter keyed by client IP, no dependencies.
 *
 * Limits are per process: on Vercel each warm instance keeps its own counts,
 * so this is a speed bump against scripted abuse, not a hard guarantee. The
 * production plan replaces the store with Upstash Redis behind the same API.
 */
function rateLimit({ windowMs, max, name = "default", now = () => Date.now() }) {
  const hits = new Map(); // key -> { count, resetAt }

  return (req, res, next) => {
    const t = now();
    const key = `${name}:${req.ip || req.socket?.remoteAddress || "unknown"}`;
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= t) {
      entry = { count: 0, resetAt: t + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    // Opportunistic cleanup so the map can't grow without bound.
    if (hits.size > 10_000) {
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
    }

    res.setHeader("RateLimit-Limit", String(max));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, max - entry.count)));
    if (entry.count > max) {
      const retry = Math.ceil((entry.resetAt - t) / 1000);
      res.setHeader("Retry-After", String(retry));
      return res.status(429).json({ message: `Too many requests — try again in ${retry}s` });
    }
    next();
  };
}

module.exports = { rateLimit };
