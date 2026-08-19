import type { MenuItem } from "@poolit/domain";
import { rupees, stockState } from "@poolit/domain";
import { useNavigate } from "react-router-dom";
import { useCart } from "../state/CartContext";
import { useToast } from "../state/ToastContext";
import { Icon } from "./Icon";
import { ProductArt } from "./ProductArt";
import { QtyStepper } from "./QtyStepper";
import { Badge, Rating, VegDot } from "./ui";

export function ProductCard({ item, etaMinutes }: { item: MenuItem; etaMinutes: number }) {
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const qty = cart.qtyOf(item.id);
  const stock = stockState(item);
  const discount = item.mrp && item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
    : 0;

  return (
    <div className="relative flex flex-col rounded-[var(--radius-card)] bg-surface p-2.5 shadow-[var(--shadow-soft)]">
      {discount > 0 && (
        <span className="absolute left-1.5 top-1.5 z-10 rounded-lg bg-coral px-1.5 py-0.5 text-[10px] font-extrabold text-white">
          {discount}% OFF
        </span>
      )}

      <button
        onClick={() => navigate(`/product/${item.id}`)}
        className="text-left"
        aria-label={`View ${item.name}`}
      >
        <ProductArt art={item.art} tint={item.tint} size="md" />

        <div className="mt-2 flex items-center gap-1.5">
          <span className="inline-flex items-center gap-1 rounded-md bg-cream-deep px-1.5 py-0.5 text-[10px] font-bold text-ink-soft">
            <Icon name="clock" className="h-2.5 w-2.5" strokeWidth={2.6} />
            {etaMinutes} MINS
          </span>
          <VegDot isVeg={item.isVeg} />
        </div>

        <p className="mt-1.5 line-clamp-2 min-h-[2.4em] text-[13.5px] font-semibold leading-tight text-ink">
          {item.name}
        </p>
        <p className="text-[11.5px] text-ink-faint">{item.unit}</p>
        <div className="mt-1 flex items-center gap-2">
          <Rating value={item.rating} count={item.ratingCount} />
          {stock === "low" && <Badge tone="coral">{item.stockQty} left</Badge>}
        </div>
      </button>

      <div className="mt-auto flex items-end justify-between gap-2 pt-2.5">
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold leading-none text-ink">{rupees(item.price)}</p>
          {item.mrp && item.mrp > item.price && (
            <p className="mt-0.5 text-[11px] font-medium text-ink-faint line-through">
              {rupees(item.mrp)}
            </p>
          )}
        </div>
        <QtyStepper
          qty={qty}
          max={item.stockQty}
          disabled={stock === "out"}
          onAdd={() => {
            cart.add(item.id, item.stockQty);
            if (qty === 0) toast(`${item.name} added`);
          }}
          onRemove={() => cart.remove(item.id)}
        />
      </div>
    </div>
  );
}
