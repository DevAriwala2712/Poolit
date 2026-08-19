import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

const KEY = "poolit-student-cart-v1";

interface CartContextValue {
  lines: Record<string, number>;
  count: number;
  qtyOf: (menuItemId: string) => number;
  add: (menuItemId: string, max: number) => void;
  remove: (menuItemId: string) => void;
  setQty: (menuItemId: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) return JSON.parse(raw) as Record<string, number>;
    } catch {
      // fall through to empty cart
    }
    return {};
  });

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(lines));
  }, [lines]);

  const value = useMemo<CartContextValue>(() => {
    const count = Object.values(lines).reduce((n, q) => n + q, 0);
    return {
      lines,
      count,
      qtyOf: (id) => lines[id] ?? 0,
      add: (id, max) =>
        setLines((prev) => {
          const next = Math.min(max, (prev[id] ?? 0) + 1);
          return next === (prev[id] ?? 0) ? prev : { ...prev, [id]: next };
        }),
      remove: (id) =>
        setLines((prev) => {
          const next = (prev[id] ?? 0) - 1;
          if (next <= 0) {
            const { [id]: _drop, ...rest } = prev;
            return rest;
          }
          return { ...prev, [id]: next };
        }),
      setQty: (id, qty) =>
        setLines((prev) => {
          if (qty <= 0) {
            const { [id]: _drop, ...rest } = prev;
            return rest;
          }
          return { ...prev, [id]: qty };
        }),
      clear: () => setLines({}),
    };
  }, [lines]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
