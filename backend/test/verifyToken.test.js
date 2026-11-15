process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";
const test = require("node:test");
const assert = require("node:assert/strict");

const ISS = `${process.env.SUPABASE_URL}/auth/v1`;
let jose, verifyToken, InvalidTokenError, privateKey, keys;

test.before(async () => {
  jose = await import("jose");
  ({ verifyToken, InvalidTokenError } = require("../utils/verifyToken"));
  const pair = await jose.generateKeyPair("ES256");
  privateKey = pair.privateKey;
  const jwk = { ...(await jose.exportJWK(pair.publicKey)), kid: "k1", alg: "ES256", use: "sig" };
  keys = jose.createLocalJWKSet({ keys: [jwk] });
});

const sign = (claims = {}, { exp = "1h", iss = ISS, aud = "authenticated", key } = {}) =>
  new jose.SignJWT({ phone: "+911234567890", role: "authenticated", ...claims })
    .setProtectedHeader({ alg: "ES256", kid: "k1" })
    .setSubject("user-1").setIssuer(iss).setAudience(aud).setIssuedAt().setExpirationTime(exp)
    .sign(key || privateKey);

const neverCalled = { auth: { getUser: async () => { throw new Error("server should not be called"); } } };

test("valid asymmetric token verifies locally, without calling the auth server", async () => {
  const user = await verifyToken(await sign(), { db: neverCalled, keys });
  assert.equal(user.id, "user-1");
  assert.equal(user.phone, "+911234567890");
});

test("expired, wrong issuer, wrong audience and forged tokens are rejected, not retried", async () => {
  const bad = [
    await sign({}, { exp: Math.floor(Date.now() / 1000) - 60 }),
    await sign({}, { iss: "https://evil.example/auth/v1" }),
    await sign({}, { aud: "anon" }),
    await sign({}, { key: (await jose.generateKeyPair("ES256")).privateKey }),
  ];
  for (const t of bad) {
    await assert.rejects(verifyToken(t, { db: neverCalled, keys }), InvalidTokenError);
  }
});

test("garbage token → InvalidTokenError", async () => {
  await assert.rejects(verifyToken("not.a.jwt", { db: neverCalled, keys }), InvalidTokenError);
});

test("legacy HS256 token falls back to the auth server", async () => {
  const hs = await new jose.SignJWT({}).setProtectedHeader({ alg: "HS256" }).setSubject("u2").sign(new TextEncoder().encode("secret"));
  const db = { auth: { getUser: async () => ({ data: { user: { id: "u2" } }, error: null }) } };
  assert.equal((await verifyToken(hs, { db, keys })).id, "u2");
  const rejecting = { auth: { getUser: async () => ({ data: { user: null }, error: { message: "bad" } }) } };
  await assert.rejects(verifyToken(hs, { db: rejecting, keys }), InvalidTokenError);
});

test("unreachable JWKS falls back to the auth server", async () => {
  const brokenKeys = async () => { throw new TypeError("fetch failed"); };
  const db = { auth: { getUser: async () => ({ data: { user: { id: "user-1" } }, error: null }) } };
  assert.equal((await verifyToken(await sign(), { db, keys: brokenKeys })).id, "user-1");
});

test("LOCAL_JWT_VERIFY=false always asks the server", async () => {
  process.env.LOCAL_JWT_VERIFY = "false";
  let calls = 0;
  const db = { auth: { getUser: async () => (calls++, { data: { user: { id: "x" } }, error: null }) } };
  await verifyToken(await sign(), { db, keys });
  delete process.env.LOCAL_JWT_VERIFY;
  assert.equal(calls, 1);
});
