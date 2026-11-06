/**
 * Cash on delivery helpers. The database decides what counts as cash on delivery
 * (private.is_cod in supabase/migrations/20261106100000_cod_and_fees.sql): keep these
 * two in step.
 */

/** True for the student app's "Cash on delivery" choice (and "COD" / "Cash"). */
export function isCashOnDelivery(paymentMethod: string | null | undefined): boolean {
  if (!paymentMethod) return false;
  const m = paymentMethod.trim().toLowerCase();
  return m === "cod" || m.startsWith("cash");
}

/** Paise to rupees for display; undefined stays undefined (amount not known yet). */
export function cashDueRupees(paise: number | undefined): number | undefined {
  return paise === undefined ? undefined : paise / 100;
}
