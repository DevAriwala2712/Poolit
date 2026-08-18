import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { Icon } from "../../components/Icon";
import type { IconName } from "../../components/Icon";

const NAV_ITEMS: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: "/vendor", label: "Dashboard", icon: "grid", end: true },
  { to: "/vendor/inventory", label: "Inventory", icon: "box", end: false },
];

function pageTitle(pathname: string): { title: string; subtitle: string } {
  if (pathname.startsWith("/vendor/inventory")) {
    return { title: "Inventory", subtitle: "Stock levels across every vendor" };
  }
  if (pathname.startsWith("/vendor/slot/")) {
    return { title: "Slot Detail", subtitle: "Pool composition and fulfillment" };
  }
  return { title: "Dashboard", subtitle: "Live view across all hostels and vendors" };
}

const TODAY = new Date().toLocaleDateString("en-IN", {
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function VendorLayout() {
  const { pathname } = useLocation();
  const { title, subtitle } = pageTitle(pathname);

  return (
    <div className="flex min-h-screen bg-surface">
      <aside className="sticky top-0 flex h-screen w-60 shrink-0 flex-col bg-primary px-4 py-6 text-white">
        <div className="flex items-center gap-2.5 px-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-base font-bold text-white">
            P
          </div>
          <div>
            <p className="text-base font-bold leading-tight">Poolit</p>
            <p className="text-xs text-white/50">Vendor Console</p>
          </div>
        </div>

        <p className="mt-8 px-3 text-[10px] font-semibold uppercase tracking-widest text-white/35">
          Menu
        </p>
        <nav className="mt-2 flex flex-1 flex-col gap-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-white/10 text-white"
                    : "text-white/60 hover:bg-white/5 hover:text-white"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-accent" />
                  )}
                  <Icon name={item.icon} className="h-[18px] w-[18px]" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 pt-3">
          <Link
            to="/"
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition hover:bg-white/5 hover:text-white"
          >
            <Icon name="logout" className="h-[18px] w-[18px]" />
            Student view
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-black/5 bg-white/80 px-8 py-4 backdrop-blur">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-bold leading-tight text-body">{title}</h1>
            <p className="truncate text-sm text-muted">{subtitle}</p>
          </div>
          <span className="flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs font-medium text-muted">
            <Icon name="calendar" className="h-4 w-4" />
            {TODAY}
          </span>
          <button className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-white transition hover:opacity-90">
            <Icon name="download" className="h-4 w-4" />
            Export
          </button>
        </header>

        <main className="min-w-0 flex-1 px-8 py-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
