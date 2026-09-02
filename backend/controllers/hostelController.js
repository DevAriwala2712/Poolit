const supabase = require("../config/supabaseClient");
const { toHostelJSON, toVendorJSON, toMenuItemJSON, toSlotJSON } = require("../utils/serialize");
const { ensureSlotClosedIfExpired } = require("../utils/slotCloser");

// GET /hostels
exports.getAllHostels = async (req, res) => {
  try {
    const { data, error } = await supabase.from("hostels").select("*").order("name");
    if (error) throw error;
    res.json(data.map(toHostelJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch hostels" });
  }
};

// GET /hostels/:hostelId/current-slot
exports.getCurrentSlot = async (req, res) => {
  try {
    const { hostelId } = req.params;

    let { data: slot } = await supabase
      .from("slots")
      .select("*")
      .eq("hostel_id", hostelId)
      .eq("status", "open")
      .order("opens_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!slot) {
      const { data } = await supabase
        .from("slots")
        .select("*")
        .eq("hostel_id", hostelId)
        .order("opens_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      slot = data;
    }

    if (!slot) {
      return res.status(404).json({ message: "No slot found for this hostel" });
    }

    const closeResult = await ensureSlotClosedIfExpired(slot);
    if (!closeResult.skipped) {
      slot = closeResult.slot;
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
    console.error(err);
    res.status(500).json({ message: "Failed to fetch current slot" });
  }
};
