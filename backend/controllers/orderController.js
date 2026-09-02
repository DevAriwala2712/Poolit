const supabase = require("../config/supabaseClient");
const { toOrderJSON } = require("../utils/serialize");
const { ensureSlotClosedIfExpired } = require("../utils/slotCloser");
const { feeForOrderCount } = require("../utils/feeLadder");

// POST /slots/:slotId/orders
exports.placeOrder = async (req, res) => {
  try {
    const { slotId } = req.params;
    const { studentName, items, block, room, tip, paymentMethod, note } = req.body;

    if (!studentName || typeof studentName !== "string" || !studentName.trim()) {
      return res.status(400).json({ message: "studentName is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "items array is required and cannot be empty" });
    }

    for (const line of items) {
      const { menuItemId, qty } = line;
      if (!menuItemId || !qty || qty < 1 || !Number.isInteger(qty)) {
        return res.status(400).json({
          message: "Each item must have menuItemId and positive integer qty",
        });
      }
    }

    const { data: order, error } = await supabase.rpc("place_order", {
      p_slot_id: slotId,
      p_student_name: studentName.trim(),
      p_block: typeof block === "string" ? block.trim() : null,
      p_room: typeof room === "string" ? room.trim() : null,
      p_tip: Number.isFinite(tip) && tip > 0 ? tip : 0,
      p_payment_method: typeof paymentMethod === "string" ? paymentMethod.trim() : null,
      p_note: typeof note === "string" && note.trim() ? note.trim().slice(0, 140) : null,
      p_items: items.map((line) => ({ menuItemId: line.menuItemId, qty: line.qty })),
    });

    if (error) {
      if (error.message.includes("SLOT_NOT_FOUND")) {
        return res.status(404).json({ message: "Slot not found" });
      }
      if (error.message.includes("SLOT_NOT_OPEN")) {
        const status = error.message.split(":")[1];
        return res.status(409).json({ message: `Cannot place order: slot is "${status}"` });
      }
      if (error.message.includes("INSUFFICIENT_STOCK")) {
        return res.status(409).json({ message: "Insufficient stock for one or more items" });
      }
      if (error.message.includes("WRONG_VENDOR")) {
        const itemName = error.message.split(":")[1];
        return res.status(400).json({
          message: `Menu item "${itemName}" does not belong to this vendor`,
        });
      }
      throw error;
    }

    res.status(201).json(toOrderJSON(order));
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to place order", error: err.message });
  }
};

// POST /orders/:orderId/deliver
exports.markDelivered = async (req, res) => {
  try {
    const { data: order, error } = await supabase
      .from("orders")
      .select("*")
      .eq("id", req.params.orderId)
      .maybeSingle();
    if (error) throw error;
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "dispatched") {
      return res.status(409).json({
        message: `Cannot mark delivered: order is currently "${order.status}". Expected "dispatched".`,
      });
    }

    const { data: updated, error: updateErr } = await supabase
      .from("orders")
      .update({ status: "delivered", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .select()
      .single();
    if (updateErr) throw updateErr;

    res.json({
      message: "Order marked as delivered",
      order: toOrderJSON(updated),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark order delivered" });
  }
};

// GET /slots/:slotId/live-fee
exports.getLiveFee = async (req, res) => {
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

    const { count, error: countErr } = await supabase
      .from("orders")
      .select("*", { count: "exact", head: true })
      .eq("slot_id", slot.id)
      .in("status", ["placed", "pooled"]);
    if (countErr) throw countErr;

    const fee = feeForOrderCount(count);
    res.json({ orderCount: count, fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to compute live fee" });
  }
};
