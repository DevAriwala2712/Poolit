import { useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { Card } from "../../components/Card";
import { FeeCounter } from "../../components/FeeCounter";
import { ProductCard } from "../../components/ProductCard";
import { StatusStepper } from "../../components/StatusStepper";
import { feeForOrderCount } from "../../domain/feeLadder";
import { useStore } from "../../domain/store";
import type { MenuCategory, OrderLineItem } from "../../domain/types";
import { useCountdown } from "../../hooks/useCountdown";
import { useMyName, useMyOrderId } from "../../hooks/useMyIdentity";

const CATEGORY_ORDER: MenuCategory[] = ["Mains", "Snacks", "Beverages", "Desserts"];

export function SlotScreen() {
  const { hostelId } = useParams<{ hostelId: string }>();
  const { hostels, vendors, slots, orders, placeOrder, simulateJoin } = useStore();

  const hostel = hostels.find((h) => h.id === hostelId);
  const vendor = vendors.find((v) => v.hostelId === hostelId);
  const slot = slots.find((s) => s.hostelId === hostelId);

  const [name, setName] = useMyName();
  const [editingName, setEditingName] = useState(false);
  const [myOrderId, setMyOrderId] = useMyOrderId(slot?.id ?? "unknown");
  const [cart, setCart] = useState<Record<string, number>>({});
  const [search, setSearch] = useState("");
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const myOrder = orders.find((o) => o.id === myOrderId);
  const ordersInSlot = useMemo(
    () => (slot ? orders.filter((o) => o.slotId === slot.id) : []),
    [orders, slot],
  );
  const currentFee = feeForOrderCount(ordersInSlot.length);
  const countdown = useCountdown(slot?.closesAt ?? Date.now());

  const resolvedMyOrder =
    myOrder ??
    [...ordersInSlot].reverse().find((o) => o.studentName === name.trim() && !myOrderId);

  useEffect(() => {
    if (resolvedMyOrder && resolvedMyOrder.id !== myOrderId) {
      setMyOrderId(resolvedMyOrder.id);
    }
  }, [resolvedMyOrder, myOrderId, setMyOrderId]);

  if (!hostel || !vendor || !slot) return <Navigate to="/" replace />;

  const cartLines: OrderLineItem[] = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([menuItemId, qty]) => ({ menuItemId, qty }));
  const cartCount = cartLines.reduce((sum, l) => sum + l.qty, 0);
  const cartTotal = cartLines.reduce((sum, line) => {
    const item = vendor.menu.find((m) => m.id === line.menuItemId);
    return sum + (item?.price ?? 0) * line.qty;
  }, 0);

  function adjustQty(menuItemId: string, delta: number, stockQty: number) {
    setCart((prev) => {
      const next = Math.max(0, Math.min(stockQty, (prev[menuItemId] ?? 0) + delta));
      return { ...prev, [menuItemId]: next };
    });
  }

  function handlePlaceOrder() {
    if (!name.trim() || cartLines.length === 0 || !slot) return;
    placeOrder(slot.id, name.trim(), cartLines);
  }

  const searchedMenu = search.trim()
    ? vendor.menu.filter((m) => m.name.toLowerCase().includes(search.trim().toLowerCase()))
    : null;

  const menuByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    items: vendor.menu.filter((m) => m.category === category),
  })).filter((group) => group.items.length > 0);

  function scrollToCategory(category: string) {
    sectionRefs.current[category]?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const showCartBar = !resolvedMyOrder && slot.status === "open" && cartCount > 0;

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-28">
      <header className="sticky top-0 z-20 bg-white px-4 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-lg text-secondary">
            ←
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-bold text-body">{vendor.name}</p>
            <p className="truncate text-xs text-muted">{hostel.name}</p>
          </div>
          {slot.status === "open" ? (
            <span className="whitespace-nowrap rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
              ⏱ {countdown.label}
            </span>
          ) : (
            <span className="whitespace-nowrap rounded-full bg-muted/15 px-2.5 py-1 text-xs font-semibold text-muted">
              {slot.status}
            </span>
          )}
        </div>
      </header>

      <div className="space-y-4 px-4 py-4">
        <FeeCounter fee={resolvedMyOrder?.deliveryFeeCharged ?? currentFee} orderCount={ordersInSlot.length} />

        {resolvedMyOrder ? (
          <div className="space-y-4">
            <Card>
              <p className="mb-4 font-semibold text-body">Order status</p>
              <StatusStepper status={resolvedMyOrder.status} />
            </Card>

            <Card>
              <p className="font-semibold text-body">Your order</p>
              <ul className="mt-2 divide-y divide-surface">
                {resolvedMyOrder.items.map((line) => {
                  const item = vendor.menu.find((m) => m.id === line.menuItemId);
                  return (
                    <li key={line.menuItemId} className="flex justify-between py-1.5 text-sm">
                      <span>
                        {item?.name} × {line.qty}
                      </span>
                      <span className="text-muted">₹{(item?.price ?? 0) * line.qty}</span>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {slot.status === "open" && (
              <button
                onClick={() => simulateJoin(slot.id)}
                className="w-full rounded-xl border border-dashed border-secondary py-3 text-sm font-medium text-secondary"
              >
                Simulate another student joining (demo)
              </button>
            )}
          </div>
        ) : slot.status !== "open" ? (
          <Card className="text-center text-sm text-muted">
            This pool has already closed for new orders.
          </Card>
        ) : (
          <>
            <div className="flex items-center gap-2 rounded-xl bg-white px-3 py-2 shadow-sm">
              <span className="text-sm">🔍</span>
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={`Search ${vendor.name}'s menu`}
                className="w-full text-sm text-body outline-none placeholder:text-muted"
              />
            </div>

            {!editingName && name.trim() ? (
              <button
                onClick={() => setEditingName(true)}
                className="text-xs font-medium text-secondary underline"
              >
                Ordering as {name.trim()} · change
              </button>
            ) : (
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={() => name.trim() && setEditingName(false)}
                autoFocus={editingName}
                placeholder="Your name"
                className="w-full rounded-xl border border-secondary/30 bg-white px-3 py-2 text-sm outline-none focus:border-secondary"
              />
            )}

            {!search.trim() && (
              <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
                {menuByCategory.map((group) => (
                  <button
                    key={group.category}
                    onClick={() => scrollToCategory(group.category)}
                    className="whitespace-nowrap rounded-full bg-white px-3.5 py-1.5 text-xs font-semibold text-body shadow-sm"
                  >
                    {group.category}
                  </button>
                ))}
              </div>
            )}

            {searchedMenu ? (
              searchedMenu.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted">No items match "{search}"</p>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  {searchedMenu.map((item) => (
                    <ProductCard
                      key={item.id}
                      item={item}
                      qty={cart[item.id] ?? 0}
                      onIncrement={() => adjustQty(item.id, 1, item.stockQty)}
                      onDecrement={() => adjustQty(item.id, -1, item.stockQty)}
                    />
                  ))}
                </div>
              )
            ) : (
              <div className="space-y-5">
                {menuByCategory.map((group) => (
                  <div key={group.category} ref={(el) => { sectionRefs.current[group.category] = el; }}>
                    <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                      {group.category}
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      {group.items.map((item) => (
                        <ProductCard
                          key={item.id}
                          item={item}
                          qty={cart[item.id] ?? 0}
                          onIncrement={() => adjustQty(item.id, 1, item.stockQty)}
                          onDecrement={() => adjustQty(item.id, -1, item.stockQty)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {showCartBar && (
        <div className="fixed bottom-0 left-1/2 z-30 w-full max-w-md -translate-x-1/2 px-4 pb-4">
          <button
            onClick={handlePlaceOrder}
            disabled={!name.trim()}
            className="flex w-full items-center justify-between rounded-xl bg-accent px-5 py-3.5 font-semibold text-white shadow-lg disabled:opacity-60"
          >
            <span>
              {cartCount} item{cartCount !== 1 ? "s" : ""} · ₹{cartTotal}
            </span>
            <span>{name.trim() ? "Place order →" : "Add your name ↑"}</span>
          </button>
        </div>
      )}
    </div>
  );
}
