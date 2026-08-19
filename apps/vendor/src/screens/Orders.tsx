import {
  ORDER_STAGE_LABEL,
  clockTime,
  countdown,
  orderItemCount,
  orderSubtotal,
  pickListForSlot,
  relativeDay,
  rupees,
  useStore,
} from "@poolit/domain";
import type { Order, OrderStatus } from "@poolit/domain";
import { useMemo, useState } from "react";
import { Drawer } from "../components/Drawer";
import { Icon } from "../components/Icon";
import { Badge, Button, Card, EmptyState, Td, Th } from "../components/ui";
import type { Tone } from "../components/ui";
import { useMetrics } from "../hooks/useMetrics";
import { useNow } from "../hooks/useNow";
import { useVendor } from "../state/VendorContext";

const STATUS_TONE: Record<OrderStatus, Tone> = {
  placed: "info",
  pooled: "warn",
  dispatched: "accent",
  delivered: "ok",
};

const FILTERS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "placed", label: "New" },
  { key: "pooled", label: "Preparing" },
  { key: "dispatched", label: "On the way" },
  { key: "delivered", label: "Delivered" },
];

export function Orders() {
  const now = useNow();
  const { vendor, hostel } = useVendor();
  const { orders, markDelivered, closeSlot, dispatchSlot } = useStore();
  const m = useMetrics();

  const [filter, setFilter] = useState<OrderStatus | "all">("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const rows = useMemo(() => {
    let list = [...m.myOrders].sort((a, b) => b.createdAt - a.createdAt);
    if (filter !== "all") list = list.filter((o) => o.status === filter);
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        (o) =>
          o.studentName.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q) ||
          `${o.block} ${o.room}`.toLowerCase().includes(q),
      );
    }
    return list;
  }, [m.myOrders, filter, query]);

  const order = orders.find((o) => o.id === selected) ?? null;
  const activeSlot = m.mySlots.find((s) => s.status === "open");

  function toggle(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function bulkDeliver() {
    checked.forEach((id) => {
      const o = orders.find((x) => x.id === id);
      if (o?.status === "dispatched") markDelivered(id);
    });
    setChecked(new Set());
  }

  return (
    <div className="space-y-4">
      {/* Active pool banner */}
      {activeSlot && (
        <div className="flex flex-wrap items-center gap-3 rounded-[var(--radius-card)] border border-accent/25 bg-accent/[0.06] px-4 py-3">
          <Badge tone="accent" live>
            Pool open
          </Badge>
          <p className="min-w-0 flex-1 text-[12.5px] text-muted">
            <span className="font-medium text-text">
              {orders.filter((o) => o.slotId === activeSlot.id).length} orders
            </span>{" "}
            in the {hostel?.name} run · closes in{" "}
            <span className="font-medium tabular-nums text-text">
              {countdown(activeSlot.closesAt, now)}
            </span>
          </p>
          <Button size="sm" onClick={() => closeSlot(activeSlot.id)}>
            Close pool now
          </Button>
        </div>
      )}

      <Card flush>
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5 border-b border-line-soft px-4 py-3">
          <div className="flex items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5">
            <Icon name="search" className="h-3.5 w-3.5 text-faint" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Student, room or ID…"
              className="w-48 bg-transparent text-[12.5px] text-text outline-none placeholder:text-faint"
            />
          </div>

          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`rounded-lg px-2.5 py-1.5 text-[12px] font-medium transition ${
                  filter === f.key ? "bg-raised text-text" : "text-faint hover:text-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="ml-auto text-[11.5px] text-faint">{rows.length} orders</span>

          {checked.size > 0 && (
            <div className="flex items-center gap-2 border-l border-line pl-2.5">
              <span className="text-[11.5px] text-muted">{checked.size} selected</span>
              <Button size="sm" variant="accent" onClick={bulkDeliver}>
                Mark delivered
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>
                Clear
              </Button>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="orders"
            title="No orders match"
            body="Try a different status filter or clear your search."
            action={
              <Button
                size="sm"
                onClick={() => {
                  setFilter("all");
                  setQuery("");
                }}
              >
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[840px] border-collapse">
              <thead>
                <tr className="border-b border-line-soft bg-panel/40">
                  <Th className="w-10" />
                  <Th>Order</Th>
                  <Th>Student</Th>
                  <Th>Items</Th>
                  <Th>Amount</Th>
                  <Th>Status</Th>
                  <Th>Time</Th>
                  <Th className="text-right">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => (
                  <tr
                    key={o.id}
                    onClick={() => setSelected(o.id)}
                    className="cursor-pointer border-b border-line-soft transition-colors last:border-0 hover:bg-raised/50"
                  >
                    <Td>
                      <input
                        type="checkbox"
                        checked={checked.has(o.id)}
                        onChange={() => toggle(o.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-3.5 w-3.5 accent-[var(--color-accent)]"
                      />
                    </Td>
                    <Td className="font-mono text-[11.5px] text-faint">
                      #{o.id.slice(-6).toUpperCase()}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-raised text-[11px] font-semibold text-muted">
                          {o.studentName.charAt(0)}
                        </span>
                        <div>
                          <p className="text-[12.5px] text-text">{o.studentName}</p>
                          <p className="text-[11px] text-faint">
                            {o.block}, Room {o.room}
                          </p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-muted">{orderItemCount(o)} items</Td>
                    <Td className="font-medium text-text">
                      {rupees(orderSubtotal(o, vendor.menu))}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[o.status]} live={o.status === "placed"}>
                        {ORDER_STAGE_LABEL[o.status]}
                      </Badge>
                    </Td>
                    <Td className="text-faint">
                      {relativeDay(o.createdAt)}, {clockTime(o.createdAt)}
                    </Td>
                    <Td className="text-right">
                      {o.status === "dispatched" ? (
                        <Button
                          size="sm"
                          variant="accent"
                          onClick={(e) => {
                            e.stopPropagation();
                            markDelivered(o.id);
                          }}
                        >
                          Delivered
                        </Button>
                      ) : (
                        <Icon name="chevronRight" className="ml-auto h-3.5 w-3.5 text-faint" />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <OrderDrawer
        order={order}
        onClose={() => setSelected(null)}
        onDeliver={() => order && markDelivered(order.id)}
        onDispatch={() => order && dispatchSlot(order.slotId)}
        onClosePool={() => order && closeSlot(order.slotId)}
      />
    </div>
  );
}

function OrderDrawer({
  order,
  onClose,
  onDeliver,
  onDispatch,
  onClosePool,
}: {
  order: Order | null;
  onClose: () => void;
  onDeliver: () => void;
  onDispatch: () => void;
  onClosePool: () => void;
}) {
  const { orders, slots } = useStore();
  const { vendor, hostel } = useVendor();

  if (!order) return null;

  const slot = slots.find((s) => s.id === order.slotId);
  const poolSize = orders.filter((o) => o.slotId === order.slotId).length;
  const subtotal = orderSubtotal(order, vendor.menu);
  const fee = order.deliveryFeeCharged;
  const pickList = slot ? pickListForSlot(orders, slot.id, vendor.menu) : [];

  return (
    <Drawer
      open
      onClose={onClose}
      title={`Order #${order.id.slice(-6).toUpperCase()}`}
      subtitle={`${order.studentName} · ${order.block}, Room ${order.room}`}
      footer={
        <div className="flex gap-2">
          {slot?.status === "open" && (
            <Button className="flex-1" onClick={onClosePool}>
              Close pool
            </Button>
          )}
          {slot?.status === "closed" && (
            <Button variant="accent" className="flex-1" onClick={onDispatch}>
              Mark run dispatched
            </Button>
          )}
          {order.status === "dispatched" && (
            <Button variant="accent" className="flex-1" onClick={onDeliver}>
              Mark delivered
            </Button>
          )}
          {order.status === "delivered" && (
            <Button className="flex-1" disabled>
              Completed
            </Button>
          )}
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Badge tone={STATUS_TONE[order.status]}>{ORDER_STAGE_LABEL[order.status]}</Badge>
          <Badge tone="neutral">{hostel?.name}</Badge>
          <Badge tone="neutral">
            {relativeDay(order.createdAt)}, {clockTime(order.createdAt)}
          </Badge>
        </div>

        {/* Items */}
        <div className="overflow-hidden rounded-lg border border-line">
          <p className="border-b border-line-soft bg-panel px-3 py-2 text-[11.5px] font-medium uppercase tracking-wider text-faint">
            Items
          </p>
          <ul className="divide-y divide-line-soft">
            {order.items.map((line) => {
              const item = vendor.menu.find((m) => m.id === line.menuItemId);
              if (!item) return null;
              return (
                <li key={line.menuItemId} className="flex items-center gap-2.5 px-3 py-2.5">
                  <span className="text-base">{item.art}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] text-text">{item.name}</p>
                    <p className="text-[11px] text-faint">{item.unit}</p>
                  </div>
                  <span className="text-[12px] text-muted">× {line.qty}</span>
                  <span className="w-14 text-right text-[12.5px] font-medium text-text">
                    {rupees(item.price * line.qty)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bill */}
        <div className="space-y-1.5 rounded-lg border border-line p-3 text-[12.5px]">
          <Row label="Item total" value={rupees(subtotal)} />
          <Row
            label={`Delivery fee (${poolSize} pooled)`}
            value={fee === undefined ? "not locked yet" : fee === 0 ? "FREE" : rupees(fee)}
          />
          {order.tip ? <Row label="Rider tip" value={rupees(order.tip)} /> : null}
          <div className="flex justify-between border-t border-line-soft pt-2 text-[13.5px] font-semibold text-text">
            <span>Total</span>
            <span>{rupees(subtotal + (fee ?? 0) + (order.tip ?? 0))}</span>
          </div>
          {order.paymentMethod && (
            <p className="pt-0.5 text-[11px] text-faint">Paid via {order.paymentMethod}</p>
          )}
        </div>

        {order.note && (
          <div className="rounded-lg border border-warn/25 bg-warn/[0.06] p-3">
            <p className="text-[11px] font-medium uppercase tracking-wider text-warn">
              Delivery note
            </p>
            <p className="mt-1 text-[12.5px] italic text-muted">"{order.note}"</p>
          </div>
        )}

        {/* Consolidated pick list for the whole run */}
        {pickList.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <p className="border-b border-line-soft bg-panel px-3 py-2 text-[11.5px] font-medium uppercase tracking-wider text-faint">
              Full run pick list · {poolSize} orders
            </p>
            <ul className="max-h-56 divide-y divide-line-soft overflow-y-auto">
              {pickList.map((line) => (
                <li key={line.menuItemId} className="flex items-center gap-2.5 px-3 py-2">
                  <span className="text-sm">{line.art}</span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-muted">
                    {line.name}
                  </span>
                  <span className="rounded bg-raised px-1.5 py-0.5 text-[11.5px] font-semibold text-text">
                    × {line.totalQty}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Drawer>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-muted">
      <span>{label}</span>
      <span className="font-medium text-text">{value}</span>
    </div>
  );
}
