import {
  ORDER_STAGE_LABEL,
  orderItemCount,
  orderSubtotal,
  relativeDay,
  clockTime,
  rupees,
  useStore,
} from "@poolit/domain";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ProductArt } from "../components/ProductArt";
import { Badge, EmptyState } from "../components/ui";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";

export function Orders() {
  const navigate = useNavigate();
  const { orders, slots, vendors } = useStore();
  const { profile } = useProfile();
  const cart = useCart();
  const toast = useToast();

  const myName = (profile.name || "Student").trim();
  const mine = orders
    .filter((o) => o.studentName === myName)
    .sort((a, b) => b.createdAt - a.createdAt);

  const active = mine.filter((o) => o.status !== "delivered");
  const past = mine.filter((o) => o.status === "delivered");

  function reorder(orderId: string) {
    const order = orders.find((o) => o.id === orderId);
    const slot = slots.find((s) => s.id === order?.slotId);
    const vendor = vendors.find((v) => v.id === slot?.vendorId);
    if (!order || !vendor) return;
    let added = 0;
    order.items.forEach((line) => {
      const item = vendor.menu.find((m) => m.id === line.menuItemId);
      if (item && item.stockQty > 0) {
        cart.setQty(item.id, Math.min(item.stockQty, line.qty));
        added += 1;
      }
    });
    toast(added > 0 ? `${added} items back in your cart` : "Those items are sold out", added > 0 ? "success" : "info");
    if (added > 0) navigate("/cart");
  }

  if (mine.length === 0) {
    return (
      <div className="pb-6">
        <Header />
        <EmptyState
          art="🧾"
          title="No orders yet"
          body="Your pooled orders will show up here, with live tracking and one-tap reorder."
          action="Start shopping"
          onAction={() => navigate("/")}
        />
      </div>
    );
  }

  return (
    <div className="pb-6">
      <Header />

      {active.length > 0 && (
        <section className="px-4">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">
            Active
          </h2>
          <div className="space-y-3">
            {active.map((order) => (
              <OrderCard key={order.id} orderId={order.id} onOpen={() => navigate(`/track/${order.id}`)} />
            ))}
          </div>
        </section>
      )}

      {past.length > 0 && (
        <section className="mt-6 px-4">
          <h2 className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">
            Past orders
          </h2>
          <div className="space-y-3">
            {past.map((order) => (
              <OrderCard
                key={order.id}
                orderId={order.id}
                onOpen={() => navigate(`/track/${order.id}`)}
                onReorder={() => reorder(order.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 bg-cream/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+14px)] backdrop-blur">
      <h1 className="text-[24px] font-extrabold tracking-tight text-ink">Your orders</h1>
    </header>
  );
}

function OrderCard({
  orderId,
  onOpen,
  onReorder,
}: {
  orderId: string;
  onOpen: () => void;
  onReorder?: () => void;
}) {
  const { orders, slots, vendors } = useStore();
  const order = orders.find((o) => o.id === orderId)!;
  const slot = slots.find((s) => s.id === order.slotId);
  const vendor = vendors.find((v) => v.id === slot?.vendorId);
  if (!vendor) return null;

  const subtotal = orderSubtotal(order, vendor.menu);
  const fee = order.deliveryFeeCharged ?? 0;
  const arts = order.items
    .map((l) => vendor.menu.find((m) => m.id === l.menuItemId))
    .filter(Boolean)
    .slice(0, 3);

  return (
    <div className="rounded-[var(--radius-card)] bg-surface p-3.5 shadow-[var(--shadow-soft)]">
      <button onClick={onOpen} className="flex w-full items-center gap-3 text-left">
        <div className="flex -space-x-3">
          {arts.map((item) => (
            <ProductArt
              key={item!.id}
              art={item!.art}
              tint={item!.tint}
              size="sm"
              className="!h-11 !w-11 !text-lg ring-2 ring-white"
            />
          ))}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-ink">{vendor.name}</p>
          <p className="text-[12px] text-ink-soft">
            {orderItemCount(order)} items · {relativeDay(order.createdAt)}, {clockTime(order.createdAt)}
          </p>
          <p className="mt-0.5 text-[13px] font-extrabold text-ink">
            {rupees(subtotal + fee + (order.tip ?? 0))}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <Badge tone={order.status === "delivered" ? "lime" : "sun"}>
            {ORDER_STAGE_LABEL[order.status]}
          </Badge>
          <Icon name="chevronRight" className="h-4 w-4 text-ink-faint" strokeWidth={2.4} />
        </div>
      </button>

      {onReorder && (
        <button
          onClick={onReorder}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-lime-soft py-2.5 text-[13px] font-bold text-[#4c6b04] ring-1 ring-lime/40 active:scale-[0.99]"
        >
          <Icon name="receipt" className="h-4 w-4" strokeWidth={2.2} />
          Reorder
        </button>
      )}
    </div>
  );
}
