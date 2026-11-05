const { reportError } = require("../utils/reportError");
const supabase = require("../config/supabaseClient");
const { toHostelJSON, toVendorJSON, toMenuItemJSON, toSlotJSON } = require("../utils/serialize");

// GET /hostels
exports.getAllHostels = async (req, res) => {
  try {
    const { data, error } = await supabase.from("hostels").select("*").order("name");
    if (error) throw error;
    res.json(data.map(toHostelJSON));
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to fetch hostels" });
  }
};

// GET /hostels/:hostelId/current-slot
exports.getCurrentSlot = async (req, res) => {
  try {
    const { hostelId } = req.params;

    // Opens a pool if the hostel has none, rotates an expired one (closing it
    // and locking fees if anyone joined) — see ensure_open_slot() in
    // supabase/migrations/20261102023408_automatic_pool_rotation.sql.
    const { data: slot, error: slotErr } = await supabase.rpc("ensure_open_slot", {
      p_hostel_id: hostelId,
    });
    if (slotErr) {
      if (slotErr.message.includes("VENDOR_NOT_FOUND") || slotErr.code === "22P02") {
        return res.status(404).json({ message: "No store serves this hostel yet" });
      }
      throw slotErr;
    }
    if (!slot || !slot.id) {
      return res.status(404).json({ message: "No slot found for this hostel" });
    }

    const { data: vendor, error: vendorErr } = await supabase
      .from("vendors")
      .select("*")
      .eq("id", slot.vendor_id)
      .maybeSingle();
    if (vendorErr) throw vendorErr;
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found for slot" });
    }

    const { data: menuItems, error: menuErr } = await supabase
      .from("menu_items")
      .select("*")
      .eq("vendor_id", vendor.id)
      .order("category")
      .order("name");
    if (menuErr) throw menuErr;

    res.json({
      slot: toSlotJSON(slot),
      vendor: {
        ...toVendorJSON(vendor),
        menu: menuItems.map(toMenuItemJSON),
      },
    });
  } catch (err) {
    reportError(err, req);
    res.status(500).json({ message: "Failed to fetch current slot" });
  }
};
