const supabase = require("../config/supabaseClient");
const { toMenuItemJSON, toRestockLogJSON } = require("../utils/serialize");

// Mirrors the DB check constraint on menu_items.category and
// frontend/packages/domain/src/types.ts CATEGORIES.
const CATEGORIES = ["Snacks", "Instant Food", "Drinks", "Essentials", "Fresh", "Midnight Cravings"];

// POST /vendors/:vendorId/menu-items
exports.createItem = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { name, category, price, unit, stockQty, lowStockThreshold, isVeg, art, tint } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ message: "name is required" });
    }
    if (!CATEGORIES.includes(category)) {
      return res.status(400).json({ message: `category must be one of: ${CATEGORIES.join(", ")}` });
    }
    if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
      return res.status(400).json({ message: "price must be a positive number" });
    }
    if (!unit || typeof unit !== "string" || !unit.trim()) {
      return res.status(400).json({ message: "unit is required" });
    }
    if (stockQty !== undefined && (typeof stockQty !== "number" || !Number.isInteger(stockQty) || stockQty < 0)) {
      return res.status(400).json({ message: "stockQty must be a non-negative integer" });
    }
    if (
      lowStockThreshold !== undefined &&
      (typeof lowStockThreshold !== "number" || !Number.isInteger(lowStockThreshold) || lowStockThreshold < 0)
    ) {
      return res.status(400).json({ message: "lowStockThreshold must be a non-negative integer" });
    }

    const { data: item, error } = await supabase
      .from("menu_items")
      .insert({
        vendor_id: vendorId,
        name: name.trim(),
        category,
        price: Math.round(price),
        unit: unit.trim(),
        stock_qty: stockQty ?? 0,
        low_stock_threshold: lowStockThreshold ?? 5,
        is_veg: typeof isVeg === "boolean" ? isVeg : true,
        art: typeof art === "string" && art.trim() ? art.trim() : "📦",
        tint: typeof tint === "string" && tint.trim() ? tint.trim() : "#F1EDE6",
      })
      .select()
      .single();
    if (error) {
      if (error.code === "23503") {
        return res.status(404).json({ message: "Vendor not found" });
      }
      throw error;
    }

    res.status(201).json(toMenuItemJSON(item));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to create menu item" });
  }
};

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
    const { price, lowStockThreshold, barcode } = req.body;
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

    if (barcode !== undefined) {
      if (barcode !== null && (typeof barcode !== "string" || !barcode.trim())) {
        return res
          .status(400)
          .json({ message: "barcode must be a non-empty string or null" });
      }
      update.barcode = barcode === null ? null : barcode.trim();
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const dbUpdate = { updated_at: new Date().toISOString() };
    if (update.price !== undefined) dbUpdate.price = update.price;
    if (update.lowStockThreshold !== undefined) dbUpdate.low_stock_threshold = update.lowStockThreshold;
    if (update.barcode !== undefined) dbUpdate.barcode = update.barcode;

    const { data: item, error } = await supabase
      .from("menu_items")
      .update(dbUpdate)
      .eq("id", req.params.itemId)
      .select()
      .maybeSingle();
    if (error) {
      // Unique violation on (vendor_id, barcode) — see migration add_barcode_to_menu_items.
      if (error.code === "23505") {
        return res
          .status(409)
          .json({ message: "This barcode is already assigned to another item for this store" });
      }
      throw error;
    }
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
