import { SLOT_DURATION_MINUTES, useStore } from "@poolit/domain";
import { useState } from "react";
import { Icon } from "../components/Icon";
import { Badge, Button, Card } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import { useVendor } from "../state/VendorContext";

const STAFF = [
  { name: "Suresh Kumar", role: "Owner", email: "suresh@campusmart.in", active: true },
  { name: "Anita Rao", role: "Store manager", email: "anita@campusmart.in", active: true },
  { name: "Vikram Shah", role: "Packer", email: "vikram@campusmart.in", active: false },
];

export function Settings() {
  const { vendor, hostel } = useVendor();
  const { refresh } = useStore();
  const { session, signOut } = useAuth();
  const [prep, setPrep] = useState(vendor.prepMinutes);
  const [radius, setRadius] = useState(1.5);
  const [openTime, setOpenTime] = useState("08:00");
  const [closeTime, setCloseTime] = useState("23:30");
  const [notifs, setNotifs] = useState({ newOrder: true, lowStock: true, payout: false, digest: true });

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      <Card title="Store profile" subtitle="How students see your store">
        <div className="space-y-3">
          <Field label="Store name" value={vendor.name} />
          <Field label="Serving hostel" value={hostel?.name ?? "—"} />
          <div>
            <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-faint">
              Delivery radius
            </p>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0.5}
                max={5}
                step={0.5}
                value={radius}
                onChange={(e) => setRadius(Number(e.target.value))}
                className="flex-1 accent-[var(--color-accent)]"
              />
              <span className="w-14 text-right text-[13px] font-medium text-text">{radius} km</span>
            </div>
          </div>
        </div>
      </Card>

      <Card title="Operating hours" subtitle="Outside these hours, pools don't open">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-faint">
                Opens
              </span>
              <input
                type="time"
                value={openTime}
                onChange={(e) => setOpenTime(e.target.value)}
                className="w-full rounded-lg border border-line bg-raised px-2.5 py-2 text-[13px] text-text outline-none focus:border-accent"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[11.5px] font-medium uppercase tracking-wider text-faint">
                Closes
              </span>
              <input
                type="time"
                value={closeTime}
                onChange={(e) => setCloseTime(e.target.value)}
                className="w-full rounded-lg border border-line bg-raised px-2.5 py-2 text-[13px] text-text outline-none focus:border-accent"
              />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-faint">
              Prep time target
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" icon="minus" onClick={() => setPrep((p) => Math.max(1, p - 1))} />
              <span className="w-20 text-center text-[15px] font-semibold text-text">{prep} min</span>
              <Button size="sm" icon="plus" onClick={() => setPrep((p) => Math.min(30, p + 1))} />
            </div>
          </div>

          <div className="rounded-lg border border-line bg-raised/50 p-3">
            <p className="flex items-center gap-1.5 text-[12px] font-medium text-text">
              <Icon name="users" className="h-3.5 w-3.5 text-accent" />
              Pooling window
            </p>
            <p className="mt-1 text-[11.5px] leading-relaxed text-faint">
              Each pool stays open for {SLOT_DURATION_MINUTES} minutes. The per-student delivery fee
              drops from ₹20 → ₹10 → ₹5 → free as more orders join, and locks when the pool closes.
            </p>
          </div>
        </div>
      </Card>

      <Card title="Notifications" subtitle="What we ping you about">
        <ul className="space-y-1">
          {[
            { key: "newOrder" as const, label: "New order placed", hint: "Instant push" },
            { key: "lowStock" as const, label: "Low stock alerts", hint: "When an item dips below threshold" },
            { key: "payout" as const, label: "Payout settled", hint: "Weekly settlement confirmation" },
            { key: "digest" as const, label: "Daily digest", hint: "Yesterday's summary at 9 AM" },
          ].map((row) => (
            <li key={row.key}>
              <button
                onClick={() => setNotifs((n) => ({ ...n, [row.key]: !n[row.key] }))}
                className="flex w-full items-center gap-3 rounded-lg px-1 py-2.5 text-left transition hover:bg-raised/50"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] text-text">{row.label}</span>
                  <span className="block text-[11px] text-faint">{row.hint}</span>
                </span>
                <span
                  className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${
                    notifs[row.key] ? "bg-accent" : "bg-line"
                  }`}
                >
                  <span
                    className={`h-4 w-4 rounded-full bg-bg transition-transform ${
                      notifs[row.key] ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </Card>

      <Card title="Payment settlement" subtitle="Where your earnings land">
        <div className="space-y-3">
          <Field label="Account" value="HDFC ••••4821" />
          <Field label="Cycle" value="Weekly, every Monday" />
          <div className="flex items-center justify-between rounded-lg border border-line bg-raised/50 p-3">
            <div>
              <p className="text-[11.5px] text-faint">Next payout</p>
              <p className="text-[16px] font-semibold text-text">₹42,180</p>
            </div>
            <Badge tone="ok">On track</Badge>
          </div>
        </div>
      </Card>

      <Card flush title="Team" subtitle={`${STAFF.filter((s) => s.active).length} active members`} className="xl:col-span-2">
        <ul className="divide-y divide-line-soft">
          {STAFF.map((s) => (
            <li key={s.email} className="flex items-center gap-3 px-4 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-raised text-[12px] font-semibold text-muted">
                {s.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[12.5px] text-text">{s.name}</p>
                <p className="text-[11px] text-faint">{s.email}</p>
              </div>
              <Badge tone="neutral">{s.role}</Badge>
              <Badge tone={s.active ? "ok" : "neutral"}>{s.active ? "Active" : "Invited"}</Badge>
            </li>
          ))}
        </ul>
        <div className="border-t border-line-soft px-4 py-3">
          <Button size="sm" icon="plus">
            Invite teammate
          </Button>
        </div>
      </Card>

      <Card title="Account" subtitle="Signed in to the vendor console">
        <div className="flex items-center justify-between rounded-lg border border-line bg-raised/50 p-3">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-text">{session?.user.email}</p>
            <p className="mt-0.5 text-[11px] text-faint">Vendor admin</p>
          </div>
          <Button variant="danger" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </Card>

      <Card title="Data" subtitle="Sync with the Poolit API" className="xl:col-span-2">
        <div className="flex flex-wrap items-center gap-3">
          <Button icon="refresh" onClick={() => void refresh()}>
            Refresh from server
          </Button>
          <p className="text-[11.5px] text-faint">
            Stores, stock levels and pooled runs are served by the backend. To reseed the
            database, run <code className="text-muted">npm run seed</code> in <code className="text-muted">backend/</code>.
          </p>
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="mb-1.5 text-[11.5px] font-medium uppercase tracking-wider text-faint">{label}</p>
      <div className="rounded-lg border border-line bg-raised px-3 py-2 text-[13px] text-text">
        {value}
      </div>
    </div>
  );
}
