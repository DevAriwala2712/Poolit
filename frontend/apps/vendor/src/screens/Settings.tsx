import { SLOT_DURATION_MINUTES, feeForOrderCount, rupees, useStore } from "@poolit/domain";
import { useState } from "react";
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button, Card } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import { useVendor } from "../state/VendorContext";

const STAFF = [
  { name: "Suresh Kumar", role: "Owner / Expeditor", email: "suresh@campusmart.in", status: "Active" },
  { name: "Anita Rao", role: "Store Manager", email: "anita@campusmart.in", status: "Active" },
  { name: "Vikram Shah", role: "Runner Station", email: "vikram@campusmart.in", status: "On Break" },
];

const TABS = ["Store Profile", "Delivery & Pooling", "Kitchen SLA & Ops", "Team & Roles", "Settlement & Hardware"];

export function Settings() {
  const { vendor, hostel } = useVendor();
  const { refresh } = useStore();
  const { session, signOut } = useAuth();
  const [tab, setTab] = useState(TABS[0]);
  const [accepting, setAccepting] = useState(true);
  const [prep, setPrep] = useState(vendor.prepMinutes);
  const [batchWindow, setBatchWindow] = useState(SLOT_DURATION_MINUTES);
  const [maxDensity, setMaxDensity] = useState(5);
  const [autoPrintKot, setAutoPrintKot] = useState(true);
  const [rushBuzzer, setRushBuzzer] = useState(true);

  const netFee = feeForOrderCount(maxDensity);

  return (
    <div className="space-y-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <p className="text-label-sm uppercase tracking-wide text-secondary">{vendor.name} / Store Operations & Settings</p>
          <h1 className="text-headline-lg text-on-surface">Settings</h1>
          <p className="text-body-sm text-secondary">Configure store profile, delivery pooling rules, kitchen prep SLA, and dispatch parameters.</p>
        </div>
        <Button variant="primary" icon="check_circle">Save Changes</Button>
      </div>

      <div className="flex flex-wrap items-center gap-space-xs">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded px-space-sm py-space-xs text-body-sm transition ${
              tab === t ? "bg-primary-container text-on-primary-container" : "bg-surface-container-lowest text-secondary shadow-sm hover:bg-surface-container"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-space-md lg:grid-cols-12">
        <div className="flex flex-col gap-space-md lg:col-span-8">
          <Card icon="storefront" title="Station Identifier" subtitle={`${vendor.name} · ${hostel?.name ?? "—"}`}>
            <div className="mt-space-sm flex items-center gap-space-xs">
              <button
                onClick={() => setAccepting(true)}
                className={`flex items-center gap-space-xs rounded px-space-sm py-space-xs text-body-sm transition ${accepting ? "bg-surface-container-high text-on-surface" : "text-secondary"}`}
              >
                <span className={`h-2 w-2 rounded-full ${accepting ? "animate-live bg-tertiary" : "bg-secondary"}`} /> Accepting Orders
              </button>
              <button
                onClick={() => setAccepting(false)}
                className={`flex items-center gap-space-xs rounded px-space-sm py-space-xs text-body-sm transition ${!accepting ? "bg-surface-container-high text-on-surface" : "text-secondary"}`}
              >
                <span className="h-2 w-2 rounded-full bg-secondary" /> Pause Orders
              </button>
            </div>
            <div className="mt-space-sm grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              <div className="rounded-lg bg-surface-container-low p-space-sm">
                <p className="flex items-center gap-space-xs text-body-sm font-headline-sm text-on-surface">
                  <MaterialIcon name="wb_sunny" className="text-[16px] text-primary" /> Lunch Slot
                </p>
                <p className="text-label-sm text-secondary">11:00 AM – 3:30 PM · Status: Open Now</p>
              </div>
              <div className="rounded-lg bg-surface-container-low p-space-sm">
                <p className="flex items-center gap-space-xs text-body-sm font-headline-sm text-on-surface">
                  <MaterialIcon name="bedtime" className="text-[16px] text-tertiary" /> Dinner Slot
                </p>
                <p className="text-label-sm text-secondary">6:30 – 11:30 PM · Auto-activates 18:30 IST</p>
              </div>
            </div>
          </Card>

          <Card icon="local_shipping" title="Campus Pooling & Batch Optimization" action={<span className="rounded bg-secondary-container px-space-xs py-space-2xs text-label-sm text-on-secondary-container">Algo v4.2 Active</span>}>
            <div className="mt-space-sm grid grid-cols-1 gap-space-md sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-on-surface">Batch Window Interval</span>
                  <span className="text-headline-md text-primary">{batchWindow}m</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={20}
                  value={batchWindow}
                  onChange={(e) => setBatchWindow(Number(e.target.value))}
                  className="mt-space-xs w-full accent-primary"
                />
                <p className="mt-space-2xs text-label-sm text-secondary">
                  Orders destined for the same hostel block placed within this window automatically group into a single runner run.
                </p>
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-on-surface">Max Batch Density</span>
                  <span className="text-headline-md text-tertiary">{maxDensity} Units</span>
                </div>
                <input
                  type="range"
                  min={2}
                  max={10}
                  value={maxDensity}
                  onChange={(e) => setMaxDensity(Number(e.target.value))}
                  className="mt-space-xs w-full accent-tertiary"
                />
                <p className="mt-space-2xs text-label-sm text-secondary">
                  Maximum capacity threshold per runner run before auto-dispatch triggers ahead of window expiration.
                </p>
              </div>
            </div>
            <div className="mt-space-md flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
              <div>
                <p className="text-body-sm text-on-surface">Dynamic Delivery Economics</p>
                <p className="text-label-sm text-secondary">Base Fee {rupees(feeForOrderCount(0))} · Active Student Pool Subvention Applied</p>
              </div>
              <div className="rounded-lg bg-surface-container-lowest px-space-sm py-space-xs text-body-md shadow-sm">
                <span className="text-secondary line-through">{rupees(feeForOrderCount(0))}</span>{" "}
                <span className="font-semibold text-primary">{rupees(netFee)} Net</span>
              </div>
            </div>
          </Card>

          <Card icon="timer" title="Kitchen SLA & Ops" subtitle="Dispatch pacing & hardware triggers">
            <div className="mt-space-sm">
              <p className="text-body-sm text-on-surface">Target Prep Time</p>
              <div className="mt-space-xs flex items-center gap-space-xs">
                {[
                  { v: Math.max(1, prep - 3), label: `${Math.max(1, prep - 3)}m` },
                  { v: prep, label: `${prep}m` },
                  { v: prep + 2, label: `${prep + 2}m` },
                ].map((opt) => (
                  <button
                    key={opt.label}
                    onClick={() => setPrep(opt.v)}
                    className={`rounded px-space-sm py-space-xs text-body-sm transition ${
                      opt.v === prep ? "bg-primary-container text-on-primary-container" : "bg-surface-container text-secondary"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
              <p className="mt-space-2xs text-label-sm text-secondary">Alert expeditor if breached by 4 minutes</p>
            </div>
            <div className="mt-space-md grid grid-cols-1 gap-space-sm sm:grid-cols-2">
              <ToggleRow
                icon="print"
                label="Auto-Print KOT"
                hint="Star Micronics Station 1 · Thermal Port 9100"
                checked={autoPrintKot}
                onChange={setAutoPrintKot}
              />
              <ToggleRow
                icon="volume_up"
                label="Rush Tone Buzzer"
                hint="Triggers at >12 active orders"
                checked={rushBuzzer}
                onChange={setRushBuzzer}
              />
            </div>
          </Card>

          <Card
            flush
            icon="badge"
            title="Active Staff & Stations"
            subtitle={`${STAFF.filter((s) => s.status !== "On Break").length} active members`}
            action={<Button size="sm" icon="person_add">Invite Crew Member</Button>}
          >
            <ul className="divide-y divide-surface-container">
              {STAFF.map((s) => (
                <li key={s.email} className="flex items-center gap-space-sm px-space-md py-space-sm">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-body-sm font-semibold text-secondary">
                    {s.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-body-md text-on-surface">{s.name}</p>
                    <p className="text-label-sm text-secondary">{s.role}</p>
                  </div>
                  <Badge tone={s.status === "Active" ? "ready" : "neutral"}>{s.status}</Badge>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-4">
          <Card icon="account_balance_wallet" title="Direct Settlement" subtitle="Treasury Route">
            <p className="text-label-sm uppercase tracking-wide text-secondary">Scheduled Next Payout (04:00 AM IST)</p>
            <p className="text-headline-lg text-on-surface">₹42,680.00</p>
            <div className="mt-space-xs h-1.5 overflow-hidden rounded-full bg-surface-container">
              <div className="h-full w-[78%] rounded-full bg-primary" />
            </div>
            <p className="mt-space-2xs text-label-sm text-secondary">78% of Daily Liquidity Cleared</p>
            <div className="mt-space-sm space-y-1.5 text-body-sm">
              <Row label="Gateway Engine" value="Razorpay Campus Treasury" />
              <Row label="Merchant ID" value={`TIET_${vendor.name.split(" ")[0]?.toUpperCase()}_01`} />
            </div>
            <Button size="sm" icon="receipt_long" className="mt-space-sm w-full justify-center">Audit Settlement Logs</Button>
          </Card>

          <Card title="Peripheral Topology" action={<span className="text-label-sm text-secondary">3/3 Online</span>}>
            <div className="space-y-space-sm">
              <Peripheral icon="print" name="Star Micronics TSP143" hint="KOT Station 1 · IP 192.168.1.104" status="Connected" />
              <Peripheral icon="tablet" name="iPad Air Line Expeditor" hint="Battery 94% · Sync Latency 14ms" status="Active" />
              <Peripheral icon="qr_code_scanner" name="Zebra DS2208 Handheld" hint="Runner Handshake Barcode" status="Paired" />
            </div>
            <Button size="sm" icon="network_ping" className="mt-space-sm w-full justify-center">Ping Local Devices</Button>
          </Card>

          <Card title="Account" subtitle="Signed in to the vendor console">
            <div className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
              <div className="min-w-0">
                <p className="truncate text-body-md font-medium text-on-surface">{session?.user.email}</p>
                <p className="mt-0.5 text-label-sm text-secondary">Vendor admin</p>
              </div>
              <Button variant="danger" size="sm" onClick={() => void signOut()}>Sign out</Button>
            </div>
          </Card>

          <Card title="Data" subtitle="Sync with the Poolit API">
            <Button icon="sync" onClick={() => void refresh()}>Refresh from server</Button>
            <p className="mt-space-sm text-body-sm text-secondary">
              To reseed the database, run <code className="text-on-surface">npm run seed</code> in <code className="text-on-surface">backend/</code>.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  hint,
  checked,
  onChange,
}: {
  icon: string;
  label: string;
  hint: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button onClick={() => onChange(!checked)} className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm text-left">
      <MaterialIcon name={icon} className="text-[16px] text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm text-on-surface">{label}</p>
        <p className="text-label-sm text-secondary">{hint}</p>
      </div>
      <span className={`flex h-5 w-9 shrink-0 items-center rounded-full p-0.5 transition ${checked ? "bg-primary" : "bg-surface-container-high"}`}>
        <span className={`h-4 w-4 rounded-full bg-surface-container-lowest transition-transform ${checked ? "translate-x-4" : "translate-x-0"}`} />
      </span>
    </button>
  );
}

function Peripheral({ icon, name, hint, status }: { icon: string; name: string; hint: string; status: string }) {
  return (
    <div className="flex items-center gap-space-sm rounded-lg bg-surface-container-low p-space-sm">
      <MaterialIcon name={icon} className="text-[16px] text-secondary" />
      <div className="min-w-0 flex-1">
        <p className="text-body-sm text-on-surface">{name}</p>
        <p className="text-label-sm text-secondary">{hint}</p>
      </div>
      <span className="text-label-sm text-tertiary">{status}</span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-secondary">
      <span>{label}</span>
      <span className="text-on-surface">{value}</span>
    </div>
  );
}
