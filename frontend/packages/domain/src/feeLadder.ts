/**
 * Delivery fee per student, based on the number of DISTINCT ORDERS currently
 * in the same slot — not total item quantity and not order value.
 *
 * | Orders in slot | Fee per student |
 * |----------------|-----------------|
 * | 1–2            | ₹20             |
 * | 3–5            | ₹10             |
 * | 6–10           | ₹5              |
 * | 10+            | Free            |
 *
 * Recomputed live while a slot is open; locked onto each order at slot close.
 */
export function feeForOrderCount(orderCount: number): number {
  if (orderCount <= 2) return 20;
  if (orderCount <= 5) return 10;
  if (orderCount <= 10) return 5;
  return 0;
}

/** Orders still needed before the fee drops a tier, or null once it's free. */
export function ordersUntilNextTier(orderCount: number): number | null {
  if (orderCount < 3) return 3 - orderCount;
  if (orderCount < 6) return 6 - orderCount;
  if (orderCount < 11) return 11 - orderCount;
  return null;
}

/** The fee a pool reaches once `ordersUntilNextTier` more students join. */
export function nextTierFee(orderCount: number): number | null {
  const remaining = ordersUntilNextTier(orderCount);
  if (remaining === null) return null;
  return feeForOrderCount(orderCount + remaining);
}

export const FEE_TIERS = [
  { minOrders: 1, maxOrders: 2, fee: 20 },
  { minOrders: 3, maxOrders: 5, fee: 10 },
  { minOrders: 6, maxOrders: 10, fee: 5 },
  { minOrders: 11, maxOrders: Infinity, fee: 0 },
] as const;
