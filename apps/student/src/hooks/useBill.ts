import { PLATFORM_FEE, PROMO_CODES, feeForOrderCount } from "@poolit/domain";
import type { MenuItem } from "@poolit/domain";
import { useMemo } from "react";
import { useCart } from "../state/CartContext";
import { useHostelContext } from "./useHostelContext";

export interface BillLine {
  item: MenuItem;
  qty: number;
  lineTotal: number;
}

export function useBill({ tip = 0, promo = "" }: { tip?: number; promo?: string } = {}) {
  const cart = useCart();
  const { vendor, orderCount } = useHostelContext();

  return useMemo(() => {
    const menu = vendor?.menu ?? [];
    const lines: BillLine[] = Object.entries(cart.lines)
      .map(([id, qty]) => {
        const item = menu.find((m) => m.id === id);
        return item ? { item, qty, lineTotal: item.price * qty } : null;
      })
      .filter((l): l is BillLine => l !== null);

    const itemTotal = lines.reduce((sum, l) => sum + l.lineTotal, 0);

    // Delivery fee comes straight from the pooling ladder. If this student's
    // order isn't in the pool yet, it will be — so preview the fee at
    // orderCount + 1.
    const projectedPoolSize = orderCount + 1;
    const deliveryFee = feeForOrderCount(projectedPoolSize);
    const savedVsSolo = feeForOrderCount(1) - deliveryFee;

    const promoEntry = PROMO_CODES[promo.trim().toUpperCase()];
    const promoDiscount = promoEntry ? Math.min(promoEntry.off, itemTotal) : 0;

    const platformFee = lines.length > 0 ? PLATFORM_FEE : 0;
    const total = Math.max(0, itemTotal + deliveryFee + platformFee + tip - promoDiscount);

    return {
      lines,
      itemTotal,
      deliveryFee,
      platformFee,
      tip,
      promoDiscount,
      promoLabel: promoEntry?.label,
      promoValid: promo.trim().length > 0 ? Boolean(promoEntry) : null,
      total,
      savedVsSolo,
      projectedPoolSize,
      isEmpty: lines.length === 0,
    };
  }, [cart.lines, vendor, orderCount, tip, promo]);
}
