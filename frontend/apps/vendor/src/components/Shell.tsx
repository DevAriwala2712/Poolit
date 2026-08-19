import { useStore } from "@poolit/domain";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useVendor } from "../state/VendorContext";
import { CommandPalette } from "./CommandPalette";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";
import { Badge, Kbd } from "./ui";

const NAV: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Dashboard", icon: "dashboard", end: true },
  { to: "/orders", label: "Orders", icon: "orders" },
  { to: "/inventory", label: "Inventory", icon: "inventory" },
  { to: "/analytics", label: "Analytics", icon: "analytics" },
  { to: "/settings", label: "Settings", icon: "settings" },
];

const TITLES: Record<string, { title: string; sub: string }> = {
  "/": { title: "Dashboard", sub: "Live view of today's pooled runs" },
  "/orders": { title: "Orders", sub: "Accept, prepare and dispatch pooled runs" },
  "/inventory": { title: "Inventory", sub: "Stock levels and pricing" },
  "/analytics": { title: "Analytics", sub: "Revenue, volume and peak hours" },
  "/settings": { title: "Settings", sub: "Store profile and preferences" },
};

export function Shell() {
  const [collapsed, setCollapsed] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const { pathname } = useLocation();
  const { vendor, hostel, allVendors, setVendorId } = useVendor();
  const { orders, slots } = useStore();

  const meta = TITLES[pathname] ?? { title: "Vendor Console", sub: "" };

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
    <div className="flex min-h-screen bg-bg">
      {/* Sidebar */}
      <aside
        className={`sticky top-0 hidden h-screen shrink-0 flex-col border-r border-line bg-panel transition-all duration-200 md:flex ${
          collapsed ? "w-[68px]" : "w-[228px]"
        }`}
      >
        <div className={`flex items-center gap-2.5 px-4 py-4 ${collapsed ? "justify-center px-0" : ""}`}>
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent text-[14px] font-bold text-bg">
            P
          </span>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-semibold leading-tight text-text">Poolit</p>
              <p className="truncate text-[11px] text-faint">Vendor Console</p>
            </div>
          )}
        </div>

        {!collapsed && (
          <p className="px-4 pb-1.5 pt-3 text-[10px] font-medium uppercase tracking-widest text-faint">
            Menu
          </p>
        )}

        <nav className="flex flex-1 flex-col gap-0.5 px-2.5">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                `group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] font-medium transition ${
                  isActive ? "bg-raised text-text" : "text-muted hover:bg-raised/60 hover:text-text"
                } ${collapsed ? "justify-center" : ""}`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-4 w-0.5 -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon name={item.icon} className="h-[17px] w-[17px] shrink-0" strokeWidth={1.9} />
                  {!collapsed && <span className="flex-1">{item.label}</span>}
                  {!collapsed && item.to === "/orders" && pending > 0 && (
                    <span className="rounded-md bg-accent px-1.5 py-0.5 text-[10.5px] font-bold text-bg">
                      {pending}
                    </span>
                  )}
                  {!collapsed && item.to === "/inventory" && lowStock > 0 && (
                    <span className="rounded-md bg-warn/15 px-1.5 py-0.5 text-[10.5px] font-bold text-warn">
                      {lowStock}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Store switcher */}
        <div className="border-t border-line p-2.5">
          {!collapsed ? (
            <label className="block">
              <span className="mb-1 block px-1 text-[10px] font-medium uppercase tracking-widest text-faint">
                Store
              </span>
              <select
                value={vendor.id}
                onChange={(e) => setVendorId(e.target.value)}
                className="w-full rounded-lg border border-line bg-raised px-2.5 py-2 text-[12.5px] text-text outline-none focus:border-accent"
              >
                {allVendors.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 truncate px-1 text-[11px] text-faint">{hostel?.name}</p>
            </label>
          ) : (
            <div className="flex justify-center">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-raised text-[12px] font-semibold text-muted">
                {vendor.name.charAt(0)}
              </span>
            </div>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex flex-wrap items-center gap-3 border-b border-line bg-bg/85 px-5 py-3 backdrop-blur">
          <button
            onClick={() => setCollapsed((v) => !v)}
            title="Toggle sidebar (⌘B)"
            className="hidden h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-text md:flex"
          >
            <Icon name="panelLeft" className="h-4 w-4" />
          </button>

          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[15px] font-semibold leading-tight text-text">{meta.title}</h1>
            <p className="truncate text-[11.5px] text-faint">{meta.sub}</p>
          </div>

          <button
            onClick={() => setPaletteOpen(true)}
            className="hidden items-center gap-2 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-[12px] text-faint transition hover:border-[#34343a] hover:text-muted lg:flex"
          >
            <Icon name="search" className="h-3.5 w-3.5" />
            <span className="pr-6">Search…</span>
            <Kbd>⌘K</Kbd>
          </button>

          <div className="relative">
            <button
              onClick={() => setNotifOpen((v) => !v)}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-raised hover:text-text"
            >
              <Icon name="bell" className="h-4 w-4" />
              {(pending > 0 || lowStock > 0) && (
                <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-accent" />
              )}
            </button>
            {notifOpen && (
              <>
                <button
                  className="fixed inset-0 z-10"
                  aria-label="Close notifications"
                  onClick={() => setNotifOpen(false)}
                />
                <div className="animate-fade absolute right-0 top-10 z-20 w-72 overflow-hidden rounded-xl border border-line bg-panel shadow-2xl">
                  <p className="border-b border-line px-3.5 py-2.5 text-[12px] font-semibold text-text">
                    Notifications
                  </p>
                  <ul className="max-h-72 divide-y divide-line-soft overflow-y-auto">
                    {pending > 0 && (
                      <li className="flex gap-2.5 px-3.5 py-3">
                        <Badge tone="accent" live>New</Badge>
                        <p className="text-[12px] leading-snug text-muted">
                          <span className="text-text">{pending} orders</span> waiting in the open pool.
                        </p>
                      </li>
                    )}
                    {lowStock > 0 && (
                      <li className="flex gap-2.5 px-3.5 py-3">
                        <Badge tone="warn">Stock</Badge>
                        <p className="text-[12px] leading-snug text-muted">
                          <span className="text-text">{lowStock} items</span> at or below the low-stock
                          threshold.
                        </p>
                      </li>
                    )}
                    {pending === 0 && lowStock === 0 && (
                      <li className="px-3.5 py-6 text-center text-[12px] text-faint">All clear.</li>
                    )}
                  </ul>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 rounded-lg border border-line bg-raised py-1 pl-1 pr-2.5">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-bg">
              {vendor.name.charAt(0)}
            </span>
            <span className="hidden text-[12px] font-medium text-text sm:block">{vendor.name}</span>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-5 py-5">
          <Outlet />
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
}
