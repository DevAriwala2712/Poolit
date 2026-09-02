const supabase = require("../config/supabaseClient");

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

  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) {
    return res.status(401).json({ message: "Invalid or expired session" });
  }

  req.user = data.user;
  next();
}

module.exports = requireAuth;
