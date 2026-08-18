import type { OrderStatus, SlotStatus } from "../domain/types";

const orderStyles: Record<OrderStatus, string> = {
  placed: "bg-secondary/10 text-secondary",
  pooled: "bg-accent/15 text-accent",
  dispatched: "bg-primary/10 text-primary",
  delivered: "bg-green-100 text-green-700",
};

const slotStyles: Record<SlotStatus, string> = {
  open: "bg-accent/15 text-accent",
  closed: "bg-primary/10 text-primary",
  dispatched: "bg-green-100 text-green-700",
};

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${orderStyles[status]}`}>
      {status}
    </span>
  );
}

export function SlotStatusBadge({ status }: { status: SlotStatus }) {
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold capitalize ${slotStyles[status]}`}>
      {status}
    </span>
  );
}
