const supabase = require("../config/supabaseClient");
const { toMenuItemJSON, toRestockLogJSON } = require("../utils/serialize");

// POST /menu-items/:itemId/restock
exports.restockItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      return res.status(400).json({ message: "amount must be a positive integer" });
    }

    const { data, error } = await supabase.rpc("restock_item", {
      p_item_id: itemId,
      p_amount: amount,
    });

    if (error) {
      if (error.message.includes("ITEM_NOT_FOUND")) {
        return res.status(404).json({ message: "Menu item not found" });
      }
      throw error;
    }

    res.json({
      message: "Restocked successfully",
      item: toMenuItemJSON(data.item),
      restockLog: toRestockLogJSON(data.restockLog),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to restock item" });
  }
};

// PATCH /menu-items/:itemId
// Vendor-side edits to an item's price and/or low-stock threshold.
exports.updateItem = async (req, res) => {
  try {
    const { price, lowStockThreshold } = req.body;
    const update = {};

    if (price !== undefined) {
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ message: "price must be a positive number" });
      }
      update.price = Math.round(price);
    }

    if (lowStockThreshold !== undefined) {
      if (
        typeof lowStockThreshold !== "number" ||
        !Number.isInteger(lowStockThreshold) ||
        lowStockThreshold < 0
      ) {
        return res
          .status(400)
          .json({ message: "lowStockThreshold must be a non-negative integer" });
      }
      update.lowStockThreshold = lowStockThreshold;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const dbUpdate = { updated_at: new Date().toISOString() };
    if (update.price !== undefined) dbUpdate.price = update.price;
    if (update.lowStockThreshold !== undefined) dbUpdate.low_stock_threshold = update.lowStockThreshold;

    const { data: item, error } = await supabase
      .from("menu_items")
      .update(dbUpdate)
      .eq("id", req.params.itemId)
      .select()
      .maybeSingle();
    if (error) throw error;
    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json(toMenuItemJSON(item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update menu item" });
  }
};

// GET /menu-items/:itemId/restock-log
exports.getRestockLog = async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from("restock_logs")
      .select("*")
      .eq("menu_item_id", req.params.itemId)
      .order("at", { ascending: false });
    if (error) throw error;
    res.json(logs.map(toRestockLogJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch restock log" });
  }
};
