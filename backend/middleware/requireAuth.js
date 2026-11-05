const { verifyToken, InvalidTokenError } = require("../utils/verifyToken");

/**
 * Protects vendor-only mutation routes. Expects `Authorization: Bearer <access_token>`
 * from a Supabase Auth session (the vendor console signs in with email+password).
 * Student-facing and shared read routes never use this — they stay public.
 */
async function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice("Bearer ".length) : null;

  if (!token) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  try {
    req.user = await verifyToken(token);
  } catch (err) {
    if (err instanceof InvalidTokenError) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    // Supabase Auth unreachable — fail closed, but as a 503, not a crash.
    console.error("[requireAuth] auth check failed:", err);
    return res.status(503).json({ message: "Authentication service unavailable, try again" });
  }
  next();
}

module.exports = requireAuth;
