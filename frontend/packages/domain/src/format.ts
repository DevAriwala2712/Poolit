import type { MenuItem, Order, OrderStatus } from "./types";

export function rupees(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function countdown(targetMs: number, nowMs = Date.now()): string {
  const total = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function relativeDay(ms: number): string {
  const hours = (Date.now() - ms) / 3_600_000;
  if (hours < 12) return "Today";
  if (hours < 36) return "Yesterday";
  return `${Math.floor(hours / 24)} days ago`;
}

export function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
}

/**
 * Student-facing label for each domain order status. The underlying lifecycle
 * (placed → pooled → dispatched → delivered) is unchanged; these are display
 * names that read like a delivery app.
 */
export const ORDER_STAGE_LABEL: Record<OrderStatus, string> = {
  placed: "Pooling",
  pooled: "Preparing",
  dispatched: "On the way",
  delivered: "Delivered",
};

export const ORDER_STAGE_HINT: Record<OrderStatus, string> = {
  placed: "Waiting for more students to join your pool",
  pooled: "Your store is packing the pooled run",
  dispatched: "Out for delivery to your block",
  delivered: "Handed over — enjoy!",
};

export function orderSubtotal(order: Order, menu: MenuItem[]): number {
  return order.items.reduce(
    (sum, line) => sum + (menu.find((m) => m.id === line.menuItemId)?.price ?? 0) * line.qty,
    0,
  );
}

export function orderItemCount(order: Order): number {
  return order.items.reduce((n, i) => n + i.qty, 0);
}

export function stockState(item: MenuItem): "out" | "low" | "ok" {
  if (item.stockQty === 0) return "out";
  if (item.stockQty <= item.lowStockThreshold) return "low";
  return "ok";
}
