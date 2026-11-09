import { SLOT_DURATION_MINUTES, feeForOrderCount, rupees, useStore } from "@poolit/domain";
import type { StaffMember } from "@poolit/domain";
import { api } from "@poolit/domain";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MaterialIcon } from "../components/MaterialIcon";
import { Badge, Button, Card } from "../components/ui";
import { useAuth } from "../state/AuthContext";
import { useUIMode } from "../state/UIModeContext";
import { CommissionCard } from "../components/CommissionCard";
import { useIsAdmin } from "../hooks/useIsAdmin";
import { useVendor } from "../state/VendorContext";


export function Settings() {
  const { vendor, hostel } = useVendor();
  const { refresh, updateVendorSettings } = useStore();
  const { session, signOut } = useAuth();
  const { advancedMode, setAdvancedMode } = useUIMode();
  const admin = useIsAdmin();
  const [accepting, setAccepting] = useState(vendor.acceptingOrders);
  const [prep, setPrep] = useState(vendor.prepMinutes);
  const [batchWindow, setBatchWindow] = useState(vendor.poolWindowMinutes ?? SLOT_DURATION_MINUTES);
  const [maxDensity, setMaxDensity] = useState(5);
  const [autoPrintKot, setAutoPrintKot] = useState(true);
  const [rushBuzzer, setRushBuzzer] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedJustNow, setSavedJustNow] = useState(false);

  // Re-sync local drafts if the vendor (or its server-side values) changes —
  // e.g. switching stores, or another session saving in the meantime.
  useEffect(() => {
    setAccepting(vendor.acceptingOrders);
    setPrep(vendor.prepMinutes);
    setBatchWindow(vendor.poolWindowMinutes ?? SLOT_DURATION_MINUTES);
  }, [vendor.id, vendor.acceptingOrders, vendor.prepMinutes, vendor.poolWindowMinutes]);

  const savedWindow = vendor.poolWindowMinutes ?? SLOT_DURATION_MINUTES;
  const dirty = accepting !== vendor.acceptingOrders || prep !== vendor.prepMinutes || batchWindow !== savedWindow;

  async function saveChanges() {
    setSaving(true);
    try {
      await updateVendorSettings(vendor.id, {
        acceptingOrders: accepting,
        prepMinutes: prep,
        poolWindowMinutes: batchWindow,
      });
      setSavedJustNow(true);
      setTimeout(() => setSavedJustNow(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  const netFee = feeForOrderCount(maxDensity);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [staffLoading, setStaffLoading] = useState(true);
  const [inviting, setInviting] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  useEffect(() => {
    let cancelled = false;
    setStaffLoading(true);
    api
      .getStaff(vendor.id)
      .then((data) => !cancelled && setStaff(data))
      .catch(() => !cancelled && setStaff([]))
      .finally(() => !cancelled && setStaffLoading(false));
    return () => {
      cancelled = true;
    };
  }, [vendor.id]);

  async function inviteCrewMember() {
    if (!inviteName.trim() || !inviteRole.trim()) return;
    const created = await api.createStaff(vendor.id, {
      name: inviteName.trim(),
      role: inviteRole.trim(),
      email: inviteEmail.trim() || undefined,
    });
    setStaff((prev) => [...prev, created]);
    setInviteName("");
    setInviteRole("");
    setInviteEmail("");
    setInviting(false);
  }

  async function cycleStaffStatus(member: StaffMember) {
    const next = member.status === "active" ? "break" : member.status === "break" ? "inactive" : "active";
    const updated = await api.updateStaff(member.id, { status: next });
    setStaff((prev) => prev.map((s) => (s.id === member.id ? updated : s)));
  }

  async function removeStaffMember(member: StaffMember) {
    await api.deleteStaff(member.id);
    setStaff((prev) => prev.filter((s) => s.id !== member.id));
  }

  return (
    <div className="space-y-space-md">
      <div className="flex flex-wrap items-center justify-between gap-space-sm">
        <div>
          <p className="text-label-sm uppercase tracking-wide text-secondary">{vendor.name} / Store Operations & Settings</p>
          <h1 className="text-headline-lg text-on-surface">Settings</h1>
          <p className="text-body-sm text-secondary">Configure store profile, delivery pooling rules, kitchen prep SLA, and dispatch parameters.</p>
        </div>
        {advancedMode && (
          <div className="flex items-center gap-space-sm">
            {savedJustNow && (
              <span className="flex items-center gap-space-2xs text-body-sm text-tertiary">
                <MaterialIcon name="check_circle" className="text-[16px]" /> Saved
              </span>
            )}
            <Button
              variant="primary"
              icon="check_circle"
              onClick={() => void saveChanges()}
              disabled={!dirty || saving}
            >
              {saving ? "Saving…" : "Save Changes"}
            </Button>
          </div>
        )}
      </div>

      <Card icon="tune" title="Interface Mode" subtitle="Choose how much of the console is visible">
        <ToggleRow
          icon="visibility"
          label="Advanced mode"
          hint={
            advancedMode
              ? "Every panel is visible: pooling tuning, kitchen SLA, staff, settlement, hardware, analytics."
              : "Only the day-to-day essentials are visible: orders, inventory & restocking, and pool controls."
          }
          checked={advancedMode}
          onChange={setAdvancedMode}
        />
      </Card>

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

          {advancedMode && (
            <Card icon="local_shipping" title="Campus Pooling & Batch Optimization">
            <div className="mt-space-sm grid grid-cols-1 gap-space-md sm:grid-cols-2">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-body-sm text-on-surface">Batch Window Interval</span>
                  <span className="text-headline-md text-primary">{batchWindow}m</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={60}
                  value={batchWindow}
                  onChange={(e) => setBatchWindow(Number(e.target.value))}
                  className="mt-space-xs w-full accent-primary"
                />
                <p className="mt-space-2xs text-label-sm text-secondary">
                  How long each pool stays open. A new pool starts automatically when one closes; changes apply from the next pool.
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
          )}

          {advancedMode && (
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
          )}

          {advancedMode && (
            <Card
              flush
              icon="badge"
              title="Active Staff & Stations"
              subtitle={staffLoading ? "Loading…" : `${staff.filter((s) => s.status === "active").length} active members`}
              action={
                <Button size="sm" icon="person_add" onClick={() => setInviting((v) => !v)}>
                  Invite Crew Member
                </Button>
              }
            >
              {inviting && (
                <div className="flex flex-wrap items-center gap-space-xs border-b border-surface-container-low px-space-md py-space-sm">
                  <input
                    autoFocus
                    value={inviteName}
                    onChange={(e) => setInviteName(e.target.value)}
                    placeholder="Name"
                    className="w-32 rounded bg-surface-container-low px-space-sm py-1 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value)}
                    placeholder="Role"
                    className="w-32 rounded bg-surface-container-low px-space-sm py-1 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <input
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="Email (optional)"
                    className="w-40 rounded bg-surface-container-low px-space-sm py-1 text-body-sm text-on-surface outline-none focus:ring-2 focus:ring-primary"
                  />
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => void inviteCrewMember()}
                    disabled={!inviteName.trim() || !inviteRole.trim()}
                  >
                    Add
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setInviting(false)}>Cancel</Button>
                </div>
              )}
              {!staffLoading && staff.length === 0 && !inviting && (
                <p className="px-space-md py-space-md text-body-sm text-secondary">No crew members yet.</p>
              )}
              <ul className="divide-y divide-surface-container">
                {staff.map((s) => (
                  <li key={s.id} className="flex items-center gap-space-sm px-space-md py-space-sm">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-container text-body-sm font-semibold text-secondary">
                      {s.name.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface">{s.name}</p>
                      <p className="text-label-sm text-secondary">{s.role}</p>
                    </div>
                    <button onClick={() => void cycleStaffStatus(s)} title="Click to change status">
                      <Badge tone={s.status === "active" ? "ready" : s.status === "break" ? "primary" : "neutral"}>
                        {s.status === "active" ? "Active" : s.status === "break" ? "On Break" : "Inactive"}
                      </Badge>
                    </button>
                    <button
                      onClick={() => void removeStaffMember(s)}
                      className="text-secondary transition hover:text-error"
                      title="Remove"
                    >
                      <MaterialIcon name="close" className="text-[16px]" />
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>

        <div className="flex flex-col gap-space-md lg:col-span-4">
          <CommissionCard vendorId={vendor.id} />

          {admin && (
            <Card icon="history" title="Activity log" subtitle="Who changed what, and when">
              <Link to="/activity" className="text-body-md text-primary underline">Open the activity log</Link>
            </Card>
          )}

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
