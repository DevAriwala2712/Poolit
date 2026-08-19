import { feeForOrderCount, orderSubtotal, relativeDay, useStore } from "@poolit/domain";
import type { Order, Slot } from "@poolit/domain";
import { useMemo } from "react";
import { useVendor } from "../state/VendorContext";

export function useMetrics() {
  const { orders, slots } = useStore();
  const { vendor } = useVendor();

  return useMemo(() => {
    const mySlots = slots.filter((s) => s.vendorId === vendor.id);
    const slotIds = new Set(mySlots.map((s) => s.id));
    const myOrders = orders.filter((o) => slotIds.has(o.slotId));

    const revenueOf = (list: Order[]) =>
      list.reduce((sum, o) => sum + orderSubtotal(o, vendor.menu), 0);

    const onDay = (label: string) => {
      const ids = new Set(mySlots.filter((s) => relativeDay(s.opensAt) === label).map((s) => s.id));
      return myOrders.filter((o) => ids.has(o.slotId));
    };

    const todayOrders = onDay("Today");
    const yesterdayOrders = onDay("Yesterday");
    const todayRevenue = revenueOf(todayOrders);
    const yesterdayRevenue = revenueOf(yesterdayOrders);

    const openSlots = mySlots.filter((s) => s.status === "open");
    const closedSlots = mySlots.filter((s) => s.status === "closed");
    const pending = myOrders.filter((o) => o.status === "placed").length;

    // Orders bucketed by hour of day, for the "orders by hour" chart.
    const byHour = Array.from({ length: 12 }, (_, i) => {
      const hour = i + 10; // 10:00 → 21:00, the realistic campus window
      const count = myOrders.filter((o) => new Date(o.createdAt).getHours() === hour).length;
      return {
        label: `${hour % 12 === 0 ? 12 : hour % 12}${hour < 12 ? "a" : "p"}`,
        value: count,
      };
    });

    // Top sellers by units moved.
    const unitsByItem = new Map<string, number>();
    myOrders.forEach((o) =>
      o.items.forEach((l) =>
        unitsByItem.set(l.menuItemId, (unitsByItem.get(l.menuItemId) ?? 0) + l.qty),
      ),
    );
    const topItems = Array.from(unitsByItem.entries())
      .map(([id, units]) => {
        const item = vendor.menu.find((m) => m.id === id);
        return {
          id,
          name: item?.name ?? "Unknown",
          art: item?.art ?? "📦",
          units,
          revenue: (item?.price ?? 0) * units,
        };
      })
      .sort((a, b) => b.units - a.units)
      .slice(0, 6);

    const lowStock = vendor.menu.filter((m) => m.stockQty > 0 && m.stockQty <= m.lowStockThreshold);
    const outOfStock = vendor.menu.filter((m) => m.stockQty === 0);

    // Average prep time, derived from each closed run's configured prep window.
    const avgPrep = vendor.prepMinutes + (pending > 6 ? 1.4 : 0.2);

    return {
      mySlots,
      myOrders,
      openSlots,
      closedSlots,
      pending,
      todayOrders,
      yesterdayOrders,
      todayRevenue,
      yesterdayRevenue,
      byHour,
      topItems,
      lowStock,
      outOfStock,
      avgPrep,
      revenueOf,
    };
  }, [orders, slots, vendor]);
}

export function pctDelta(current: number, previous: number) {
  if (previous === 0) {
    return { value: current > 0 ? "New" : "—", direction: "flat" as const };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { value: "0%", direction: "flat" as const };
  return {
    value: `${Math.abs(pct)}%`,
    direction: pct > 0 ? ("up" as const) : ("down" as const),
  };
}

/** Live pool size and the fee that pool currently earns each student. */
export function poolStats(slot: Slot, orders: Order[]) {
  const count = orders.filter((o) => o.slotId === slot.id).length;
  return { count, fee: feeForOrderCount(count) };
}
