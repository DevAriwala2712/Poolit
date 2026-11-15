const { reportError } = require("../utils/reportError");
const supabase = require("../config/supabaseClient");
const flags = require("../utils/flags");
const {
  toHostelJSON,
  toVendorJSON,
  toMenuItemJSON,
  toSlotJSON,
  toOrderJSON,
} = require("../utils/serialize");

const DEFAULT_DAYS = 7;
const MAX_DAYS = 31;

/** Which stores may this signed-in user see? null = not a vendor. */
async function storesFor(userId) {
  const { data, error } = await supabase.from("vendor_users").select("vendor_id").eq("user_id", userId);
  if (error) throw error;
  if (data.length === 0) return null;
  if (!flags.vendorScoping()) {
    const { data: all, error: allErr } = await supabase.from("vendors").select("id");
    if (allErr) throw allErr;
    return all.map((v) => v.id);
  }
  return data.map((r) => r.vendor_id);
}

/**
 * GET /vendor/revenue?days=30
 *
 * Daily revenue and order counts per store from the frozen order subtotals,
 * aggregated in the database (vendor_daily_revenue), for the Analytics chart.
 */
exports.getRevenue = async (req, res) => {
  try {
    const days = req.query.days;
    const vendorIds = await storesFor(req.user.id);
    if (!vendorIds) return res.status(403).json({ message: "This account isn't a vendor account" });

    const stores = await Promise.all(
      vendorIds.map(async (vendorId) => {
        const { data, error } = await supabase.rpc("vendor_daily_revenue", { p_vendor_id: vendorId, p_days: days });
        if (error) throw error;
        return {
          vendorId,
          days: data.map((r) => ({ day: r.day, orders: Number(r.orders), revenue: Number(r.revenue) })),
        };
      }),
    );
    res.json({ days, stores });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to load revenue" });
  }
};

/**
 * GET /vendor/overview?days=7
 *
 * Everything the vendor console renders, in one request and a fixed number of
 * queries: the vendor's stores with menus, every unfinished pool plus pools
 * from the last `days` days, and the orders in them. Replaces the console's
 * old per-store/per-pool fan-out, which grew with order history on every
 * 5-second poll.
 */
exports.getOverview = async (req, res) => {
  try {
    const days = Math.min(MAX_DAYS, Math.max(1, Number.parseInt(req.query.days, 10) || DEFAULT_DAYS));
    const since = new Date(Date.now() - days * 86_400_000).toISOString();

    const vendorIds = await storesFor(req.user.id);
    if (!vendorIds) {
      return res.status(403).json({ message: "This account isn't a vendor account" });
    }
    if (vendorIds.length === 0) {
      return res.json({ hostels: [], vendors: [], slots: [], orders: [] });
    }

    const [{ data: vendors, error: vErr }, { data: hostels, error: hErr }, { data: menu, error: mErr }] =
      await Promise.all([
        supabase.from("vendors").select("*").in("id", vendorIds).order("name"),
        supabase.from("hostels").select("*").order("name"),
        supabase.from("menu_items").select("*").in("vendor_id", vendorIds).order("category").order("name"),
      ]);
    if (vErr) throw vErr;
    if (hErr) throw hErr;
    if (mErr) throw mErr;

    // Keep each store's pool cycling (opens/rotates; see ensure_open_slot).
    await Promise.all(
      vendors.map((v) =>
        supabase.rpc("ensure_open_slot", { p_hostel_id: v.hostel_id }).then(({ error }) => {
          if (error) console.error(`[overview] pool rotation failed for ${v.hostel_id}:`, error.message);
        }),
      ),
    );

    // Recent pools + every unfinished pool, however old.
    const [{ data: recent, error: rErr }, { data: unfinished, error: uErr }] = await Promise.all([
      supabase.from("slots").select("*").in("vendor_id", vendorIds).gte("opens_at", since),
      supabase.from("slots").select("*").in("vendor_id", vendorIds).in("status", ["open", "closed"]),
    ]);
    if (rErr) throw rErr;
    if (uErr) throw uErr;
    const slots = [...new Map([...recent, ...unfinished].map((s) => [s.id, s])).values()].sort(
      (a, b) => new Date(b.opens_at) - new Date(a.opens_at),
    );

    let orders = [];
    if (slots.length > 0) {
      const { data, error: oErr } = await supabase
        .from("orders")
        .select("*")
        .in("slot_id", slots.map((s) => s.id))
        .order("created_at", { ascending: false });
      if (oErr) throw oErr;
      orders = data;
    }

    const menuByVendor = new Map();
    for (const item of menu) {
      const list = menuByVendor.get(item.vendor_id) || [];
      list.push(toMenuItemJSON(item));
      menuByVendor.set(item.vendor_id, list);
    }
    const hostelIds = new Set(vendors.map((v) => v.hostel_id));

    res.json({
      hostels: hostels.filter((h) => hostelIds.has(h.id)).map(toHostelJSON),
      vendors: vendors.map((v) => ({ ...toVendorJSON(v), menu: menuByVendor.get(v.id) || [] })),
      slots: slots.map(toSlotJSON),
      orders: orders.map(toOrderJSON),
      days,
    });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to load the console" });
  }
};
