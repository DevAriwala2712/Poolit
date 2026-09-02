const supabase = require("../config/supabaseClient");
const { toSlotJSON } = require("./serialize");

/**
 * Idempotent close-slot logic. Delegates to the close_slot() Postgres
 * function so the read-fee-write sequence is atomic.
 */
async function closeSlot(slotId) {
  const { data, error } = await supabase.rpc("close_slot", { p_slot_id: slotId });
  if (error) {
    if (error.message.includes("SLOT_NOT_FOUND")) {
      throw Object.assign(new Error("Slot not found"), { status: 404 });
    }
    throw error;
  }

  return {
    slot: data.alreadyClosed ? data.slot : data.slot,
    fee: data.fee,
    orderCount: data.orderCount,
    alreadyClosed: data.alreadyClosed,
  };
}

/**
 * Lazy evaluation: close the slot if its timer has expired.
 */
async function ensureSlotClosedIfExpired(slot) {
  if (
    slot &&
    slot.status === "open" &&
    Date.now() >= new Date(slot.closes_at).getTime()
  ) {
    const result = await closeSlot(slot.id);
    return { slot: result.slot, alreadyClosed: result.alreadyClosed, skipped: false };
  }
  return { slot, alreadyClosed: false, skipped: true };
}

module.exports = { closeSlot, ensureSlotClosedIfExpired, toSlotJSON };
