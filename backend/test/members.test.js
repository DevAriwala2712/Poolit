process.env.SUPABASE_URL ||= "https://example.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "test-key";
const test = require("node:test");
const assert = require("node:assert/strict");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

const dbWithRole = (role) => ({
  from: () => {
    const b = { select: () => b, eq: () => b, limit: () => b, maybeSingle: async () => ({ data: role ? { role } : null, error: null }) };
    return b;
  },
});
function run(mw, req) {
  return new Promise((resolve) => {
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b }); } };
    mw({ user: { id: "u" }, params: { vendorId: "v1" }, ...req }, res, () => resolve({ code: 200 }));
  });
}

test("alwaysScoped team routes refuse staff and strangers even with scoping off", async () => {
  delete process.env.ENFORCE_VENDOR_SCOPING;
  const mk = (role) => requireVendorAccess(vendorFrom.param, { roles: ["owner"], alwaysScoped: true, db: dbWithRole(role) });
  assert.equal((await run(mk("staff"))).code, 403);
  assert.equal((await run(mk(null))).code, 403);
  assert.equal((await run(mk("owner"))).code, 200);
});

test("without alwaysScoped and scoping off, any vendor passes (legacy behaviour)", async () => {
  delete process.env.ENFORCE_VENDOR_SCOPING;
  const mw = requireVendorAccess(vendorFrom.param, { roles: ["owner"], db: dbWithRole("staff") });
  assert.equal((await run(mw)).code, 200);
});
