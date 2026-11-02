const supabase = require("../config/supabaseClient");
const flags = require("../utils/flags");

/**
 * Vendor authorisation for vendor routes. Runs AFTER requireAuth.
 *
 * Two levels:
 *  - Always: the signed-in user must be a vendor, i.e. have at least one row
 *    in `vendor_users`. Students sign in to the same Supabase project with
 *    their phone, so "has a valid session" no longer means "is a vendor".
 *  - With ENFORCE_VENDOR_SCOPING=true: the user must be linked to the store
 *    that owns this particular resource (and have the right role).
 *
 * `resolveVendorId(req, db)` returns the vendor (store) id that owns whatever
 * the route touches, or null if the resource doesn't exist.
 */
function requireVendorAccess(resolveVendorId, { roles, db = supabase, alwaysScoped = false } = {}) {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ message: "Not signed in" });

    try {
      // alwaysScoped: sensitive routes (team management) never fall back to the
      // "any vendor" behaviour, whatever ENFORCE_VENDOR_SCOPING says.
      if (!alwaysScoped && !flags.vendorScoping()) {
        const { data, error } = await db
          .from("vendor_users")
          .select("vendor_id")
          .eq("user_id", req.user.id)
          .limit(1)
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(403).json({ message: "This account isn't a vendor account" });
        return next();
      }

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
