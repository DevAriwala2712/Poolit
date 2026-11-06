import { api } from "@poolit/domain";
import type { CashSummary } from "@poolit/domain";
import { useEffect, useState } from "react";

/**
 * The store's cash for today (what it should hold, what it recorded, what is still
 * out). Loaded when the screen opens and again whenever `refreshKey` changes, e.g.
 * after an order is handed over. Stays null on the old backend, which has no summary.
 */
export function useCashSummary(vendorId: string | undefined, refreshKey: number): CashSummary | null {
  const [summary, setSummary] = useState<CashSummary | null>(null);
  useEffect(() => {
    if (!vendorId) return;
    let live = true;
    api
      .getCashSummary(vendorId)
      .then((s) => live && setSummary(s))
      .catch(() => live && setSummary(null));
    return () => {
      live = false;
    };
  }, [vendorId, refreshKey]);
  return summary;
}
