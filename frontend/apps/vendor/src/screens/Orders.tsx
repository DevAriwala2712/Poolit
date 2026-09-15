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
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button, Card, EmptyState, Td, Th } from "../components/ui";
import type { Tone } from "../components/ui";
import { useMetrics } from "../hooks/useMetrics";
import { useNow } from "../hooks/useNow";
import { useUIMode } from "../state/UIModeContext";
import { useVendor } from "../state/VendorContext";

const STATUS_TONE: Record<OrderStatus, Tone> = {
  placed: "error",
  pooled: "ready",
  dispatched: "dispatched",
  delivered: "delivered",
};

const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: "Needs Kitchen Action",
  pooled: "In Delivery Pool",
  dispatched: "Dispatched",
  delivered: "Delivered",
};

const FILTERS: { key: OrderStatus | "all"; label: string }[] = [
  { key: "all", label: "All Orders" },
  { key: "placed", label: "Action Needed" },
  { key: "pooled", label: "In Delivery Pools" },
  { key: "dispatched", label: "Dispatched" },
  { key: "delivered", label: "Delivered" },
];

export function Orders() {
  const now = useNow();
  const { vendor, hostel } = useVendor();
  const { orders, markDelivered, closeSlot, dispatchSlot } = useStore();
  const { advancedMode } = useUIMode();
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

  const countOf = (key: OrderStatus | "all") =>
    key === "all" ? m.myOrders.length : m.myOrders.filter((o) => o.status === key).length;

  return (
    <div className="space-y-space-md">
      {/* Header band */}
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <div className="flex items-center gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Orders Management</h1>
            <span className="rounded bg-surface-container-highest px-space-xs py-space-2xs text-label-sm uppercase text-secondary">
              Live Station
            </span>
          </div>
          <p className="mt-space-2xs flex items-center gap-space-xs text-body-sm text-secondary">
            <span className="h-1.5 w-1.5 animate-live rounded-full bg-primary" />
            {m.myOrders.length} Total Today · {m.pending} Active Operational Now
          </p>
        </div>
        <div className="flex items-center gap-space-sm">
          <span className="flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-sm py-space-xs text-body-sm text-on-surface shadow-sm">
            <MaterialIcon name="speed" className="text-[16px] text-tertiary" />
            Avg Prep: {m.avgPrep.toFixed(1)}m
          </span>
          <span className="flex items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-sm py-space-xs text-body-sm text-on-surface shadow-sm">
            <MaterialIcon name="local_shipping" className="text-[16px] text-primary" />
            Active Pools: {m.mySlots.filter((s) => s.status !== "dispatched").length} Runs
          </span>
          {advancedMode && (
            <Button variant="primary" icon="print">
              Batch KOT <span className="opacity-70">⌘P</span>
            </Button>
          )}
        </div>
      </div>

      {activeSlot && (
        <div className="flex flex-wrap items-center gap-space-sm rounded-lg bg-surface-container-lowest p-space-md shadow-sm">
          <Badge tone="prep" live>Pool open</Badge>
          <p className="min-w-0 flex-1 text-body-md text-secondary">
            <span className="text-on-surface">{orders.filter((o) => o.slotId === activeSlot.id).length} orders</span>{" "}
            in the {hostel?.name} run · closes in{" "}
            <span className="font-semibold text-on-surface">{countdown(activeSlot.closesAt, now)}</span>
          </p>
          <Button size="sm" onClick={() => closeSlot(activeSlot.id)}>Close pool now</Button>
        </div>
      )}

      <Card flush>
        {/* Toolbar */}
        <div className="flex flex-col gap-space-sm border-b border-surface-container-low p-space-md">
          <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low px-space-sm py-space-xs">
            <MaterialIcon name="search" className="text-[16px] text-secondary" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by student, room or order ID…"
              className="w-full bg-transparent text-body-lg text-on-surface outline-none placeholder:text-secondary"
            />
          </div>
          <div className="flex flex-wrap items-center gap-space-xs">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-space-xs rounded px-space-sm py-space-xs text-body-md transition ${
                  filter === f.key
                    ? "bg-inverse-surface text-inverse-on-surface"
                    : "text-secondary hover:bg-surface-container"
                }`}
              >
                {f.label}
                <span className="rounded-full bg-surface-container-highest px-space-xs text-label-sm text-on-surface">
                  {countOf(f.key)}
                </span>
              </button>
            ))}
          </div>

          {advancedMode && checked.size > 0 && (
            <div className="flex items-center gap-space-sm rounded-lg bg-primary-container/10 p-space-sm">
              <span className="rounded bg-primary-container px-space-xs py-space-2xs text-label-sm text-on-primary-container">
                {checked.size}
              </span>
              <span className="flex-1 text-body-sm text-secondary">Orders selected across active hostel runs</span>
              <Button size="sm" variant="primary" onClick={bulkDeliver}>Mark Delivered</Button>
              <Button size="sm" variant="ghost" onClick={() => setChecked(new Set())}>Clear</Button>
            </div>
          )}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            icon="receipt_long"
            title="No orders match"
            body="Try a different status filter or clear your search."
            action={
              <Button size="sm" onClick={() => { setFilter("all"); setQuery(""); }}>
                Reset filters
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse">
              <thead>
                <tr>
                  {advancedMode && <Th className="w-10" />}
                  <Th>Order ID</Th>
                  <Th>Student & Hostel Dest</Th>
                  <Th>Items Summary</Th>
                  <Th className="text-right">Amount</Th>
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
                    className="cursor-pointer border-b border-surface-container-low transition-colors last:border-0 hover:bg-surface-container-low"
                  >
                    {advancedMode && (
                      <Td>
                        <input
                          type="checkbox"
                          checked={checked.has(o.id)}
                          onChange={() => toggle(o.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                      </Td>
                    )}
                    <Td className="font-bold font-label-sm text-label-sm text-on-surface">
                      #{o.id.slice(-6).toUpperCase()}
                    </Td>
                    <Td>
                      <div className="flex items-center gap-space-sm">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-surface-container text-body-sm font-semibold text-secondary">
                          {o.studentName.charAt(0)}
                        </span>
                        <div>
                          <p className="text-body-md text-on-surface">{o.studentName}</p>
                          <p className="text-label-sm text-secondary">{o.block}, Room {o.room}</p>
                        </div>
                      </div>
                    </Td>
                    <Td className="text-secondary">{orderItemCount(o)} items</Td>
                    <Td className="text-right text-tabular-metric !text-body-md text-on-surface">
                      {rupees(orderSubtotal(o, vendor.menu))}
                    </Td>
                    <Td>
                      <Badge tone={STATUS_TONE[o.status]} live={o.status === "placed"}>
                        {STATUS_LABEL[o.status]}
                      </Badge>
                    </Td>
                    <Td className="text-secondary">{relativeDay(o.createdAt)}, {clockTime(o.createdAt)}</Td>
                    <Td className="text-right">
                      {o.status === "dispatched" ? (
                        <Button
                          size="sm"
                          variant="primary"
                          onClick={(e) => {
                            e.stopPropagation();
                            markDelivered(o.id);
                          }}
                        >
                          Hand Over
                        </Button>
                      ) : (
                        <MaterialIcon name="chevron_right" className="ml-auto text-[16px] text-secondary" />
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex flex-wrap items-center justify-between gap-space-xs px-space-md py-space-sm text-label-sm text-secondary">
          <span>Displaying {rows.length} of {m.myOrders.length} orders</span>
          {advancedMode && (
            <span>Press <kbd className="rounded bg-surface-container px-space-xs py-space-2xs">⌘P</kbd> for batch KOT print</span>
          )}
        </div>
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
        <div className="flex gap-space-sm">
          {slot?.status === "open" && (
            <Button className="flex-1 justify-center" onClick={onClosePool}>Close pool</Button>
          )}
          {slot?.status === "closed" && (
            <Button variant="primary" className="flex-1 justify-center" onClick={onDispatch}>
              Mark run dispatched
            </Button>
          )}
          {order.status === "dispatched" && (
            <Button variant="primary" className="flex-1 justify-center" onClick={onDeliver}>
              Mark delivered
            </Button>
          )}
          {order.status === "delivered" && (
            <Button className="flex-1 justify-center" disabled>Completed</Button>
          )}
        </div>
      }
    >
      <div className="space-y-space-md">
        <div className="flex flex-wrap gap-space-xs">
          <Badge tone={STATUS_TONE[order.status]}>{ORDER_STAGE_LABEL[order.status]}</Badge>
          <Badge tone="neutral">{hostel?.name}</Badge>
          <Badge tone="neutral">{relativeDay(order.createdAt)}, {clockTime(order.createdAt)}</Badge>
        </div>

        {/* Items */}
        <div className="overflow-hidden rounded-lg bg-surface-container-low">
          <p className="bg-surface-container px-space-sm py-space-xs text-label-sm uppercase tracking-wide text-secondary">
            Customer Order Content
          </p>
          <ul className="divide-y divide-surface-container">
            {order.items.map((line) => {
              const item = vendor.menu.find((m) => m.id === line.menuItemId);
              if (!item) return null;
              return (
                <li key={line.menuItemId} className="flex items-center gap-space-sm px-space-sm py-space-sm">
                  <span className="text-base">{item.art}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-body-md text-on-surface">{item.name}</p>
                    <p className="text-label-sm text-secondary">{item.unit}</p>
                  </div>
                  <span className="text-body-sm text-secondary">× {line.qty}</span>
                  <span className="w-14 text-right text-body-md font-semibold text-on-surface">
                    {rupees(item.price * line.qty)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Bill */}
        <div className="space-y-1.5 rounded-lg bg-surface-container-low p-space-sm text-body-md">
          <Row label="Item total" value={rupees(subtotal)} />
          <Row
            label={`Delivery fee (${poolSize} pooled)`}
            value={fee === undefined ? "not locked yet" : fee === 0 ? "FREE" : rupees(fee)}
          />
          {order.tip ? <Row label="Rider tip" value={rupees(order.tip)} /> : null}
          <div className="flex justify-between border-t border-surface-container-high pt-space-xs text-headline-sm text-on-surface">
            <span>Total</span>
            <span>{rupees(subtotal + (fee ?? 0) + (order.tip ?? 0))}</span>
          </div>
          {order.paymentMethod && (
            <p className="pt-0.5 text-label-sm text-secondary">Paid via {order.paymentMethod}</p>
          )}
        </div>

        {order.note && (
          <div className="rounded-lg bg-primary-container/10 p-space-sm">
            <p className="flex items-center gap-space-xs text-label-sm uppercase tracking-wide text-primary">
              <MaterialIcon name="campaign" className="text-[14px]" /> Special Delivery Instruction
            </p>
            <p className="mt-1 text-body-md italic text-secondary">"{order.note}"</p>
          </div>
        )}

        {/* Consolidated pick list for the whole run */}
        {pickList.length > 0 && (
          <div className="overflow-hidden rounded-lg bg-surface-container-low">
            <p className="flex items-center gap-space-xs bg-surface-container px-space-sm py-space-xs text-label-sm uppercase tracking-wide text-secondary">
              <MaterialIcon name="soup_kitchen" className="text-[14px] text-primary" />
              Consolidated Pick List · {poolSize} orders
            </p>
            <ul className="max-h-56 divide-y divide-surface-container overflow-y-auto">
              {pickList.map((line) => (
                <li key={line.menuItemId} className="flex items-center gap-space-sm px-space-sm py-space-xs">
                  <span className="text-sm">{line.art}</span>
                  <span className="min-w-0 flex-1 truncate text-body-md text-secondary">{line.name}</span>
                  <span className="rounded bg-surface-container px-space-xs py-space-2xs text-body-sm font-semibold text-on-surface">
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
    <div className="flex justify-between text-secondary">
      <span>{label}</span>
      <span className="font-semibold text-on-surface">{value}</span>
    </div>
  );
}
