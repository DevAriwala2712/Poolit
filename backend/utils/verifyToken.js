const { createRemoteJWKSet, jwtVerify, decodeProtectedHeader } = require("jose");
const defaultDb = require("../config/supabaseClient");

/**
 * Turns a Supabase access token into `{ id, phone, email, role, ... }`.
 *
 * Fast path: if the project signs tokens with an asymmetric key (ES256 /
 * RS256 / EdDSA — Supabase "JWT signing keys"), verify the signature against
 * the project's cached JWKS. No network call per request.
 *
 * Fallback: tokens signed with the legacy shared secret (HS256), or any
 * failure to *reach* the JWKS endpoint, go through `auth.getUser()` as
 * before, so nothing breaks on projects that haven't rotated keys.
 *
 * A token that fails local verification (bad signature, expired, wrong
 * issuer/audience) is rejected outright — never "retried" via getUser.
 *
 * Trade-off: a locally-verified token stays valid until it expires (Supabase
 * default 1 hour) even if the user signs out elsewhere or is banned. Set
 * LOCAL_JWT_VERIFY=false to go back to a server check on every request.
 */
const ASYMMETRIC = new Set(["ES256", "RS256", "EdDSA"]);

let jwks;
function getJwks() {
  if (!jwks) {
    jwks = createRemoteJWKSet(new URL(`${process.env.SUPABASE_URL}/auth/v1/.well-known/jwks.json`), {
      cooldownDuration: 30_000,
      cacheMaxAge: 10 * 60_000,
    });
  }
  return jwks;
}

class InvalidTokenError extends Error {}
class AuthUnavailableError extends Error {}

async function viaAuthServer(token, db) {
  let res;
  try {
    res = await db.auth.getUser(token);
  } catch (err) {
    throw new AuthUnavailableError(err.message);
  }
  if (res.error || !res.data?.user) throw new InvalidTokenError("Invalid or expired session");
  return res.data.user;
}

function userFromClaims(c) {
  return {
    id: c.sub,
    phone: c.phone || null,
    email: c.email || null,
    role: c.role,
    app_metadata: c.app_metadata || {},
    user_metadata: c.user_metadata || {},
  };
}

async function verifyToken(token, { db = defaultDb, keys } = {}) {
  if (process.env.LOCAL_JWT_VERIFY === "false") return viaAuthServer(token, db);

  let alg;
  try {
    alg = decodeProtectedHeader(token).alg;
  } catch {
    throw new InvalidTokenError("Invalid or expired session");
  }
  if (!ASYMMETRIC.has(alg)) return viaAuthServer(token, db);

  try {
    const { payload } = await jwtVerify(token, keys || getJwks(), {
      issuer: `${process.env.SUPABASE_URL}/auth/v1`,
      audience: "authenticated",
      algorithms: [alg],
    });
    if (!payload.sub) throw new InvalidTokenError("Invalid or expired session");
    return userFromClaims(payload);
  } catch (err) {
    if (err instanceof InvalidTokenError) throw err;
    // Couldn't fetch/parse the key set → not the user's fault; ask the server.
    if (err.code === "ERR_JWKS_TIMEOUT" || err.code === "ERR_JOSE_GENERIC" || err.name === "TypeError" || err.code === "ERR_JWKS_NO_MATCHING_KEY") {
      return viaAuthServer(token, db);
    }
    throw new InvalidTokenError("Invalid or expired session");
  }
}

module.exports = { verifyToken, InvalidTokenError, AuthUnavailableError };
