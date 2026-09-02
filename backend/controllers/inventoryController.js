const supabase = require("../config/supabaseClient");
const { toMenuItemJSON } = require("../utils/serialize");

// GET /inventory?vendorId=&status=low|out
exports.getInventory = async (req, res) => {
  try {
    const { vendorId, status } = req.query;
    let query = supabase.from("menu_items").select("*");

    if (vendorId) {
      query = query.eq("vendor_id", vendorId);
    }

    if (status === "out") {
      query = query.eq("stock_qty", 0);
    }

    const { data: items, error } = await query.order("stock_qty").order("name");
    if (error) throw error;

    if (status === "low") {
      const low = items.filter(
        (i) => i.stock_qty > 0 && i.stock_qty <= i.low_stock_threshold
      );
      return res.json(low.map(toMenuItemJSON));
    }

    res.json(items.map(toMenuItemJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};
