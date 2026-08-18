import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { feeForOrderCount } from "./feeLadder";
import { hostels, initialOrders, initialSlots, vendors as seedVendors } from "./seed";
import type { Order, OrderLineItem, PickListLine, RestockLogEntry, Slot, Vendor } from "./types";

const STORAGE_KEY = "poolit-state-v2";

interface State {
  slots: Slot[];
  orders: Order[];
  vendors: Vendor[];
  restockLog: RestockLogEntry[];
}

function loadInitialState(): State {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw) as State;
  } catch {
    // fall through to seed data
  }
  return { slots: initialSlots, orders: initialOrders, vendors: seedVendors, restockLog: [] };
}

type Action =
  | { type: "PLACE_ORDER"; slotId: string; studentName: string; items: OrderLineItem[] }
  | { type: "SIMULATE_JOIN"; slotId: string; studentName: string; items: OrderLineItem[] }
  | { type: "CLOSE_SLOT"; slotId: string }
  | { type: "DISPATCH_SLOT"; slotId: string }
  | { type: "MARK_DELIVERED"; orderId: string }
  | { type: "REOPEN_DEMO_SLOT"; slotId: string }
  | { type: "RESTOCK_ITEM"; vendorId: string; menuItemId: string; amount: number };

function decrementStock(vendors: Vendor[], vendorId: string, items: OrderLineItem[]): Vendor[] {
  return vendors.map((v) => {
    if (v.id !== vendorId) return v;
    return {
      ...v,
      menu: v.menu.map((item) => {
        const line = items.find((i) => i.menuItemId === item.id);
        if (!line) return item;
        return { ...item, stockQty: Math.max(0, item.stockQty - line.qty) };
      }),
    };
  });
}

function closeSlotInState(state: State, slotId: string): State {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== "open") return state;

  const ordersInSlot = state.orders.filter((o) => o.slotId === slotId);
  const fee = feeForOrderCount(ordersInSlot.length);

  return {
    ...state,
    slots: state.slots.map((s) => (s.id === slotId ? { ...s, status: "closed" } : s)),
    orders: state.orders.map((o) =>
      o.slotId === slotId ? { ...o, status: "pooled", deliveryFeeCharged: fee } : o,
    ),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PLACE_ORDER":
    case "SIMULATE_JOIN": {
      const slot = state.slots.find((s) => s.id === action.slotId);
      if (!slot) return state;
      const newOrder: Order = {
        id: `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        slotId: action.slotId,
        studentName: action.studentName,
        items: action.items,
        status: "placed",
        createdAt: Date.now(),
      };
      return {
        ...state,
        orders: [...state.orders, newOrder],
        vendors: decrementStock(state.vendors, slot.vendorId, action.items),
      };
    }
    case "CLOSE_SLOT":
      return closeSlotInState(state, action.slotId);
    case "DISPATCH_SLOT":
      return {
        ...state,
        slots: state.slots.map((s) =>
          s.id === action.slotId ? { ...s, status: "dispatched" } : s,
        ),
        orders: state.orders.map((o) =>
          o.slotId === action.slotId && o.status === "pooled"
            ? { ...o, status: "dispatched" }
            : o,
        ),
      };
    case "MARK_DELIVERED":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId && o.status === "dispatched"
            ? { ...o, status: "delivered" }
            : o,
        ),
      };
    case "REOPEN_DEMO_SLOT": {
      const slot = state.slots.find((s) => s.id === action.slotId);
      if (!slot) return state;
      const durationMs = slot.closesAt - slot.opensAt;
      const now = Date.now();
      return {
        ...state,
        slots: state.slots.map((s) =>
          s.id === action.slotId
            ? { ...s, status: "open", opensAt: now, closesAt: now + durationMs }
            : s,
        ),
        orders: state.orders.filter((o) => o.slotId !== action.slotId),
      };
    }
    case "RESTOCK_ITEM": {
      const entry: RestockLogEntry = {
        id: `r-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        vendorId: action.vendorId,
        menuItemId: action.menuItemId,
        amount: action.amount,
        at: Date.now(),
      };
      return {
        ...state,
        vendors: state.vendors.map((v) =>
          v.id !== action.vendorId
            ? v
            : {
                ...v,
                menu: v.menu.map((item) =>
                  item.id === action.menuItemId
                    ? { ...item, stockQty: item.stockQty + action.amount }
                    : item,
                ),
              },
        ),
        restockLog: [entry, ...state.restockLog].slice(0, 50),
      };
    }
    default:
      return state;
  }
}

