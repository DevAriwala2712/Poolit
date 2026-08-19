import {
  ORDER_STAGE_HINT,
  ORDER_STAGE_LABEL,
  countdown,
  feeForOrderCount,
  orderSubtotal,
  rider,
  rupees,
  useStore,
} from "@poolit/domain";
import type { OrderStatus } from "@poolit/domain";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PoolFeeCard } from "../components/PoolFeeCard";
import { ProductArt } from "../components/ProductArt";
import { Badge, Button, EmptyState } from "../components/ui";
import { useNow } from "../hooks/useNow";
import { ScreenHeader } from "./Cart";

const STAGES: OrderStatus[] = ["placed", "pooled", "dispatched", "delivered"];

export function Tracking() {
  const { orderId } = useParams<{ orderId: string }>();
  const navigate = useNavigate();
  const now = useNow();
  const { orders, slots, vendors, hostels } = useStore();

  const order = orders.find((o) => o.id === orderId);
  const slot = slots.find((s) => s.id === order?.slotId);
  const vendor = vendors.find((v) => v.id === slot?.vendorId);
  const hostel = hostels.find((h) => h.id === slot?.hostelId);

  if (!order || !slot || !vendor) {
    return (
      <div>
        <ScreenHeader title="Track order" onBack={() => navigate("/orders")} />
        <EmptyState art="📦" title="Order not found" body="We couldn't find that order." action="See all orders" onAction={() => navigate("/orders")} />
      </div>
    );
  }

  const stageIndex = STAGES.indexOf(order.status);
  const poolSize = orders.filter((o) => o.slotId === slot.id).length;
  const fee = order.deliveryFeeCharged ?? feeForOrderCount(poolSize);
  const subtotal = orderSubtotal(order, vendor.menu);
  const etaMinutes = vendor.prepMinutes + 4;

  return (
    <div className="pb-8">
      <ScreenHeader title="Track order" onBack={() => navigate("/orders")} />

      {/* Hero status */}
      <section className="mx-4 overflow-hidden rounded-[var(--radius-card)] bg-ink p-5 text-cream shadow-[var(--shadow-lift)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold text-cream/60">
              {order.status === "delivered" ? "Delivered" : "Arriving in"}
            </p>
            <p className="mt-0.5 text-[32px] font-extrabold leading-none tracking-tight">
              {order.status === "delivered" ? "Enjoy 🎉" : `${etaMinutes} mins`}
            </p>
            <p className="mt-1.5 text-[13px] font-medium text-lime">
              {ORDER_STAGE_LABEL[order.status]}
            </p>
            <p className="text-[12px] text-cream/60">{ORDER_STAGE_HINT[order.status]}</p>
          </div>
          <span className="text-[44px]">
            {order.status === "delivered" ? "✅" : order.status === "dispatched" ? "🛵" : "📦"}
          </span>
        </div>

        {/* Stage rail */}
        <div className="mt-5 flex items-center">
          {STAGES.map((stage, i) => {
            const done = i <= stageIndex;
            const isLast = i === STAGES.length - 1;
            return (
              <div key={stage} className={`flex items-center ${isLast ? "" : "flex-1"}`}>
                <div className="flex flex-col items-center">
                  <span
                    className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-extrabold transition ${
                      done ? "bg-lime text-ink" : "bg-cream/15 text-cream/50"
                    } ${i === stageIndex && order.status !== "delivered" ? "animate-ring" : ""}`}
                  >
                    {done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3.2} /> : i + 1}
                  </span>
                  <span
                    className={`mt-1.5 whitespace-nowrap text-[9.5px] font-semibold ${
                      done ? "text-cream" : "text-cream/40"
                    }`}
                  >
                    {ORDER_STAGE_LABEL[stage]}
                  </span>
                </div>
                {!isLast && (
                  <span
                    className={`mx-1 mb-5 h-0.5 flex-1 rounded-full ${
                      i < stageIndex ? "bg-lime" : "bg-cream/15"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Live pool while still open */}
      {slot.status === "open" && (
        <div className="mt-4 px-4">
          <p className="mb-2 px-1 text-[12.5px] font-semibold text-ink-soft">
            Pool closes in {countdown(slot.closesAt, now)} — your fee can still drop
          </p>
          <PoolFeeCard orderCount={poolSize} closesAt={slot.closesAt} compact />
        </div>
      )}

      {/* Rider */}
      {(order.status === "dispatched" || order.status === "delivered") && (
        <section className="mx-4 mt-4 flex items-center gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-lime-soft text-2xl">
            🛵
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-bold text-ink">{rider.name}</p>
            <p className="text-[12px] text-ink-soft">{rider.vehicle}</p>
            <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-ink-soft">
              <Icon name="star" filled strokeWidth={0} className="h-3 w-3 text-sun" />
              {rider.rating}
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`tel:${rider.phone.replace(/\s/g, "")}`}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-lime text-ink"
              aria-label="Call rider"
            >
              <Icon name="phone" className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </a>
            <button
              className="flex h-11 w-11 items-center justify-center rounded-full bg-cream-deep text-ink-soft"
              aria-label="Chat with rider"
            >
              <Icon name="chat" className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </button>
          </div>
        </section>
      )}

      {/* Delivery address */}
      <section className="mx-4 mt-4 flex items-start gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-deep text-ink-soft">
          <Icon name="pin" className="h-5 w-5" strokeWidth={2.1} />
        </span>
        <div className="min-w-0">
          <p className="text-[13.5px] font-bold text-ink">
            {order.block}, Room {order.room}
          </p>
          <p className="text-[12px] text-ink-soft">{hostel?.name}</p>
          {order.note && (
            <p className="mt-1 text-[12px] italic text-ink-soft">"{order.note}"</p>
          )}
        </div>
      </section>

      {/* Items + bill */}
      <section className="mx-4 mt-4 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between px-4 py-3">
          <p className="text-[15px] font-bold text-ink">{vendor.name}</p>
          <Badge tone={order.status === "delivered" ? "lime" : "sun"}>
            {ORDER_STAGE_LABEL[order.status]}
          </Badge>
        </div>
        {order.items.map((line) => {
          const item = vendor.menu.find((m) => m.id === line.menuItemId);
          if (!item) return null;
          return (
            <div key={line.menuItemId} className="flex items-center gap-3 border-t border-line px-4 py-2.5">
              <ProductArt art={item.art} tint={item.tint} size="sm" className="!h-10 !w-10 !text-lg" />
              <p className="min-w-0 flex-1 truncate text-[13px] font-medium text-ink">
                {item.name} <span className="text-ink-faint">× {line.qty}</span>
              </p>
              <span className="text-[13px] font-semibold text-ink">
                {rupees(item.price * line.qty)}
              </span>
            </div>
          );
        })}
        <div className="space-y-1.5 border-t border-line px-4 py-3 text-[13px]">
          <div className="flex justify-between text-ink-soft">
            <span>Item total</span>
            <span className="font-semibold text-ink">{rupees(subtotal)}</span>
          </div>
          <div className="flex justify-between text-ink-soft">
            <span>
              Delivery fee
              <span className="ml-1 text-[11px] text-ink-faint">
                ({poolSize} pooled{order.deliveryFeeCharged !== undefined ? " · locked" : ""})
              </span>
            </span>
            <span className={`font-semibold ${fee === 0 ? "text-[#4c6b04]" : "text-ink"}`}>
              {fee === 0 ? "FREE" : rupees(fee)}
            </span>
          </div>
          {order.tip ? (
            <div className="flex justify-between text-ink-soft">
              <span>Rider tip</span>
              <span className="font-semibold text-ink">{rupees(order.tip)}</span>
            </div>
          ) : null}
          <div className="flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
            <span>Total paid</span>
            <span>{rupees(subtotal + fee + (order.tip ?? 0))}</span>
          </div>
          {order.paymentMethod && (
            <p className="pt-0.5 text-[11.5px] text-ink-faint">Paid via {order.paymentMethod}</p>
          )}
        </div>
      </section>

      <div className="mt-5 px-4">
        <Button full variant="outline" onClick={() => navigate("/")}>
          Back to store
        </Button>
      </div>
    </div>
  );
}
