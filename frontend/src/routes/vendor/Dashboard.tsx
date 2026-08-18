import { useNavigate } from "react-router-dom";
import { BarList } from "../../components/BarList";
import { Card } from "../../components/Card";
import { Donut } from "../../components/Donut";
import { Icon } from "../../components/Icon";
import { Pill, titleCase } from "../../components/Pill";
import type { PillTone } from "../../components/Pill";
import { StatCard } from "../../components/StatCard";
import { feeForOrderCount } from "../../domain/feeLadder";
import { useStore } from "../../domain/store";
import type { Order, Slot, SlotStatus, Vendor } from "../../domain/types";
import { useCountdown } from "../../hooks/useCountdown";

function dayLabel(ms: number): string {
  const diffHours = (Date.now() - ms) / (1000 * 60 * 60);
  if (diffHours < 12) return "Today";
  if (diffHours < 36) return "Yesterday";
  return `${Math.floor(diffHours / 24)} days ago`;
}

const SLOT_TONE: Record<SlotStatus, PillTone> = {
  open: "warning",
  closed: "info",
  dispatched: "success",
};

function orderValue(order: Order, vendor: Vendor | undefined): number {
  return order.items.reduce(
    (sum, i) => sum + (vendor?.menu.find((m) => m.id === i.menuItemId)?.price ?? 0) * i.qty,
    0,
  );
}

function percentDelta(current: number, previous: number): { label: string; direction: "up" | "down" | "flat" } {
  if (previous === 0) return { label: current > 0 ? "New today" : "No change", direction: "flat" };
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) return { label: "Flat vs yesterday", direction: "flat" };
  return {
    label: `${Math.abs(pct)}% vs yesterday`,
    direction: pct > 0 ? "up" : "down",
  };
}

function ClosesIn({ closesAt }: { closesAt: number }) {
  const countdown = useCountdown(closesAt);
  return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
      <Icon name="clock" className="h-3.5 w-3.5" />
      {countdown.label}
    </span>
  );
}

