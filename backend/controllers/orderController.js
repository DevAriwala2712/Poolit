const mongoose = require("mongoose");
const Order = require("../models/Order");
const Slot = require("../models/Slot");
const MenuItem = require("../models/MenuItem");
const { ensureSlotClosedIfExpired } = require("../utils/slotCloser");
const { feeForOrderCount } = require("../utils/feeLadder");

// POST /slots/:slotId/orders
exports.placeOrder = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { slotId } = req.params;
    const { studentName, items, block, room, tip, paymentMethod, note } = req.body;

    if (!studentName || typeof studentName !== "string" || !studentName.trim()) {
      await session.abortTransaction();
      return res.status(400).json({ message: "studentName is required" });
    }
    if (!Array.isArray(items) || items.length === 0) {
      await session.abortTransaction();
      return res.status(400).json({ message: "items array is required and cannot be empty" });
    }

    let slot = await Slot.findById(slotId).session(session);
    if (!slot) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Slot not found" });
    }

    const closeResult = await ensureSlotClosedIfExpired(slot, session);
    if (!closeResult.skipped) {
      slot = closeResult.slot;
    }

    if (slot.status !== "open") {
      await session.abortTransaction();
      return res.status(409).json({
        message: `Cannot place order: slot is "${slot.status}"`,
      });
    }

    const validatedItems = [];
    for (const line of items) {
      const { menuItemId, qty } = line;
      if (!menuItemId || !qty || qty < 1 || !Number.isInteger(qty)) {
        await session.abortTransaction();
        return res.status(400).json({
          message: "Each item must have menuItemId and positive integer qty",
        });
      }

      const updatedItem = await MenuItem.findOneAndUpdate(
        { _id: menuItemId, stockQty: { $gte: qty } },
        { $inc: { stockQty: -qty } },
        { new: true, session }
      );

      if (!updatedItem) {
        await session.abortTransaction();
        const existing = await MenuItem.findById(menuItemId);
        if (!existing) {
          return res.status(404).json({ message: `Menu item ${menuItemId} not found` });
        }
        return res.status(409).json({
          message: `Insufficient stock for "${existing.name}". Available: ${existing.stockQty}, requested: ${qty}`,
        });
      }

      if (updatedItem.vendorId.toString() !== slot.vendorId.toString()) {
        await session.abortTransaction();
        return res.status(400).json({
          message: `Menu item "${updatedItem.name}" does not belong to this vendor`,
        });
      }

      validatedItems.push({
        menuItemId: updatedItem._id,
        qty,
      });
    }

    const [order] = await Order.create(
      [
        {
          slotId: slot._id,
          studentName: studentName.trim(),
          block: typeof block === "string" ? block.trim() : undefined,
          room: typeof room === "string" ? room.trim() : undefined,
          tip: Number.isFinite(tip) && tip > 0 ? tip : 0,
          paymentMethod:
            typeof paymentMethod === "string" ? paymentMethod.trim() : undefined,
          note: typeof note === "string" && note.trim() ? note.trim().slice(0, 140) : undefined,
          items: validatedItems,
          status: "placed",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    res.status(201).json(order);
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ message: "Failed to place order", error: err.message });
  } finally {
    session.endSession();
  }
};

// POST /orders/:orderId/deliver
exports.markDelivered = async (req, res) => {
  try {
    const order = await Order.findById(req.params.orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (order.status !== "dispatched") {
      return res.status(409).json({
        message: `Cannot mark delivered: order is currently "${order.status}". Expected "dispatched".`,
      });
    }

    order.status = "delivered";
    await order.save();

    res.json({
      message: "Order marked as delivered",
      order,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to mark order delivered" });
  }
};

// GET /slots/:slotId/live-fee
exports.getLiveFee = async (req, res) => {
  try {
    const slot = await Slot.findById(req.params.slotId);
    if (!slot) {
      return res.status(404).json({ message: "Slot not found" });
    }

    await ensureSlotClosedIfExpired(slot);

    const count = await Order.countDocuments({
      slotId: slot._id,
      status: { $in: ["placed", "pooled"] },
    });

    const fee = feeForOrderCount(count);
    res.json({ orderCount: count, fee });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to compute live fee" });
  }
};