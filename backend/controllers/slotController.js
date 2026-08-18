const mongoose = require("mongoose");
const Slot = require("../models/Slot");
const Order = require("../models/Order");
const MenuItem = require("../models/MenuItem");
const { closeSlot, ensureSlotClosedIfExpired } = require("../utils/slotCloser");

// GET /slots/:slotId
exports.getSlotById = async (req, res) => {
  try {
    let slot = await Slot.findById(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    const result = await ensureSlotClosedIfExpired(slot);
    if (!result.skipped) {
      slot = result.slot;
    }

    res.json(slot);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch slot" });
  }
};

// GET /slots/:slotId/orders
exports.getSlotOrders = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await ensureSlotClosedIfExpired(slot);

    const orders = await Order.find({ slotId: slot._id }).sort({ createdAt: 1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch orders" });
  }
};

// GET /slots/:slotId/pick-list
exports.getPickList = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await ensureSlotClosedIfExpired(slot);

    const orders = await Order.find({ slotId: slot._id });

    const qtyMap = new Map();
    for (const order of orders) {
      for (const line of order.items) {
        const key = line.menuItemId.toString();
        qtyMap.set(key, (qtyMap.get(key) || 0) + line.qty);
      }
    }

    const menuItemIds = [...qtyMap.keys()];
    const menuItems = await MenuItem.find({ _id: { $in: menuItemIds } });
    const nameMap = new Map(menuItems.map((m) => [m._id.toString(), m.name]));

    const pickList = menuItemIds.map((id) => ({
      menuItemId: id,
      name: nameMap.get(id) || "Unknown",
      totalQty: qtyMap.get(id),
    }));

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
      slot: result.slot,
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
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const slot = await Slot.findById(req.params.slotId).session(session);
    if (!slot) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Slot not found" });
    }

    if (slot.status !== "closed") {
      await session.abortTransaction();
      return res.status(409).json({
        message: `Cannot dispatch slot in status "${slot.status}". Expected "closed".`,
      });
    }

    slot.status = "dispatched";
    await slot.save({ session });

    await Order.updateMany(
      { slotId: slot._id, status: "pooled" },
      { $set: { status: "dispatched" } },
      { session }
    );

    await session.commitTransaction();
    res.json({
      message: "Slot dispatched successfully",
      slot,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ message: "Failed to dispatch slot" });
  } finally {
    session.endSession();
  }
};