import { useState } from "react";
import { Link } from "react-router-dom";
import { useStore } from "../../domain/store";
import { useCountdown } from "../../hooks/useCountdown";

function HostelCard({ hostelId }: { hostelId: string }) {
  const { hostels, vendors, slots, orders } = useStore();
  const hostel = hostels.find((h) => h.id === hostelId)!;
  const vendor = vendors.find((v) => v.hostelId === hostel.id);
  const slot = slots.find((s) => s.hostelId === hostel.id && s.status !== "dispatched");
  const orderCount = slot ? orders.filter((o) => o.slotId === slot.id).length : 0;
  const countdown = useCountdown(slot?.closesAt ?? Date.now());

  return (
    <Link to={`/student/${hostel.id}`}>
      <div className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-sm transition active:scale-[0.99]">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-secondary/10 text-3xl">
          🏠
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-body">{hostel.name}</p>
          <p className="truncate text-sm text-muted">{vendor?.name}</p>
          <div className="mt-1 flex items-center gap-2">
            {slot?.status === "open" ? (
              <span className="rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                ⏱ {countdown.label} left
              </span>
            ) : (
              <span className="rounded-full bg-muted/15 px-2 py-0.5 text-xs font-semibold text-muted">
                Pool closed
              </span>
            )}
            <span className="text-xs text-muted">{orderCount} joined</span>
          </div>
        </div>
        <span className="text-lg text-muted">›</span>
      </div>
    </Link>
  );
}

export function HostelSelect() {
  const { hostels, vendors } = useStore();
  const [search, setSearch] = useState("");

  const filtered = hostels.filter((h) => {
    if (!search.trim()) return true;
    const vendor = vendors.find((v) => v.hostelId === h.id);
    const q = search.trim().toLowerCase();
    return h.name.toLowerCase().includes(q) || vendor?.name.toLowerCase().includes(q);
  });

  return (
    <div className="mx-auto min-h-screen max-w-md bg-surface pb-8">
      <div className="bg-primary px-4 pb-6 pt-8 text-white">
        <p className="text-xs font-medium text-white/70">Ordering for</p>
        <h1 className="text-2xl font-bold">Your Hostel Mess 🍽️</h1>
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3 py-2.5">
          <span className="text-sm">🔍</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search hostel or vendor"
            className="w-full text-sm text-body outline-none placeholder:text-muted"
          />
        </div>
      </div>

      <div className="-mt-2 space-y-3 px-4 pt-4">
        {filtered.map((hostel) => (
          <HostelCard key={hostel.id} hostelId={hostel.id} />
        ))}
        {filtered.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">No hostels match "{search}"</p>
        )}
      </div>

      <Link to="/vendor" className="mt-6 block text-center text-sm text-secondary underline">
        I'm a vendor →
      </Link>
    </div>
  );
}
