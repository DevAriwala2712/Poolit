import { NavLink } from "react-router-dom";
import { useCart } from "../state/CartContext";
import { Icon } from "./Icon";
import type { IconName } from "./Icon";

const TABS: { to: string; label: string; icon: IconName; end?: boolean }[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/categories", label: "Categories", icon: "grid" },
  { to: "/cart", label: "Cart", icon: "cart" },
  { to: "/orders", label: "Orders", icon: "receipt" },
  { to: "/profile", label: "Profile", icon: "user" },
];

export function TabBar() {
  const { count } = useCart();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 mx-auto max-w-md border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur">
      <ul className="flex items-stretch">
        {TABS.map((tab) => (
          <li key={tab.to} className="flex-1">
            <NavLink
              to={tab.to}
              end={tab.end}
              className={({ isActive }) =>
                `relative flex min-h-[56px] flex-col items-center justify-center gap-1 text-[10.5px] font-semibold transition ${
                  isActive ? "text-ink" : "text-ink-faint"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className="relative">
                    <Icon
                      name={tab.icon}
                      className="h-[22px] w-[22px]"
                      strokeWidth={isActive ? 2.3 : 1.8}
                    />
                    {tab.icon === "cart" && count > 0 && (
                      <span className="absolute -right-2 -top-1.5 flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-coral px-1 text-[10px] font-extrabold text-white">
                        {count}
                      </span>
                    )}
                  </span>
                  {tab.label}
                  {isActive && (
                    <span className="absolute top-0 h-[3px] w-8 rounded-b-full bg-lime" />
                  )}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
