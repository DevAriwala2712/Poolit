import { useStore } from "@poolit/domain";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../state/AuthContext";
import { useUIMode } from "../state/UIModeContext";
import { useVendor } from "../state/VendorContext";
import { CommandPalette } from "./CommandPalette";
import { LogoMark } from "./LogoMark";
import { MaterialIcon } from "./MaterialIcon";
import { Badge, Kbd } from "./ui";

const NAV: { to: string; label: string; icon: string; end?: boolean; advanced?: boolean }[] = [
  { to: "/", label: "Overview", icon: "dashboard", end: true },
  { to: "/orders", label: "Orders", icon: "receipt_long" },
  { to: "/inventory", label: "Inventory", icon: "inventory_2" },
  { to: "/analytics", label: "Analytics", icon: "monitoring", advanced: true },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const TITLES: Record<string, { crumb: string; sub: string }> = {
  "/": { crumb: "Operations Command", sub: "Real-time batch dispatching, hostel delivery clusters & inventory telemetry." },
  "/orders": { crumb: "Orders Management", sub: "Accept, prepare and dispatch pooled runs." },
  "/inventory": { crumb: "Inventory Management", sub: "SKU realtime stock & prep." },
  "/analytics": { crumb: "Analytics & Performance Review", sub: "Revenue, volume and peak hours." },
  "/settings": { crumb: "Store Operations & Settings", sub: "Store profile, pooling rules, kitchen SLA & dispatch parameters." },
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { pathname } = useLocation();
  const { vendor, hostel, allVendors, setVendorId } = useVendor();
  const { orders, slots } = useStore();
  const { session, signOut } = useAuth();
  const { advancedMode } = useUIMode();
  const nav = NAV.filter((item) => !item.advanced || advancedMode);

  const meta = TITLES[pathname] ?? { crumb: "Vendor Console", sub: "" };

  const mySlots = slots.filter((s) => s.vendorId === vendor.id);
  const pending = orders.filter(
    (o) => mySlots.some((s) => s.id === o.slotId) && o.status === "placed",
  ).length;
  const lowStock = vendor.menu.filter((m) => m.stockQty <= m.lowStockThreshold).length;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen((v) => !v);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === "b") {
        e.preventDefault();
        setCollapsed((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-screen bg-surface">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col justify-between bg-surface-container-lowest shadow-[0_1px_8px_rgba(0,0,0,0.04)] transition-all duration-200 md:flex ${
          collapsed ? "w-sidebar-collapsed-width" : "w-sidebar-width"
        }`}
      >
        <div className="flex w-full flex-col">
          <div className={`flex h-14 items-center gap-2.5 px-space-md ${collapsed ? "justify-center px-0" : "justify-between"}`}>
            <div className="flex min-w-0 items-center gap-space-sm">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#141A2C] p-1.5">
                <LogoMark className="h-full w-full" />
              </span>
              {!collapsed && (
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-headline-sm text-on-surface leading-tight">Poolit</span>
                  <span className="truncate text-label-sm text-secondary">Campus Dispatch</span>
                </div>
              )}
            </div>
            {!collapsed && (
              <button
                onClick={() => setCollapsed(true)}
                title="Toggle Sidebar (⌘B)"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-secondary transition-colors hover:bg-surface-container hover:text-on-surface"
              >
                <MaterialIcon name="unfold_more" className="text-[16px] rotate-90" />
              </button>
            )}
          </div>

          <div className="px-space-md py-space-xs">
            <div className="h-px w-full bg-surface-container-high" />
          </div>

          <nav className="mt-space-xs flex flex-col gap-space-2xs px-space-sm">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `flex items-center justify-between rounded-lg px-space-md py-space-sm transition-all ${
                    isActive
                      ? "bg-primary-container text-on-primary-container"
                      : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
                  } ${collapsed ? "justify-center" : ""}`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-space-md">
                      <MaterialIcon name={item.icon} className="text-[18px]" filled={isActive} />
                      {!collapsed && <span className="text-headline-sm">{item.label}</span>}
                    </div>
                    {!collapsed && item.to === "/orders" && pending > 0 && (
                      <span className="rounded-full bg-primary-fixed px-space-xs py-space-2xs text-label-sm text-on-primary-fixed">
                        {pending}
                      </span>
                    )}
                    {!collapsed && item.to === "/inventory" && lowStock > 0 && (
                      <span className="flex items-center gap-space-2xs">
                        <span className="h-1.5 w-1.5 rounded-full bg-primary-container" />
                        <span className="text-label-sm text-primary">{lowStock}</span>
                      </span>
                    )}
                  </>
                )}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="flex w-full flex-col gap-space-sm p-space-sm">
          {!collapsed ? (
            <label className="block px-space-2xs">
              <span className="mb-1 block text-label-sm uppercase tracking-wide text-secondary">Store</span>
              <select
                value={vendor.id}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full rounded-lg bg-surface-container-low px-space-sm py-1.5 text-body-md text-on-surface outline-none focus:ring-2 focus:ring-primary"
              >
                {allVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 truncate text-label-sm text-secondary">{hostel?.name}</p>
            </label>
          ) : (
            <div className="flex justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container text-body-sm font-semibold text-secondary">
                {vendor.name.charAt(0)}
              </span>
            </div>
          )}
          <div className="rounded-lg bg-surface-container-low p-space-sm">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-space-xs text-label-sm text-tertiary">
                <span className="h-2 w-2 animate-live rounded-full bg-tertiary" />
                {!collapsed && "Online"}
              </span>
              {!collapsed && <span className="text-label-sm text-secondary">12s ago</span>}
            </div>
            {!collapsed && (
              <div className="mt-space-xs flex items-center justify-between border-t border-surface-container-high pt-space-xs">
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-body-sm text-on-surface">{session?.user.email}</span>
                  <span className="truncate text-label-sm text-secondary">Vendor admin</span>
                </div>
                <button onClick={() => void signOut()} className="text-secondary transition-colors hover:text-on-surface">
                  <MaterialIcon name="logout" className="text-[16px]" />
                </button>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-space-md bg-surface/85 px-space-lg shadow-[0_1px_8px_rgba(0,0,0,0.04)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-space-md">
            <button
              onClick={() => setCollapsed((v) => !v)}
              title="Toggle sidebar (⌘B)"
              className="hidden h-8 w-8 items-center justify-center rounded-lg text-secondary transition hover:bg-surface-container hover:text-on-surface md:flex"
            >
              <MaterialIcon name="dock_to_right" className="text-[18px]" />
            </button>
            <nav className="flex items-center gap-space-xs text-body-sm">
              <span className="text-secondary">Poolit</span>
              <span className="text-secondary">/</span>
              <span className="text-headline-sm text-on-surface">{meta.crumb}</span>
            </nav>
            <div className="hidden h-4 w-px bg-surface-container-high md:block" />
            <div className="hidden items-center gap-space-xs rounded-full bg-surface-container-low px-space-sm py-space-2xs md:flex">
              <span className="h-2 w-2 rounded-full bg-tertiary" />
              <span className="text-label-sm text-on-surface">Accepting Orders · Normal Rush</span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm">
            <button
              onClick={() => setPaletteOpen(true)}
              className="hidden items-center gap-space-md rounded-lg bg-surface-container-lowest px-space-md py-space-xs text-secondary shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all hover:bg-surface-container hover:text-on-surface lg:flex"
            >
              <span className="flex items-center gap-space-xs">
                <MaterialIcon name="search" className="text-[16px]" />
                <span className="text-body-md">Search operations, orders, items...</span>
              </span>
              <Kbd>⌘K</Kbd>
            </button>
            <button className="flex h-8 items-center gap-space-xs rounded-lg bg-surface-container-lowest px-space-sm text-on-surface-variant shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all hover:bg-surface-container hover:text-on-surface">
              <MaterialIcon name="sync" className="text-[16px]" />
              <span className="hidden text-body-sm sm:inline">Sync</span>
            </button>
            <div className="relative">
              <button
                onClick={() => setNotifOpen((v) => !v)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg bg-surface-container-lowest text-on-surface-variant shadow-[0_1px_4px_rgba(0,0,0,0.04)] transition-all hover:bg-surface-container hover:text-on-surface"
              >
                <MaterialIcon name="notifications" className="text-[16px]" />
                {(pending > 0 || lowStock > 0) && (
                  <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary-container" />
                )}
              </button>
              {notifOpen && (
                <>
                  <button className="fixed inset-0 z-10" aria-label="Close notifications" onClick={() => setNotifOpen(false)} />
                  <div className="animate-fade absolute right-0 top-10 z-20 w-72 overflow-hidden rounded-lg bg-surface-container-lowest shadow-[0_4px_6px_-1px_rgba(15,23,42,0.08)]">
                    <p className="px-space-md py-space-sm text-headline-sm text-on-surface">Notifications</p>
                    <ul className="max-h-72 divide-y divide-surface-container overflow-y-auto">
                      {pending > 0 && (
                        <li className="flex gap-space-sm px-space-md py-space-sm">
                          <Badge tone="prep" live>New</Badge>
                          <p className="text-body-sm text-secondary">
                            <span className="text-on-surface">{pending} orders</span> waiting in the open pool.
                          </p>
                        </li>
                      )}
                      {lowStock > 0 && (
                        <li className="flex gap-space-sm px-space-md py-space-sm">
                          <Badge tone="error">Stock</Badge>
                          <p className="text-body-sm text-secondary">
                            <span className="text-on-surface">{lowStock} items</span> at or below the low-stock threshold.
                          </p>
                        </li>
                      )}
                      {pending === 0 && lowStock === 0 && (
                        <li className="px-space-md py-space-lg text-center text-body-sm text-secondary">All clear.</li>
                      )}
                    </ul>
                  </div>
                </>
              )}
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-inverse-surface text-body-sm font-semibold text-inverse-on-surface">
              {vendor.name.charAt(0)}
            </span>
          </div>
        </header>

        <main className="min-w-0 flex-1 bg-surface px-space-lg py-space-md">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
