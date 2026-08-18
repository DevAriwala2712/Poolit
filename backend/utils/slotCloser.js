const Slot = require("../models/Slot");
const Order = require("../models/Order");
const { feeForOrderCount } = require("./feeLadder");

/**
 * Idempotent close-slot logic.
 */
async function closeSlot(slotId, session = null) {
  const opts = session ? { session } : {};

  const slot = await Slot.findById(slotId).session(session || null);
  if (!slot) {
    throw Object.assign(new Error("Slot not found"), { status: 404 });
  }

  // Already closed or dispatched → idempotent no-op
  if (slot.status !== "open") {
    return { slot, alreadyClosed: true };
  }

  const orders = await Order.find({ slotId: slot._id, status: "placed" }).session(
    session || null
  );
  const orderCount = orders.length;
  const fee = feeForOrderCount(orderCount);

  if (orders.length > 0) {
    await Order.updateMany(
      { slotId: slot._id, status: "placed" },
      {
        $set: {
          deliveryFeeCharged: fee,
          status: "pooled",
        },
      },
      opts
    );
  }

  slot.status = "closed";
  await slot.save(opts);

  return { slot, fee, orderCount, alreadyClosed: false };
}

/**
 * Lazy evaluation: close the slot if its timer has expired.
 */
async function ensureSlotClosedIfExpired(slot, session = null) {
  if (
    slot &&
    slot.status === "open" &&
    Date.now() >= new Date(slot.closesAt).getTime()
  ) {
    return closeSlot(slot._id, session);
  }
  return { slot, alreadyClosed: false, skipped: true };
}

module.exports = { closeSlot, ensureSlotClosedIfExpired };