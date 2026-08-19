import { rupees } from "@poolit/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PoolFeeCard } from "../components/PoolFeeCard";
import { ProductArt } from "../components/ProductArt";
import { QtyStepper } from "../components/QtyStepper";
import { Badge, Button, EmptyState } from "../components/ui";
import { useBill } from "../hooks/useBill";
import { useHostelContext } from "../hooks/useHostelContext";
import { useCart } from "../state/CartContext";

export function Cart() {
  const navigate = useNavigate();
  const cart = useCart();
  const { slot, orderCount, vendor } = useHostelContext();
  const [promo, setPromo] = useState("");
  const bill = useBill({ promo });

  if (bill.isEmpty) {
    return (
      <div className="pb-6">
        <ScreenHeader title="Your cart" onBack={() => navigate(-1)} />
        <EmptyState
          art="🛒"
          title="Your cart is empty"
          body="Add something from your hostel store — and pool with others to cut the delivery fee."
          action="Browse store"
          onAction={() => navigate("/categories")}
        />
      </div>
    );
  }

  const poolClosed = !slot || slot.status !== "open";

  return (
    <div className="pb-40">
      <ScreenHeader title="Your cart" onBack={() => navigate(-1)} />

      {slot && (
        <div className="px-4 pb-1">
          <PoolFeeCard orderCount={orderCount} closesAt={slot.closesAt} compact />
        </div>
      )}

      {bill.savedVsSolo > 0 && (
        <div className="mx-4 mt-3 flex items-center gap-2.5 rounded-2xl bg-lime-soft p-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lime text-ink">
            <Icon name="bolt" className="h-4 w-4" filled strokeWidth={0} />
          </span>
          <p className="text-[12.5px] font-semibold leading-snug text-[#4c6b04]">
            Pooling saves you {rupees(bill.savedVsSolo)} on this order
          </p>
        </div>
      )}

      {/* Items */}
      <div className="mx-4 mt-3 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
        {bill.lines.map((line, i) => (
          <div
            key={line.item.id}
            className={`flex items-center gap-3 p-3 ${i > 0 ? "border-t border-line" : ""}`}
          >
            <button onClick={() => navigate(`/product/${line.item.id}`)}>
              <ProductArt art={line.item.art} tint={line.item.tint} size="sm" />
            </button>
            <div className="min-w-0 flex-1">
              <p className="line-clamp-1 text-[13.5px] font-semibold text-ink">{line.item.name}</p>
              <p className="text-[11.5px] text-ink-faint">{line.item.unit}</p>
              <p className="mt-0.5 text-[13px] font-extrabold text-ink">{rupees(line.lineTotal)}</p>
            </div>
            <QtyStepper
              qty={line.qty}
              max={line.item.stockQty}
              onAdd={() => cart.add(line.item.id, line.item.stockQty)}
              onRemove={() => cart.remove(line.item.id)}
            />
          </div>
        ))}
      </div>

      <button
        onClick={() => navigate("/categories")}
        className="mx-4 mt-3 flex w-[calc(100%-2rem)] items-center justify-center gap-2 rounded-2xl border border-dashed border-line py-3 text-[13.5px] font-semibold text-ink-soft"
      >
        <Icon name="plus" className="h-4 w-4" strokeWidth={2.4} />
        Add more items
      </button>

      {/* Promo */}
      <div className="mx-4 mt-4 rounded-[var(--radius-card)] bg-surface p-3.5 shadow-[var(--shadow-soft)]">
        <div className="flex items-center gap-2.5">
          <Icon name="tag" className="h-[18px] w-[18px] shrink-0 text-coral" />
          <input
            value={promo}
            onChange={(e) => setPromo(e.target.value.toUpperCase())}
            placeholder="Enter promo code"
            className="w-full bg-transparent text-[14px] font-semibold tracking-wide text-ink outline-none placeholder:font-medium placeholder:tracking-normal placeholder:text-ink-faint"
          />
          {bill.promoValid === true && <Badge tone="lime">Applied</Badge>}
        </div>
        {bill.promoValid === true && bill.promoLabel && (
          <p className="mt-1.5 pl-7 text-[12px] font-medium text-[#4c6b04]">{bill.promoLabel}</p>
        )}
        {bill.promoValid === false && (
          <p className="mt-1.5 pl-7 text-[12px] font-medium text-coral">
            That code isn't valid. Try HOSTEL50.
          </p>
        )}
      </div>

      {/* Bill summary */}
      <div className="mx-4 mt-4 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
        <p className="text-[15px] font-bold text-ink">Bill summary</p>
        <dl className="mt-3 space-y-2 text-[13.5px]">
          <BillRow label="Item total" value={rupees(bill.itemTotal)} />
          <BillRow
            label="Delivery fee"
            hint={`${bill.projectedPoolSize} in pool`}
            value={bill.deliveryFee === 0 ? "FREE" : rupees(bill.deliveryFee)}
            accent={bill.deliveryFee === 0}
            struck={bill.savedVsSolo > 0 ? rupees(20) : undefined}
          />
          <BillRow label="Platform fee" value={rupees(bill.platformFee)} />
          {bill.promoDiscount > 0 && (
            <BillRow label="Promo discount" value={`− ${rupees(bill.promoDiscount)}`} accent />
          )}
        </dl>
        <div className="mt-3 flex items-baseline justify-between border-t border-line pt-3">
          <span className="text-[15px] font-bold text-ink">To pay</span>
          <span className="text-[20px] font-extrabold text-ink">{rupees(bill.total)}</span>
        </div>
      </div>

      <p className="mt-3 px-4 text-center text-[11.5px] text-ink-faint">
        Delivered by {vendor?.name} · Pooled with {orderCount} other{orderCount === 1 ? "" : "s"}
      </p>

      {/* Sticky checkout */}
      <div className="fixed inset-x-0 bottom-[56px] z-40 mx-auto max-w-md border-t border-line bg-cream/95 px-4 pb-3 pt-3 backdrop-blur">
        <Button full disabled={poolClosed} onClick={() => navigate("/checkout")}>
          {poolClosed ? "Pool closed — try next slot" : `Proceed to checkout · ${rupees(bill.total)}`}
          {!poolClosed && <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.4} />}
        </Button>
      </div>
    </div>
  );
}

function BillRow({
  label,
  value,
  hint,
  accent,
  struck,
}: {
  label: string;
  value: string;
  hint?: string;
  accent?: boolean;
  struck?: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-ink-soft">
        {label}
        {hint && <span className="ml-1.5 text-[11px] text-ink-faint">({hint})</span>}
      </dt>
      <dd className={`flex items-baseline gap-1.5 font-semibold ${accent ? "text-[#4c6b04]" : "text-ink"}`}>
        {struck && <span className="text-[11.5px] font-medium text-ink-faint line-through">{struck}</span>}
        {value}
      </dd>
    </div>
  );
}

export function ScreenHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-3 bg-cream/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
      <button
        onClick={onBack}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-soft)]"
        aria-label="Back"
      >
        <Icon name="chevronLeft" className="h-5 w-5" strokeWidth={2.4} />
      </button>
      <h1 className="text-[19px] font-extrabold tracking-tight text-ink">{title}</h1>
    </header>
  );
}
