import { CATEGORIES, rupees, stockState } from "@poolit/domain";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import { PoolFeeCard } from "../components/PoolFeeCard";
import { ProductArt } from "../components/ProductArt";
import { ProductCard } from "../components/ProductCard";
import { QtyStepper } from "../components/QtyStepper";
import { Sheet } from "../components/Sheet";
import { Chip, EmptyState, SectionHeader } from "../components/ui";
import { useHostelContext } from "../hooks/useHostelContext";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";

const CATEGORY_ART: Record<string, { art: string; tint: string }> = {
  Snacks: { art: "🍿", tint: "#FFF0DA" },
  "Instant Food": { art: "🍜", tint: "#FFE7CC" },
  Drinks: { art: "🥤", tint: "#DCE7F5" },
  Essentials: { art: "🧼", tint: "#E1EEE6" },
  Fresh: { art: "🥛", tint: "#EAF2FA" },
  "Midnight Cravings": { art: "🍫", tint: "#E9DDE8" },
};

const OFFERS = [
  { id: "o1", title: "Pool with 5 friends", body: "Delivery drops to ₹5", art: "🤝", from: "#EAF9C4", to: "#D3F19A" },
  { id: "o2", title: "HOSTEL50", body: "₹50 off your first order", art: "🎟️", from: "#FFE4E1", to: "#FFC9C3" },
  { id: "o3", title: "Midnight menu", body: "Open till 2 AM tonight", art: "🌙", from: "#FDF0C4", to: "#F8DE8E" },
];

