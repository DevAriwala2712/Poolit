const supabase = require("../config/supabaseClient");
const { toSlotJSON, toOrderJSON } = require("../utils/serialize");
const { closeSlot, ensureSlotClosedIfExpired } = require("../utils/slotCloser");

// GET /slots/:slotId
exports.getSlotById = async (req, res) => {
  try {
    let { data: slot, error } = await supabase
      .from("slots")
      .select("*")
      .eq("id", req.params.slotId)
      .maybeSingle();
    if (error) throw error;
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    const result = await ensureSlotClosedIfExpired(slot);
    if (!result.skipped) {
      slot = result.slot;
    }

    res.json(toSlotJSON(slot));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch slot" });
  }
};

// GET /slots/:slotId/orders
exports.getSlotOrders = async (req, res) => {
  try {
    const { data: slot, error } = await supabase
      .from("slots")
      .select("*")
      .eq("id", req.params.slotId)
      .maybeSingle();
    if (error) throw error;
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await ensureSlotClosedIfExpired(slot);

    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .eq("slot_id", slot.id)
      .order("created_at", { ascending: true });
    if (ordersErr) throw ordersErr;

    res.json(orders.map(toOrderJSON));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// GET /slots/:slotId/pick-list
exports.getPickList = async (req, res) => {
  try {
    const { data: slot, error } = await supabase
      .from("slots")
      .select("*")
      .eq("id", req.params.slotId)
      .maybeSingle();
    if (error) throw error;
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await ensureSlotClosedIfExpired(slot);

    const { data: orders, error: ordersErr } = await supabase
      .from("orders")
      .select("*")
      .eq("slot_id", slot.id);
    if (ordersErr) throw ordersErr;

    const qtyMap = new Map();
    for (const order of orders) {
      for (const line of order.items) {
        const key = line.menuItemId;
        qtyMap.set(key, (qtyMap.get(key) || 0) + line.qty);
      }
    }

    const menuItemIds = [...qtyMap.keys()];
    let itemMap = new Map();
    if (menuItemIds.length > 0) {
      const { data: menuItems, error: menuErr } = await supabase
        .from("menu_items")
        .select("*")
        .in("id", menuItemIds);
      if (menuErr) throw menuErr;
      itemMap = new Map(menuItems.map((m) => [m.id, m]));
    }

    // Heaviest lines first — that's the order a packer works through the run.
    const pickList = menuItemIds
      .map((id) => ({
        menuItemId: id,
        name: itemMap.get(id)?.name || "Unknown item",
        art: itemMap.get(id)?.art || "📦",
        totalQty: qtyMap.get(id),
      }))
      .sort((a, b) => b.totalQty - a.totalQty);

    res.json(pickList);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to build pick list" });
  }
};

// POST /slots/:slotId/close
exports.closeSlotHandler = async (req, res) => {
  try {
    const result = await closeSlot(req.params.slotId);
    res.json({
      message: result.alreadyClosed
        ? "Slot was already closed"
        : "Slot closed successfully",
      slot: toSlotJSON(result.slot),
      fee: result.fee,
      orderCount: result.orderCount,
    });
  } catch (err) {
    console.error(err);
    const status = err.status || 500;
    res.status(status).json({ message: err.message || "Failed to close slot" });
  }
};

// POST /slots/:slotId/dispatch
exports.dispatchSlot = async (req, res) => {
  try {
    const { data: slot, error } = await supabase.rpc("dispatch_slot", {
      p_slot_id: req.params.slotId,
    });

    if (error) {
      if (error.message.includes("SLOT_NOT_FOUND")) {
        return res.status(404).json({ message: "Slot not found" });
      }
      if (error.message.includes("SLOT_NOT_CLOSED")) {
        return res.status(409).json({
          message: `Cannot dispatch slot in status "${error.message.split(":")[1]}". Expected "closed".`,
        });
      }
      throw error;
    }

    res.json({
      message: "Slot dispatched successfully",
      slot: toSlotJSON(slot),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to dispatch slot" });
  }
};