function SlotTable({ slots, showCloses }: { slots: Slot[]; showCloses: boolean }) {
  const { hostels, vendors, orders } = useStore();
  const navigate = useNavigate();

  if (slots.length === 0) {
    return <p className="px-5 py-8 text-center text-sm text-muted">Nothing here yet.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-sm">
        <thead>
          <tr className="bg-surface/60 text-left text-[11px] uppercase tracking-wide whitespace-nowrap text-muted">
            <th className="px-4 py-2.5 font-semibold">Hostel</th>
            <th className="px-4 py-2.5 font-semibold">Vendor</th>
            <th className="px-4 py-2.5 font-semibold">Status</th>
            <th className="px-4 py-2.5 font-semibold">Orders</th>
            <th className="px-4 py-2.5 font-semibold">Fee / Student</th>
            <th className="px-4 py-2.5 font-semibold">Revenue</th>
            <th className="px-4 py-2.5 font-semibold">{showCloses ? "Closes In" : "When"}</th>
            <th className="px-4 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {slots.map((slot) => {
            const hostel = hostels.find((h) => h.id === slot.hostelId);
            const vendor = vendors.find((v) => v.id === slot.vendorId);
            const ordersInSlot = orders.filter((o) => o.slotId === slot.id);
            const fee = feeForOrderCount(ordersInSlot.length);
            const revenue = ordersInSlot.reduce((sum, o) => sum + orderValue(o, vendor), 0);

            return (
              <tr
                key={slot.id}
                onClick={() => navigate(`/vendor/slot/${slot.id}`)}
                className="group cursor-pointer border-b border-surface transition-colors last:border-0 hover:bg-surface/50"
              >
                <td className="px-4 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                      {hostel?.name.charAt(0)}
                    </span>
                    <span className="font-medium text-body">{hostel?.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3.5 whitespace-nowrap text-muted">{vendor?.name}</td>
                <td className="px-4 py-3.5">
                  <Pill tone={SLOT_TONE[slot.status]}>{titleCase(slot.status)}</Pill>
                </td>
                <td className="px-4 py-3.5 font-medium text-body">{ordersInSlot.length}</td>
                <td className="px-4 py-3.5 text-body">{fee === 0 ? "Free" : `₹${fee}`}</td>
                <td className="px-4 py-3.5 font-semibold text-body">₹{revenue.toLocaleString("en-IN")}</td>
                <td className="px-4 py-3.5 whitespace-nowrap">
                  {showCloses && slot.status === "open" ? (
                    <ClosesIn closesAt={slot.closesAt} />
                  ) : (
                    <span className="text-xs text-muted">{dayLabel(slot.opensAt)}</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Icon
                    name="chevronRight"
                    className="ml-auto h-4 w-4 text-muted/40 transition group-hover:translate-x-0.5 group-hover:text-secondary"
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function VendorDashboard() {
  const { slots, orders, vendors, hostels } = useStore();

  const liveSlots = [...slots]
    .filter((s) => s.status !== "dispatched")
    .sort((a, b) => a.closesAt - b.closesAt);
  const pastSlots = [...slots]
    .filter((s) => s.status === "dispatched")
    .sort((a, b) => b.opensAt - a.opensAt);

  const vendorFor = (slotId: string) =>
    vendors.find((v) => v.id === slots.find((s) => s.id === slotId)?.vendorId);

  const ordersOn = (label: string) => {
    const ids = slots.filter((s) => dayLabel(s.opensAt) === label).map((s) => s.id);
    return orders.filter((o) => ids.includes(o.slotId));
  };
  const revenueOf = (list: Order[]) =>
    list.reduce((sum, o) => sum + orderValue(o, vendorFor(o.slotId)), 0);

  const todayOrders = ordersOn("Today");
  const yesterdayOrders = ordersOn("Yesterday");
  const todayRevenue = revenueOf(todayOrders);
  const yesterdayRevenue = revenueOf(yesterdayOrders);

  const openSlots = liveSlots.filter((s) => s.status === "open");
  const awaitingDispatch = liveSlots.filter((s) => s.status === "closed").length;
  const lowStockCount = vendors.reduce(
    (sum, v) => sum + v.menu.filter((m) => m.stockQty <= m.lowStockThreshold).length,
    0,
  );
  const outOfStockCount = vendors.reduce(
    (sum, v) => sum + v.menu.filter((m) => m.stockQty === 0).length,
    0,
  );

  const barData = openSlots.map((s) => ({
    label: hostels.find((h) => h.id === s.hostelId)?.name ?? s.hostelId,
    value: orders.filter((o) => o.slotId === s.id).length,
  }));

  const revenueByVendor = vendors
    .map((vendor) => ({
      label: vendor.name,
      value: orders
        .filter((o) => slots.find((s) => s.id === o.slotId)?.vendorId === vendor.id)
        .reduce((sum, o) => sum + orderValue(o, vendor), 0),
    }))
    .filter((s) => s.value > 0)
    .sort((a, b) => b.value - a.value);

  const totalRevenue = revenueByVendor.reduce((sum, s) => sum + s.value, 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <StatCard
          label="Active Pools"
          value={String(openSlots.length)}
          icon="activity"
          tone="secondary"
          delta={{ label: `${awaitingDispatch} awaiting dispatch`, direction: "flat" }}
        />
        <StatCard
          label="Orders Today"
          value={String(todayOrders.length)}
          icon="receipt"
          tone="primary"
          delta={percentDelta(todayOrders.length, yesterdayOrders.length)}
        />
        <StatCard
          label="Revenue Today"
          value={`₹${todayRevenue.toLocaleString("en-IN")}`}
          icon="wallet"
          tone="accent"
          delta={percentDelta(todayRevenue, yesterdayRevenue)}
        />
        <StatCard
          label="Low Stock"
          value={String(lowStockCount)}
          icon="alert"
          tone={lowStockCount > 0 ? "danger" : "secondary"}
          delta={{ label: `${outOfStockCount} out of stock`, direction: outOfStockCount > 0 ? "down" : "flat" }}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card
          className="lg:col-span-3"
          title="Orders per hostel"
          subtitle="Currently open pools"
        >
          {barData.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted">No open pools right now.</p>
          ) : (
            <BarList items={barData} unit=" orders" />
          )}
        </Card>

        <Card
          className="lg:col-span-2"
          title="Revenue by vendor"
          subtitle="All slots"
        >
          <Donut
            segments={revenueByVendor}
            centerValue={`₹${(totalRevenue / 1000).toFixed(1)}k`}
            centerLabel="total"
            formatValue={(v) => `₹${v.toLocaleString("en-IN")}`}
          />
        </Card>
      </div>

      <Card
        flush
        title="Active Slots"
        subtitle={`${liveSlots.length} slots open or awaiting dispatch`}
      >
        <SlotTable slots={liveSlots} showCloses />
      </Card>

      <Card flush title="Order History" subtitle={`${pastSlots.length} completed slots`}>
        <SlotTable slots={pastSlots} showCloses={false} />
      </Card>
    </div>
  );
}
