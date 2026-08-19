import { rupees, useStore } from "@poolit/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { ProductArt } from "../components/ProductArt";
import { Sheet } from "../components/Sheet";
import { Button, Chip } from "../components/ui";
import { useHostelContext } from "../hooks/useHostelContext";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";

export function Profile() {
  const navigate = useNavigate();
  const { profile, update, toggleFavorite } = useProfile();
  const { hostel, vendor } = useHostelContext();
  const { orders, hostels, resetDemo } = useStore();
  const cart = useCart();
  const toast = useToast();
  const [addressOpen, setAddressOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);

  const myOrders = orders.filter((o) => o.studentName === (profile.name || "Student").trim());
  const favourites = (vendor?.menu ?? []).filter((m) => profile.favorites.includes(m.id));

  const rows: { icon: IconName; label: string; hint: string; onClick: () => void }[] = [
    {
      icon: "receipt",
      label: "Your orders",
      hint: `${myOrders.length} placed`,
      onClick: () => navigate("/orders"),
    },
    {
      icon: "heart",
      label: "Favourites",
      hint: `${favourites.length} saved`,
      onClick: () => setFavOpen(true),
    },
    {
      icon: "pin",
      label: "Delivery address",
      hint: `${profile.block}, Room ${profile.room}`,
      onClick: () => setAddressOpen(true),
    },
    {
      icon: "chat",
      label: "Help & support",
      hint: "We reply in ~2 mins",
      onClick: () => toast("Support chat coming soon", "info"),
    },
  ];

  return (
    <div className="pb-6">
      <header className="bg-ink px-4 pb-6 pt-[calc(env(safe-area-inset-top)+18px)] text-cream">
        <div className="flex items-center gap-3.5">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-lime text-[20px] font-extrabold text-ink">
            {(profile.name || "S").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <input
              value={profile.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Add your name"
              className="w-full bg-transparent text-[19px] font-extrabold tracking-tight text-cream outline-none placeholder:text-cream/40"
            />
            <p className="truncate text-[12.5px] text-cream/60">
              {hostel.name} · {profile.block}, Room {profile.room}
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center justify-between rounded-2xl bg-cream/10 p-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-lime text-ink">
              <Icon name="wallet" className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </span>
            <div>
              <p className="text-[11.5px] text-cream/60">Hostel wallet</p>
              <p className="text-[17px] font-extrabold leading-tight">{rupees(profile.walletBalance)}</p>
            </div>
          </div>
          <button
            onClick={() => {
              update({ walletBalance: profile.walletBalance + 200 });
              toast("₹200 added to wallet");
            }}
            className="rounded-xl bg-lime px-3.5 py-2 text-[12.5px] font-bold text-ink"
          >
            Add money
          </button>
        </div>
      </header>

      <section className="mx-4 -mt-3 overflow-hidden rounded-[var(--radius-card)] bg-surface shadow-[var(--shadow-soft)]">
        {rows.map((row, i) => (
          <button
            key={row.label}
            onClick={row.onClick}
            className={`flex w-full items-center gap-3 p-4 text-left ${i > 0 ? "border-t border-line" : ""}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream-deep text-ink-soft">
              <Icon name={row.icon} className="h-[18px] w-[18px]" strokeWidth={2.1} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-ink">{row.label}</span>
              <span className="block truncate text-[12px] text-ink-soft">{row.hint}</span>
            </span>
            <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.4} />
          </button>
        ))}
      </section>

      <section className="mx-4 mt-4">
        <p className="mb-2 text-[13px] font-bold uppercase tracking-wide text-ink-soft">Switch hostel</p>
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {hostels.map((h) => (
            <Chip
              key={h.id}
              active={h.id === profile.hostelId}
              onClick={() => {
                update({ hostelId: h.id, block: h.blocks[0] });
                cart.clear();
                toast(`Switched to ${h.name}`);
              }}
            >
              {h.name}
            </Chip>
          ))}
        </div>
      </section>

      <div className="mx-4 mt-6 space-y-2">
        <Button
          full
          variant="outline"
          onClick={() => {
            update({ onboarded: false });
            navigate("/onboarding");
          }}
        >
          Replay onboarding
        </Button>
        <Button
          full
          variant="ghost"
          onClick={() => {
            resetDemo();
            cart.clear();
            toast("Demo data reset");
          }}
        >
          Reset demo data
        </Button>
      </div>

      <p className="mt-6 text-center text-[11px] text-ink-faint">Poolit · Student app v1.0</p>

      <Sheet open={addressOpen} onClose={() => setAddressOpen(false)} title="Delivery address">
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

      <Sheet open={favOpen} onClose={() => setFavOpen(false)} title="Favourites">
        {favourites.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-ink-soft">
            Tap the heart on any product to save it here.
          </p>
        ) : (
          <div className="space-y-2 py-1">
            {favourites.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5 shadow-[var(--shadow-soft)]">
                <ProductArt art={item.art} tint={item.tint} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{item.name}</p>
                  <p className="text-[12px] font-bold text-ink">{rupees(item.price)}</p>
                </div>
                <button
                  onClick={() => toggleFavorite(item.id)}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-coral-soft text-coral"
                  aria-label="Remove favourite"
                >
                  <Icon name="heart" filled className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </Sheet>
    </div>
  );
}
