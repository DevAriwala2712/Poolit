/** Fee per student based on distinct orders currently in the same slot. */
export function feeForOrderCount(orderCount: number): number {
  if (orderCount <= 0) return 20;
  if (orderCount <= 2) return 20;
  if (orderCount <= 5) return 10;
  if (orderCount <= 10) return 5;
  return 0;
}

/** Orders needed before the fee drops to the next cheaper tier, or null if already free. */
export function ordersUntilNextTier(orderCount: number): number | null {
  if (orderCount < 3) return 3 - orderCount;
  if (orderCount < 6) return 6 - orderCount;
  if (orderCount < 11) return 11 - orderCount;
  return null;
}