export function Home() {
  const navigate = useNavigate();
  const { profile } = useProfile();
  const { hostel, vendor, slot, orderCount } = useHostelContext();
  const cart = useCart();
  const toast = useToast();
  const [addressOpen, setAddressOpen] = useState(false);

  const menu = useMemo(() => vendor?.menu ?? [], [vendor]);
  const eta = vendor?.prepMinutes ?? 8;

  const frequentlyBought = useMemo(
    () => [...menu].sort((a, b) => b.ratingCount - a.ratingCount).slice(0, 8),
    [menu],
  );
  const trending = useMemo(
    () => [...menu].filter((m) => m.stockQty > 0).sort((a, b) => b.rating - a.rating).slice(0, 8),
    [menu],
  );

  if (!vendor || !slot) {
    return (
      <EmptyState
        art="🏪"
        title="No store nearby"
        body="We couldn't find a store serving your hostel right now."
      />
    );
  }

  return (
    <div className="pb-6">
      {/* Location + search header */}
      <header className="sticky top-0 z-30 bg-cream/95 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+12px)] backdrop-blur">
        <div className="flex items-center gap-3">
          <button onClick={() => setAddressOpen(true)} className="min-w-0 flex-1 text-left">
            <span className="flex items-center gap-1 text-[11px] font-bold uppercase tracking-wide text-coral">
              <Icon name="bolt" className="h-3 w-3" filled strokeWidth={0} />
              Delivery in {eta} mins
            </span>
            <span className="mt-0.5 flex items-center gap-1 text-[15px] font-bold text-ink">
              <span className="truncate">
                {profile.block}, Room {profile.room}
              </span>
              <Icon name="chevronDown" className="h-4 w-4 shrink-0 text-ink-soft" strokeWidth={2.4} />
            </span>
          </button>
          <button
            onClick={() => navigate("/profile")}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-ink text-[13px] font-bold text-cream"
          >
            {(profile.name || "S").charAt(0).toUpperCase()}
          </button>
        </div>

        <button
          onClick={() => navigate("/categories?focus=1")}
          className="mt-3 flex min-h-[46px] w-full items-center gap-2.5 rounded-2xl bg-surface px-3.5 text-left shadow-[var(--shadow-soft)]"
        >
          <Icon name="search" className="h-[18px] w-[18px] text-ink-faint" />
          <span className="flex-1 text-[14px] text-ink-faint">Search "cold coffee"</span>
          <Icon name="mic" className="h-[18px] w-[18px] text-coral" />
        </button>
      </header>

      {/* Live pooling fee — the hook */}
      <div className="px-4 pt-1">
        <PoolFeeCard orderCount={orderCount} closesAt={slot.closesAt} />
      </div>

      {/* Categories */}
      <div className="mt-6">
        <SectionHeader title="Shop by category" />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {CATEGORIES.map((cat) => {
            const meta = CATEGORY_ART[cat];
            return (
              <button
                key={cat}
                onClick={() => navigate(`/categories?c=${encodeURIComponent(cat)}`)}
                className="w-[76px] shrink-0 text-center"
              >
                <div
                  className="flex h-[76px] w-[76px] items-center justify-center rounded-2xl text-[34px] shadow-[var(--shadow-soft)]"
                  style={{ background: `radial-gradient(120% 100% at 30% 20%, #fff, ${meta.tint})` }}
                >
                  {meta.art}
                </div>
                <p className="mt-1.5 text-[11.5px] font-semibold leading-tight text-ink">{cat}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Offers carousel */}
      <div className="mt-6">
        <SectionHeader title="Offers near you" />
        <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1">
          {OFFERS.map((offer) => (
            <div
              key={offer.id}
              className="flex w-[268px] shrink-0 snap-start items-center gap-3 rounded-[var(--radius-card)] p-4 shadow-[var(--shadow-soft)]"
              style={{ background: `linear-gradient(135deg, ${offer.from}, ${offer.to})` }}
            >
              <span className="text-[34px]">{offer.art}</span>
              <div className="min-w-0">
                <p className="text-[15px] font-extrabold leading-tight text-ink">{offer.title}</p>
                <p className="text-[12.5px] font-medium text-ink-soft">{offer.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Frequently bought — horizontal rail with steppers */}
      <div className="mt-7">
        <SectionHeader title="Frequently bought" action="See all" onAction={() => navigate("/categories")} />
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {frequentlyBought.map((item) => {
            const qty = cart.qtyOf(item.id);
            const out = stockState(item) === "out";
            return (
              <div
                key={item.id}
                className="flex w-[132px] shrink-0 flex-col rounded-[var(--radius-card)] bg-surface p-2.5 shadow-[var(--shadow-soft)]"
              >
                <button onClick={() => navigate(`/product/${item.id}`)} className="text-left">
                  <ProductArt art={item.art} tint={item.tint} size="md" className="!h-20" />
                  <p className="mt-2 line-clamp-2 min-h-[2.4em] text-[12.5px] font-semibold leading-tight text-ink">
                    {item.name}
                  </p>
                  <p className="text-[11px] text-ink-faint">{item.unit}</p>
                </button>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="text-[13.5px] font-extrabold text-ink">{rupees(item.price)}</span>
                  <QtyStepper
                    qty={qty}
                    max={item.stockQty}
                    disabled={out}
                    onAdd={() => {
                      cart.add(item.id, item.stockQty);
                      if (qty === 0) toast(`${item.name} added`);
                    }}
                    onRemove={() => cart.remove(item.id)}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Trending grid */}
      <div className="mt-7">
        <SectionHeader title={`Trending in ${hostel.name}`} />
        <div className="grid grid-cols-2 gap-3 px-4">
          {trending.map((item) => (
            <ProductCard key={item.id} item={item} etaMinutes={eta} />
          ))}
        </div>
      </div>

      <AddressSheet open={addressOpen} onClose={() => setAddressOpen(false)} />
    </div>
  );
}

function AddressSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { profile, update } = useProfile();
  const { hostel } = useHostelContext();

  return (
    <Sheet open={open} onClose={onClose} title="Delivery address">
      <p className="text-[13px] text-ink-soft">{hostel.name}</p>
      <div className="mt-3 space-y-3">
        <div>
          <span className="text-[12px] font-semibold text-ink-soft">Block</span>
          <div className="mt-1.5 flex flex-wrap gap-2">
            {hostel.blocks.map((b) => (
              <Chip key={b} active={profile.block === b} onClick={() => update({ block: b })}>
                {b}
              </Chip>
            ))}
          </div>
        </div>
        <label className="block">
          <span className="text-[12px] font-semibold text-ink-soft">Room number</span>
          <input
            value={profile.room}
            onChange={(e) => update({ room: e.target.value.replace(/\D/g, "").slice(0, 4) })}
            inputMode="numeric"
            className="mt-1.5 min-h-[46px] w-full rounded-2xl bg-surface px-4 text-[15px] font-medium text-ink shadow-[var(--shadow-soft)] outline-none focus:ring-2 focus:ring-lime"
          />
        </label>
      </div>
    </Sheet>
  );
}
