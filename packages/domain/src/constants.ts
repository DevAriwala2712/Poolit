/** Demo-length pooling window. Stands in for a real meal-time slot. */
export const SLOT_DURATION_MINUTES = 10;

/** Flat platform fee per order, in ₹. */
export const PLATFORM_FEE = 4;

/** Tip presets offered at checkout, in ₹. */
export const TIP_PRESETS = [0, 10, 20, 30];

/** Promo codes the prototype accepts. */
export const PROMO_CODES: Record<string, { off: number; label: string }> = {
  HOSTEL50: { off: 50, label: "₹50 off your first pooled order" },
  MIDNIGHT: { off: 25, label: "₹25 off late-night cravings" },
};
