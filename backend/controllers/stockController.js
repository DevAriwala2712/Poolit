const supabase = require("../config/supabaseClient");
const { toMenuItemJSON } = require("../utils/serialize");

const REASONS = ["count", "damaged", "expired", "correction", "other"];

function toAdjustmentJSON(row) {
  return {
    id: row.id,
    vendorId: row.vendor_id,
    menuItemId: row.menu_item_id,
    reason: row.reason,
    previousQty: row.previous_qty,
    newQty: row.new_qty,
    delta: row.delta,
    note: row.note ?? undefined,
    at: new Date(row.at).getTime(),
  };
}

// POST /menu-items/:itemId/barcode — give the item its own EAN-13 (idempotent)
exports.generateBarcode = async (req, res) => {
  try {
    const { data, error } = await supabase.rpc("generate_item_barcode", { p_item_id: req.params.itemId });
    if (error) {
      if (error.message.includes("ITEM_NOT_FOUND")) return res.status(404).json({ message: "Menu item not found" });
      throw error;
    }
    res.json(toMenuItemJSON(data));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate a barcode" });
  }
};

// POST /vendors/:vendorId/barcodes — generate for every item in the store that has none
exports.generateMissingBarcodes = async (req, res) => {
  try {
    const { data: items, error } = await supabase
      .from("menu_items")
      .select("id")
      .eq("vendor_id", req.params.vendorId)
      .is("barcode", null);
    if (error) throw error;

    const generated = [];
    for (const { id } of items) {
      const { data, error: rpcErr } = await supabase.rpc("generate_item_barcode", { p_item_id: id });
      if (rpcErr) throw rpcErr;
      generated.push(toMenuItemJSON(data));
    }
    res.json({ generated: generated.length, items: generated });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to generate barcodes" });
  }
};

// POST /menu-items/:itemId/adjust { mode: "set"|"remove", qty, reason, note? }
exports.adjustStock = async (req, res) => {
  try {
    const { mode, qty, reason, note } = req.body || {};
    if (mode !== "set" && mode !== "remove") {
      return res.status(400).json({ message: 'mode must be "set" or "remove"' });
    }
    if (typeof qty !== "number" || !Number.isInteger(qty) || qty < (mode === "remove" ? 1 : 0) || qty > 100000) {
      return res.status(400).json({ message: "qty must be a whole number (0–100,000; at least 1 to remove)" });
    }
    const why = reason ?? (mode === "set" ? "count" : "damaged");
    if (!REASONS.includes(why)) {
      return res.status(400).json({ message: `reason must be one of: ${REASONS.join(", ")}` });
    }
    if (note !== undefined && note !== null && (typeof note !== "string" || note.length > 140)) {
      return res.status(400).json({ message: "note must be text (max 140 characters)" });
    }

    const { data, error } = await supabase.rpc("adjust_stock", {
      p_item_id: req.params.itemId,
      p_mode: mode,
      p_qty: qty,
      p_reason: why,
      p_user_id: req.user?.id ?? null,
      p_note: note ?? null,
    });
    if (error) {
      if (error.message.includes("ITEM_NOT_FOUND")) return res.status(404).json({ message: "Menu item not found" });
      if (error.message.includes("NOT_ENOUGH_STOCK")) {
        const have = error.message.split(":")[1];
        return res.status(409).json({ message: `Only ${have} in stock — can't remove more than that` });
      }
      if (error.message.includes("INVALID_QTY")) return res.status(400).json({ message: "Invalid quantity" });
      throw error;
    }
    res.json({ item: toMenuItemJSON(data.item), adjustment: toAdjustmentJSON(data.adjustment) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to adjust stock" });
  }
};

// GET /menu-items/:itemId/stock-history — restocks and adjustments, newest first
exports.getStockHistory = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const [{ data: restocks, error: rErr }, { data: adjustments, error: aErr }] = await Promise.all([
      supabase.from("restock_logs").select("*").eq("menu_item_id", itemId).order("at", { ascending: false }).limit(50),
      supabase.from("stock_adjustments").select("*").eq("menu_item_id", itemId).order("at", { ascending: false }).limit(50),
    ]);
    if (rErr) throw rErr;
    if (aErr) throw aErr;

    const entries = [
      ...restocks.map((r) => ({ id: r.id, kind: "restock", delta: r.amount, at: new Date(r.at).getTime() })),
      ...adjustments.map((a) => ({ ...toAdjustmentJSON(a), kind: a.reason })),
    ].sort((a, b) => b.at - a.at);
    res.json(entries.slice(0, 50));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load stock history" });
  }
};
