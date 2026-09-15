const supabase = require("../config/supabaseClient");
const { toVendorJSON, toMenuItemJSON, toOrderJSON } = require("../utils/serialize");

// GET /vendors
exports.getAllVendors = async (req, res) => {
  try {
    const { data: vendors, error } = await supabase.from("vendors").select("*").order("name");
    if (error) throw error;

    // One query for all menu items instead of one round trip per vendor
    // (was N+1: a vendor list of 20 stores meant 21 sequential/parallel
    // Supabase calls just to render the vendor list).
    const vendorIds = vendors.map((v) => v.id);
    const menuByVendorId = new Map();
    if (vendorIds.length > 0) {
      const { data: allMenuItems, error: menuErr } = await supabase
        .from("menu_items")
        .select("*")
        .in("vendor_id", vendorIds)
        .order("category")
        .order("name");
      if (menuErr) throw menuErr;
      for (const item of allMenuItems) {
        const list = menuByVendorId.get(item.vendor_id) || [];
        list.push(item);
        menuByVendorId.set(item.vendor_id, list);
      }
    }

    const result = vendors.map((v) => ({
      ...toVendorJSON(v),
      menu: (menuByVendorId.get(v.id) || []).map(toMenuItemJSON),
    }));
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

// GET /vendors/:vendorId
exports.getVendorById = async (req, res) => {
  try {
    const { data: vendor, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", req.params.vendorId)
      .maybeSingle();
    if (error) throw error;
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const { data: menu, error: menuErr } = await supabase
      .from("menu_items")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("category")
      .order("name");
    if (menuErr) throw menuErr;

    res.json({
      ...toVendorJSON(vendor),
      menu: menu.map(toMenuItemJSON),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor" });
  }
};

// GET /vendors/:vendorId/menu
exports.getVendorMenu = async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("*")
      .eq("vendor_id", req.params.vendorId)
      .order("category")
      .order("name");
    if (error) throw error;
    res.json(items.map(toMenuItemJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch menu" });
  }
};

// GET /vendors/:vendorId/orders?status=
exports.getVendorOrders = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.query;

    const { data: slots, error: slotErr } = await supabase
      .from("slots")
      .select("id")
      .eq("vendor_id", vendorId);
    if (slotErr) throw slotErr;
    const slotIds = slots.map((s) => s.id);

    if (slotIds.length === 0) {
      return res.json([]);
    }

    let query = supabase.from("orders").select("*").in("slot_id", slotIds);
    if (status) {
      query = query.eq("status", status);
    }
    const { data: orders, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;

    res.json(orders.map(toOrderJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor orders" });
  }
};
