import type { MenuCategory, MenuItem } from "../domain/types";

const CATEGORY_ICON: Record<MenuCategory, string> = {
  Mains: "🍛",
  Snacks: "🍟",
  Beverages: "🥤",
  Desserts: "🍮",
};

interface ProductCardProps {
  item: MenuItem;
  qty: number;
  onIncrement: () => void;
  onDecrement: () => void;
}

export function ProductCard({ item, qty, onIncrement, onDecrement }: ProductCardProps) {
  const outOfStock = item.stockQty === 0;
  const lowStock = !outOfStock && item.stockQty <= item.lowStockThreshold;

  return (
    <div className={`rounded-xl bg-white p-2.5 shadow-sm ${outOfStock ? "opacity-50" : ""}`}>
      <div className="flex h-20 items-center justify-center rounded-lg bg-secondary/10 text-4xl">
        {CATEGORY_ICON[item.category]}
      </div>

      <p className="mt-2 line-clamp-2 min-h-[2.2em] text-sm font-medium leading-tight text-body">
        {item.name}
      </p>
      <p className="text-xs text-muted">per {item.unit}</p>

      {outOfStock ? (
        <p className="mt-1 text-xs font-semibold text-muted">Out of stock</p>
      ) : lowStock ? (
        <p className="mt-1 text-xs font-semibold text-accent">Only {item.stockQty} left</p>
      ) : (
        <span className="mt-1 block h-[1em]" />
      )}

      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-bold text-body">₹{item.price}</span>

        {qty === 0 ? (
          <button
            onClick={onIncrement}
            disabled={outOfStock}
            className="rounded-lg border border-accent bg-accent/5 px-3 py-1 text-xs font-bold text-accent disabled:opacity-40"
          >
            ADD
          </button>
        ) : (
          <div className="flex items-center overflow-hidden rounded-lg bg-accent text-white">
            <button onClick={onDecrement} className="px-2.5 py-1 text-sm font-bold">
              −
            </button>
            <span className="min-w-[1.2rem] text-center text-xs font-bold">{qty}</span>
            <button
              onClick={onIncrement}
              disabled={qty >= item.stockQty}
              className="px-2.5 py-1 text-sm font-bold disabled:opacity-50"
            >
              +
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
