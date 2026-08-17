import { Link, Navigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { Icon } from "../../components/Icon";
import { IconCircle } from "../../components/IconCircle";
import { Pill, titleCase } from "../../components/Pill";
import type { PillTone } from "../../components/Pill";
import { feeForOrderCount } from "../../domain/feeLadder";
import { pickListForSlot, useStore } from "../../domain/store";
import type { OrderStatus, SlotStatus } from "../../domain/types";
import { useCountdown } from "../../hooks/useCountdown";

const SLOT_TONE: Record<SlotStatus, PillTone> = {
  open: "warning",
  closed: "info",
  dispatched: "success",
};

const ORDER_TONE: Record<OrderStatus, PillTone> = {
  placed: "info",
  pooled: "warning",
  dispatched: "info",
  delivered: "success",
};

export function SlotDetail() {
  const { slotId } = useParams<{ slotId: string }>();
  const { slots, hostels, vendors, orders, closeSlot, dispatchSlot, markDelivered, reopenDemoSlot } =
    useStore();

  const slot = slots.find((s) => s.id === slotId);
  if (!slot) return <Navigate to="/vendor" replace />;

  const hostel = hostels.find((h) => h.id === slot.hostelId);
  const vendor = vendors.find((v) => v.id === slot.vendorId);
  const ordersInSlot = orders.filter((o) => o.slotId === slot.id);
  const fee = feeForOrderCount(ordersInSlot.length);
  const pickList = vendor ? pickListForSlot(orders, slot.id, vendor.menu) : [];

  return (
    <div className="space-y-6">
      <Link
        to="/vendor"
        className="inline-flex items-center gap-1.5 text-sm font-medium text-secondary hover:underline"
      >
        <Icon name="chevronRight" className="h-4 w-4 rotate-180" />
        All slots
      </Link>

      <div className="flex flex-wrap items-center gap-4 rounded-2xl bg-primary px-6 py-5 text-white">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white/10 text-lg font-bold">
          {hostel?.name.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-xl font-bold">{hostel?.name}</h2>
          <p className="truncate text-sm text-white/60">{vendor?.name}</p>
        </div>
        <div className="text-right">
          <Pill tone={SLOT_TONE[slot.status]}>{titleCase(slot.status)}</Pill>
          {slot.status === "open" && <SlotCountdown closesAt={slot.closesAt} />}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card title="Pooling status" subtitle={`${ordersInSlot.length} distinct orders in this slot`}>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-bold text-accent">{fee === 0 ? "Free" : `₹${fee}`}</span>
            <span className="text-sm text-muted">per student</span>
          </div>

          <div className="mt-5 flex gap-3">
            {slot.status === "open" && (
              <button
                onClick={() => closeSlot(slot.id)}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
              >
                Close pool now
              </button>
            )}
            {slot.status === "closed" && (
              <button
                onClick={() => dispatchSlot(slot.id)}
                className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-semibold text-white"
              >
                Mark dispatched
              </button>
            )}
            {slot.status === "dispatched" && (
              <button
                onClick={() => reopenDemoSlot(slot.id)}
                className="flex-1 rounded-xl border border-secondary py-2.5 text-sm font-semibold text-secondary"
              >
                Reset slot (demo)
              </button>
            )}
          </div>
        </Card>

        <Card
          title="Consolidated pick list"
          subtitle={`${pickList.length} distinct items to prepare`}
        >
          {pickList.length === 0 ? (
            <p className="py-4 text-sm text-muted">No orders yet.</p>
          ) : (
            <ul className="divide-y divide-surface">
              {pickList.map((line) => (
                <li key={line.menuItemId} className="flex items-center justify-between py-2.5 first:pt-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <IconCircle tone="secondary" size="sm">
                      <Icon name="box" className="h-3.5 w-3.5" />
                    </IconCircle>
                    <span className="truncate text-sm text-body">{line.name}</span>
                  </div>
                  <span className="ml-3 shrink-0 rounded-lg bg-surface px-2.5 py-1 text-sm font-semibold text-body">
                    × {line.totalQty}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card flush title="Orders" subtitle={`${ordersInSlot.length} students in this pool`}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="bg-surface/60 text-left text-[11px] uppercase tracking-wide whitespace-nowrap text-muted">
                <th className="px-5 py-2.5 font-semibold">Student</th>
                <th className="px-5 py-2.5 font-semibold">Items</th>
                <th className="px-5 py-2.5 font-semibold">Fee</th>
                <th className="px-5 py-2.5 font-semibold">Status</th>
                <th className="px-5 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {ordersInSlot.map((order) => (
                <tr
                  key={order.id}
                  className="border-b border-surface transition-colors last:border-0 hover:bg-surface/50"
                >
                  <td className="px-5 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-bold text-white">
                        {order.studentName.charAt(0)}
                      </span>
                      <span className="font-medium text-body">{order.studentName}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-muted">
                    {order.items.reduce((n, i) => n + i.qty, 0)} items
                  </td>
                  <td className="px-5 py-3.5 whitespace-nowrap text-body">
                    {order.deliveryFeeCharged !== undefined ? `₹${order.deliveryFeeCharged}` : "—"}
                  </td>
                  <td className="px-5 py-3.5">
                    <Pill tone={ORDER_TONE[order.status]}>{titleCase(order.status)}</Pill>
                  </td>
                  <td className="px-5 py-3.5 text-right whitespace-nowrap">
                    {order.status === "dispatched" && (
                      <button
                        onClick={() => markDelivered(order.id)}
                        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white transition hover:opacity-90"
                      >
                        Mark delivered
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function SlotCountdown({ closesAt }: { closesAt: number }) {
  const countdown = useCountdown(closesAt);
  return <p className="mt-1 text-xs font-semibold text-white/80">Closes in {countdown.label}</p>;
}
