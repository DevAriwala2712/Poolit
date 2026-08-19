import { rupees, stockState } from "@poolit/domain";
import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "../components/Icon";
import { ProductArt } from "../components/ProductArt";
import { QtyStepper } from "../components/QtyStepper";
import { Badge, Button, EmptyState, Rating, VegDot } from "../components/ui";
import { useHostelContext } from "../hooks/useHostelContext";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";

export function ProductDetail() {
  const { itemId } = useParams<{ itemId: string }>();
  const navigate = useNavigate();
  const { vendor } = useHostelContext();
  const cart = useCart();
  const toast = useToast();
  const { isFavorite, toggleFavorite } = useProfile();

  const item = vendor?.menu.find((m) => m.id === itemId);

  const alsoBought = useMemo(() => {
    if (!vendor || !item) return [];
    return vendor.menu
      .filter((m) => m.id !== item.id && m.category === item.category && m.stockQty > 0)
      .slice(0, 4);
  }, [vendor, item]);

  if (!item) {
    return (
      <EmptyState
        art="🫥"
        title="Item unavailable"
        body="This product isn't in your hostel's store."
        action="Back to home"
        onAction={() => navigate("/")}
      />
    );
  }

  const qty = cart.qtyOf(item.id);
  const out = stockState(item) === "out";
  const low = stockState(item) === "low";
  const fav = isFavorite(item.id);
  const discount = item.mrp && item.mrp > item.price
    ? Math.round(((item.mrp - item.price) / item.mrp) * 100)
    : 0;

  return (
    <div className="pb-32">
      <header className="sticky top-0 z-30 flex items-center justify-between bg-cream/95 px-4 pb-2 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <button
          onClick={() => navigate(-1)}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-ink shadow-[var(--shadow-soft)]"
          aria-label="Back"
        >
          <Icon name="chevronLeft" className="h-5 w-5" strokeWidth={2.4} />
        </button>
        <button
          onClick={() => {
            toggleFavorite(item.id);
            toast(fav ? "Removed from favourites" : "Saved to favourites");
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-soft)]"
          aria-label="Favourite"
        >
          <Icon
            name="heart"
            filled={fav}
            className={`h-5 w-5 ${fav ? "text-coral" : "text-ink-soft"}`}
          />
        </button>
      </header>

      <div className="px-4">
        <ProductArt art={item.art} tint={item.tint} size="hero" />
      </div>

      <div className="mt-4 px-4">
        <div className="flex items-center gap-2">
          <VegDot isVeg={item.isVeg} />
          <Badge tone="neutral">{item.category}</Badge>
          {discount > 0 && <Badge tone="coral">{discount}% OFF</Badge>}
        </div>

        <h1 className="mt-2 text-[23px] font-extrabold leading-tight tracking-tight text-ink">
          {item.name}
        </h1>
        <p className="text-[13.5px] text-ink-soft">{item.unit}</p>

        <div className="mt-2 flex items-center gap-3">
          <Rating value={item.rating} count={item.ratingCount} />
          <span className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-soft">
            <Icon name="clock" className="h-3 w-3" strokeWidth={2.4} />
            Delivered in {vendor?.prepMinutes ?? 8} mins
          </span>
        </div>

        <div className="mt-4 flex items-end justify-between gap-3 rounded-[var(--radius-card)] bg-surface p-4 shadow-[var(--shadow-soft)]">
          <div>
            <div className="flex items-baseline gap-2">
              <span className="text-[26px] font-extrabold leading-none text-ink">
                {rupees(item.price)}
              </span>
              {item.mrp && item.mrp > item.price && (
                <span className="text-[14px] font-medium text-ink-faint line-through">
                  {rupees(item.mrp)}
                </span>
              )}
            </div>
            <p className="mt-1 text-[11.5px] text-ink-faint">Inclusive of all taxes</p>
          </div>
          <QtyStepper
            qty={qty}
            max={item.stockQty}
            size="md"
            disabled={out}
            onAdd={() => {
              cart.add(item.id, item.stockQty);
              if (qty === 0) toast(`${item.name} added`);
            }}
            onRemove={() => cart.remove(item.id)}
          />
        </div>

        {low && (
          <p className="mt-2 text-[12.5px] font-semibold text-coral">
            Hurry — only {item.stockQty} left in your hostel's store.
          </p>
        )}

        <div className="mt-5 rounded-[var(--radius-card)] bg-lime-soft p-4">
          <p className="flex items-center gap-1.5 text-[13px] font-bold text-[#4c6b04]">
            <Icon name="users" className="h-4 w-4" strokeWidth={2.2} />
            Pool this with your hostel
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#5c7d1a]">
            Your delivery fee drops automatically as more students order in the same window — down
            to free once 11 orders join.
          </p>
        </div>

        {alsoBought.length > 0 && (
          <div className="mt-7">
            <h2 className="text-[17px] font-bold tracking-tight text-ink">
              Frequently bought together
            </h2>
            <div className="no-scrollbar -mx-4 mt-3 flex gap-3 overflow-x-auto px-4">
              {alsoBought.map((other) => {
                const otherQty = cart.qtyOf(other.id);
                return (
                  <div
                    key={other.id}
                    className="flex w-[128px] shrink-0 flex-col rounded-[var(--radius-card)] bg-surface p-2.5 shadow-[var(--shadow-soft)]"
                  >
                    <button onClick={() => navigate(`/product/${other.id}`)} className="text-left">
                      <ProductArt art={other.art} tint={other.tint} size="md" className="!h-[72px]" />
                      <p className="mt-2 line-clamp-2 min-h-[2.4em] text-[12px] font-semibold leading-tight text-ink">
                        {other.name}
                      </p>
                    </button>
                    <div className="mt-1.5 flex items-center justify-between gap-1">
                      <span className="text-[13px] font-extrabold text-ink">{rupees(other.price)}</span>
                      <QtyStepper
                        qty={otherQty}
                        max={other.stockQty}
                        onAdd={() => cart.add(other.id, other.stockQty)}
                        onRemove={() => cart.remove(other.id)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Sticky add-to-cart */}
      <div className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-cream/95 px-4 pb-[calc(env(safe-area-inset-bottom)+12px)] pt-3 backdrop-blur">
        {out ? (
          <Button full disabled>
            Sold out
          </Button>
        ) : qty === 0 ? (
          <Button
            full
            onClick={() => {
              cart.add(item.id, item.stockQty);
              toast(`${item.name} added`);
            }}
          >
            Add to cart · {rupees(item.price)}
          </Button>
        ) : (
          <Button full variant="lime" onClick={() => navigate("/cart")}>
            Go to cart · {qty} in basket
            <Icon name="arrowRight" className="h-4 w-4" strokeWidth={2.4} />
          </Button>
        )}
      </div>
    </div>
  );
}
