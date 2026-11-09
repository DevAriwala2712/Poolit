import { ApiError, BACKEND, api, rupees, useStore } from "@poolit/domain";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ConfirmSheet } from "../components/ConfirmSheet";
import { Icon } from "../components/Icon";
import type { IconName } from "../components/Icon";
import { ProductArt } from "../components/ProductArt";
import { Sheet } from "../components/Sheet";
import { Button, Chip } from "../components/ui";
import { useHostelContext } from "../hooks/useHostelContext";
import { formatIndianPhone } from "../lib/phone";
import { useAuth } from "../state/AuthContext";
import { useCart } from "../state/CartContext";
import { useProfile } from "../state/ProfileContext";
import { useToast } from "../state/ToastContext";

export function Profile() {
  const navigate = useNavigate();
  const { profile, update, toggleFavorite } = useProfile();
  const { hostel, vendor } = useHostelContext();
  const { orders, hostels, refresh } = useStore();
  const cart = useCart();
  const toast = useToast();
  const [addressOpen, setAddressOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  const { session, phone, signOut } = useAuth();
  const myOrders = orders; // only the signed-in student's own orders
  const favourites = (vendor?.menu ?? []).filter((m) => profile.favorites.includes(m.id));

  const rows: { icon: IconName; label: string; hint: string; onClick: () => void }[] = [
    {
      icon: "phone",
      label: session ? "Signed in" : "Sign in",
      hint: session ? formatIndianPhone(phone) : "Use your mobile number to order and track",
      onClick: () => {
        if (!session) navigate("/login?next=/profile");
      },
    },
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
      label: "Help, terms and privacy",
      hint: "Grievance contact, refunds, your rights",
      onClick: () => navigate("/legal"),
    },
  ];

  /** Saves everything Poolit holds about this student as a JSON file. */
  async function downloadMyData() {
    setDownloading(true);
    try {
      const data = await api.exportMyData();
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = "poolit-my-data.json";
      a.click();
      URL.revokeObjectURL(url);
      toast("Your data was downloaded");
    } catch (err) {
      toast(err instanceof ApiError ? err.message : "Couldn't download your data. Try again.", "info");
    } finally {
      setDownloading(false);
    }
  }

  async function deleteMyAccount() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.deleteMyAccount("DELETE");
      setDeleteOpen(false);
      cart.clear();
      await signOut();
      update({ name: "", onboarded: false });
      toast("Your account was deleted");
      navigate("/onboarding", { replace: true });
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "Couldn't delete your account. Try again.");
    } finally {
      setDeleting(false);
    }
  }

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
            <p className="truncate text-small text-cream/60">
              {hostel.name} · {profile.block}, Room {profile.room}
            </p>
          </div>
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
              <span className="block text-body font-bold text-ink">{row.label}</span>
              <span className="block truncate text-small text-ink-soft">{row.hint}</span>
            </span>
            <Icon name="chevronRight" className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={2.4} />
          </button>
        ))}
      </section>

      <section className="mx-4 mt-4">
        <p className="mb-2 text-body-sm font-bold uppercase tracking-wide text-ink-soft">Switch hostel</p>
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

      {BACKEND === "supabase" && session && (
        <section className="mx-4 mt-4">
          <p className="mb-2 text-body-sm font-bold uppercase tracking-wide text-ink-soft">Your data</p>
          <div className="space-y-2">
            <Button full variant="outline" onClick={() => void downloadMyData()} disabled={downloading}>
              {downloading ? "Preparing…" : "Download my data"}
            </Button>
            <Button
              full
              variant="ghost"
              className="!text-coral"
              onClick={() => {
                setDeleteError(null);
                setDeleteOpen(true);
              }}
            >
              Delete my account
            </Button>
          </div>
        </section>
      )}

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
            void refresh();
            toast("Refreshed from the server");
          }}
        >
          Refresh data
        </Button>
        {session && (
          <Button
            full
            variant="ghost"
            onClick={() => {
              void signOut();
              cart.clear();
              toast("Signed out");
            }}
          >
            Sign out
          </Button>
        )}
      </div>

      <p className="mt-6 text-center text-caption text-ink-faint">Poolit · Student app v1.0</p>

      <ConfirmSheet
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete your account?"
        message="This removes your login and saved details. Your past orders stay with the store for its accounts, but without your name, room or note. You can't undo this, and you can't delete while an order is on its way."
        confirmLabel="Delete my account"
        requireText="DELETE"
        busy={deleting}
        error={deleteError}
        onConfirm={() => void deleteMyAccount()}
      />

      <Sheet open={addressOpen} onClose={() => setAddressOpen(false)} title="Delivery address">
        <p className="text-body-sm text-ink-soft">{hostel.name}</p>
        <div className="mt-3 space-y-3">
          <div>
            <span className="text-small font-semibold text-ink-soft">Block</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {hostel.blocks.map((b) => (
                <Chip key={b} active={profile.block === b} onClick={() => update({ block: b })}>
                  {b}
                </Chip>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="text-small font-semibold text-ink-soft">Room number</span>
            <input
              value={profile.room}
              onChange={(e) => update({ room: e.target.value.replace(/\D/g, "").slice(0, 4) })}
              inputMode="numeric"
              className="mt-1.5 min-h-[48px] w-full rounded-2xl bg-surface px-4 text-lead font-medium text-ink shadow-[var(--shadow-soft)] outline-none focus:ring-2 focus:ring-lime"
            />
          </label>
        </div>
      </Sheet>

      <Sheet open={favOpen} onClose={() => setFavOpen(false)} title="Favourites">
        {favourites.length === 0 ? (
          <p className="py-8 text-center text-body-sm text-ink-soft">
            Tap the heart on any product to save it here.
          </p>
        ) : (
          <div className="space-y-2 py-1">
            {favourites.map((item) => (
              <div key={item.id} className="flex items-center gap-3 rounded-2xl bg-surface p-2.5 shadow-[var(--shadow-soft)]">
                <ProductArt art={item.art} tint={item.tint} imagePath={item.imagePath} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-body-sm font-semibold text-ink">{item.name}</p>
                  <p className="text-small font-bold text-ink">{rupees(item.price)}</p>
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