interface StoreContextValue {
  slots: Slot[];
  orders: Order[];
  vendors: Vendor[];
  hostels: typeof hostels;
  restockLog: RestockLogEntry[];
  placeOrder: (slotId: string, studentName: string, items: OrderLineItem[]) => void;
  simulateJoin: (slotId: string) => void;
  closeSlot: (slotId: string) => void;
  dispatchSlot: (slotId: string) => void;
  markDelivered: (orderId: string) => void;
  reopenDemoSlot: (slotId: string) => void;
  restockItem: (vendorId: string, menuItemId: string, amount: number) => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

const SAMPLE_NAMES = ["Aarav", "Diya", "Ishaan", "Meera", "Vihaan", "Ananya", "Rohan", "Sana"];

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Auto-close any open slot whose timer has expired.
  useEffect(() => {
    const interval = setInterval(() => {
      const expired = state.slots.filter((s) => s.status === "open" && Date.now() >= s.closesAt);
      expired.forEach((s) => dispatch({ type: "CLOSE_SLOT", slotId: s.id }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.slots]);

  const value = useMemo<StoreContextValue>(
    () => ({
      slots: state.slots,
      orders: state.orders,
      vendors: state.vendors,
      hostels,
      restockLog: state.restockLog,
      placeOrder: (slotId, studentName, items) =>
        dispatch({ type: "PLACE_ORDER", slotId, studentName, items }),
      simulateJoin: (slotId) => {
        const slot = state.slots.find((s) => s.id === slotId);
        const vendor = state.vendors.find((v) => v.id === slot?.vendorId);
        if (!vendor) return;
        const inStock = vendor.menu.filter((m) => m.stockQty > 0);
        if (inStock.length === 0) return;
        const name = SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
        const item = inStock[Math.floor(Math.random() * inStock.length)];
        const qty = Math.min(item.stockQty, 1 + Math.floor(Math.random() * 2));
        dispatch({
          type: "SIMULATE_JOIN",
          slotId,
          studentName: name,
          items: [{ menuItemId: item.id, qty }],
        });
      },
      closeSlot: (slotId) => dispatch({ type: "CLOSE_SLOT", slotId }),
      dispatchSlot: (slotId) => dispatch({ type: "DISPATCH_SLOT", slotId }),
      markDelivered: (orderId) => dispatch({ type: "MARK_DELIVERED", orderId }),
      reopenDemoSlot: (slotId) => dispatch({ type: "REOPEN_DEMO_SLOT", slotId }),
      restockItem: (vendorId, menuItemId, amount) =>
        dispatch({ type: "RESTOCK_ITEM", vendorId, menuItemId, amount }),
    }),
    [state],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore must be used within StoreProvider");
  return ctx;
}

export function pickListForSlot(orders: Order[], slotId: string, menu: { id: string; name: string }[]): PickListLine[] {
  const totals = new Map<string, number>();
  orders
    .filter((o) => o.slotId === slotId)
    .forEach((o) => {
      o.items.forEach((line) => {
        totals.set(line.menuItemId, (totals.get(line.menuItemId) ?? 0) + line.qty);
      });
    });
  return Array.from(totals.entries())
    .map(([menuItemId, totalQty]) => ({
      menuItemId,
      name: menu.find((m) => m.id === menuItemId)?.name ?? "Unknown item",
      totalQty,
    }))
    .sort((a, b) => b.totalQty - a.totalQty);
}
