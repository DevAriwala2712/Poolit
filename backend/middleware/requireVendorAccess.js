const supabase = require("../config/supabaseClient");

/**
 * Per-store authorisation for vendor routes. Runs AFTER requireAuth.
 *
 * Until now any signed-in vendor could act on any store. This checks that
 * req.user is linked to the store that owns the resource, via the
 * `vendor_users` table (supabase/migrations/20261102000100_vendor_users.sql).
 *
 * Rollout switch: enforcement is OFF unless ENFORCE_VENDOR_SCOPING=true, so
 * deploying this code before the migration is applied changes nothing. Once
 * the table exists and every vendor login is linked to its store(s), set the
 * env var and redeploy. See docs/PHASE1_RUNBOOK.md.
 *
 * `resolveVendorId(req)` returns the vendor (store) id that owns whatever the
 * route touches, or null if the resource doesn't exist.
 */
function requireVendorAccess(resolveVendorId, { roles, db = supabase } = {}) {
  return async (req, res, next) => {
    if (process.env.ENFORCE_VENDOR_SCOPING !== "true") return next();
    if (!req.user) return res.status(401).json({ message: "Not signed in" });

    try {
      const vendorId = await resolveVendorId(req, db);
      if (!vendorId) return res.status(404).json({ message: "Not found" });

      const { data, error } = await db
        .from("vendor_users")
        .select("role")
        .eq("user_id", req.user.id)
        .eq("vendor_id", vendorId)
        .maybeSingle();
      if (error) throw error;

      if (!data || (roles && !roles.includes(data.role))) {
        return res.status(403).json({ message: "You don't have access to this store" });
      }
      req.vendorId = vendorId;
      req.vendorRole = data.role;
      next();
    } catch (err) {
      console.error("[requireVendorAccess]", err);
      res.status(500).json({ message: "Authorisation check failed" });
    }
  };
}

async function lookup(db, table, id, column = "vendor_id") {
  if (!id) return null;
  const { data, error } = await db.from(table).select(column).eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? data[column] : null;
}

/** Resolvers for each route shape: which store owns this resource? */
const vendorFrom = {
  param: async (req) => req.params.vendorId || null,
  menuItem: (req, db) => lookup(db, "menu_items", req.params.itemId),
  slot: (req, db) => lookup(db, "slots", req.params.slotId),
  staff: (req, db) => lookup(db, "staff", req.params.staffId),
  order: async (req, db) => {
    const slotId = await lookup(db, "orders", req.params.orderId, "slot_id");
    return slotId ? lookup(db, "slots", slotId) : null;
  },
};

module.exports = { requireVendorAccess, vendorFrom };
