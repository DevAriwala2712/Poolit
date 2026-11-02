const supabase = require("../config/supabaseClient");

/**
 * Attaches req.user when a valid `Authorization: Bearer <token>` is sent, and
 * otherwise lets the request through anonymously. Used on routes that work
 * signed-out today but should record who acted when someone is signed in
 * (e.g. placing an order). A present-but-invalid token is a 401, so an
 * expired session is never silently treated as anonymous.
 */
async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return next();
  const token = header.slice("Bearer ".length);
  try {
    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data.user) {
      return res.status(401).json({ message: "Invalid or expired session" });
    }
    req.user = data.user;
    next();
  } catch (err) {
    console.error("[optionalAuth] auth check failed:", err);
    res.status(503).json({ message: "Authentication service unavailable, try again" });
  }
}

module.exports = optionalAuth;
