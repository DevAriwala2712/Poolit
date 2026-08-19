import { createContext, useContext, useEffect, useMemo, useReducer } from "react";
import type { ReactNode } from "react";
import { feeForOrderCount } from "./feeLadder";
import { hostels, initialOrders, initialSlots, vendors as seedVendors } from "./seed";
import type {
  MenuItem,
  Order,
  OrderLineItem,
  PickListLine,
  RestockLogEntry,
  Slot,
  Vendor,
} from "./types";

const STORAGE_KEY = "poolit-state-v3";

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

interface PlaceOrderInput {
  slotId: string;
  studentName: string;
  items: OrderLineItem[];
  block?: string;
  room?: string;
  tip?: number;
  paymentMethod?: string;
  note?: string;
}

type Action =
  | { type: "PLACE_ORDER"; input: PlaceOrderInput; id: string }
  | { type: "CLOSE_SLOT"; slotId: string }
  | { type: "DISPATCH_SLOT"; slotId: string }
  | { type: "MARK_DELIVERED"; orderId: string }
  | { type: "REOPEN_DEMO_SLOT"; slotId: string }
  | { type: "RESTOCK_ITEM"; vendorId: string; menuItemId: string; amount: number }
  | { type: "SET_ITEM_PRICE"; vendorId: string; menuItemId: string; price: number }
  | { type: "RESET_DEMO" };

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

/**
 * Slot close: lock each order's fee at the tier matching the FINAL pool size,
 * then move every order from `placed` to `pooled`.
 */
function closeSlotInState(state: State, slotId: string): State {
  const slot = state.slots.find((s) => s.id === slotId);
  if (!slot || slot.status !== "open") return state;

  const fee = feeForOrderCount(state.orders.filter((o) => o.slotId === slotId).length);

  return {
    ...state,
    slots: state.slots.map((s) => (s.id === slotId ? { ...s, status: "closed" } : s)),
    orders: state.orders.map((o) =>
      o.slotId === slotId && o.status === "placed"
        ? { ...o, status: "pooled", deliveryFeeCharged: fee }
        : o,
    ),
  };
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "PLACE_ORDER": {
      const slot = state.slots.find((s) => s.id === action.input.slotId);
      if (!slot || slot.status !== "open") return state;
      const newOrder: Order = {
        id: action.id,
        slotId: action.input.slotId,
        studentName: action.input.studentName,
        block: action.input.block,
        room: action.input.room,
        items: action.input.items,
        status: "placed",
        tip: action.input.tip,
        paymentMethod: action.input.paymentMethod,
        note: action.input.note,
        createdAt: Date.now(),
      };
      return {
        ...state,
        orders: [...state.orders, newOrder],
        vendors: decrementStock(state.vendors, slot.vendorId, action.input.items),
      };
    }
    case "CLOSE_SLOT":
      return closeSlotInState(state, action.slotId);
    case "DISPATCH_SLOT": {
      const slot = state.slots.find((s) => s.id === action.slotId);
      if (!slot || slot.status !== "closed") return state;
      return {
        ...state,
        slots: state.slots.map((s) => (s.id === action.slotId ? { ...s, status: "dispatched" } : s)),
        orders: state.orders.map((o) =>
          o.slotId === action.slotId && o.status === "pooled" ? { ...o, status: "dispatched" } : o,
        ),
      };
    }
    case "MARK_DELIVERED":
      return {
        ...state,
        orders: state.orders.map((o) =>
          o.id === action.orderId && o.status === "dispatched" ? { ...o, status: "delivered" } : o,
        ),
      };
    case "REOPEN_DEMO_SLOT": {
      const slot = state.slots.find((s) => s.id === action.slotId);
      if (!slot) return state;
      const duration = slot.closesAt - slot.opensAt;
      const now = Date.now();
      return {
        ...state,
        slots: state.slots.map((s) =>
          s.id === action.slotId ? { ...s, status: "open", opensAt: now, closesAt: now + duration } : s,
        ),
        orders: state.orders.filter((o) => o.slotId !== action.slotId),
      };
    }
    case "RESTOCK_ITEM": {
      if (action.amount <= 0) return state;
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
        restockLog: [entry, ...state.restockLog].slice(0, 60),
      };
    }
    case "SET_ITEM_PRICE":
      return {
        ...state,
        vendors: state.vendors.map((v) =>
          v.id !== action.vendorId
            ? v
            : {
                ...v,
                menu: v.menu.map((item) =>
                  item.id === action.menuItemId ? { ...item, price: action.price } : item,
                ),
              },
        ),
      };
    case "RESET_DEMO":
      return { slots: initialSlots, orders: initialOrders, vendors: seedVendors, restockLog: [] };
    default:
      return state;
  }
}

interface StoreContextValue extends State {
  hostels: typeof hostels;
  placeOrder: (input: PlaceOrderInput) => string;
  closeSlot: (slotId: string) => void;
  dispatchSlot: (slotId: string) => void;
  markDelivered: (orderId: string) => void;
  reopenDemoSlot: (slotId: string) => void;
  restockItem: (vendorId: string, menuItemId: string, amount: number) => void;
  setItemPrice: (vendorId: string, menuItemId: string, price: number) => void;
  resetDemo: () => void;
}

const StoreContext = createContext<StoreContextValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadInitialState);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  // Auto-close any open slot whose timer has expired.
  useEffect(() => {
    const interval = setInterval(() => {
      state.slots
        .filter((s) => s.status === "open" && Date.now() >= s.closesAt)
        .forEach((s) => dispatch({ type: "CLOSE_SLOT", slotId: s.id }));
    }, 1000);
    return () => clearInterval(interval);
  }, [state.slots]);

  // Keep the two apps in sync when both are open in the same browser.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue) window.location.reload();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...state,
      hostels,
      placeOrder: (input) => {
        const id = `o-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        dispatch({ type: "PLACE_ORDER", input, id });
        return id;
      },
      closeSlot: (slotId) => dispatch({ type: "CLOSE_SLOT", slotId }),
      dispatchSlot: (slotId) => dispatch({ type: "DISPATCH_SLOT", slotId }),
      markDelivered: (orderId) => dispatch({ type: "MARK_DELIVERED", orderId }),
      reopenDemoSlot: (slotId) => dispatch({ type: "REOPEN_DEMO_SLOT", slotId }),
      restockItem: (vendorId, menuItemId, amount) =>
        dispatch({ type: "RESTOCK_ITEM", vendorId, menuItemId, amount }),
      setItemPrice: (vendorId, menuItemId, price) =>
        dispatch({ type: "SET_ITEM_PRICE", vendorId, menuItemId, price }),
      resetDemo: () => dispatch({ type: "RESET_DEMO" }),
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

/** Total quantity per menu item across every order in a slot. */
export function pickListForSlot(orders: Order[], slotId: string, menu: MenuItem[]): PickListLine[] {
  const totals = new Map<string, number>();
  orders
    .filter((o) => o.slotId === slotId)
    .forEach((o) =>
      o.items.forEach((line) =>
        totals.set(line.menuItemId, (totals.get(line.menuItemId) ?? 0) + line.qty),
      ),
    );
  return Array.from(totals.entries())
    .map(([menuItemId, totalQty]) => {
      const item = menu.find((m) => m.id === menuItemId);
      return {
        menuItemId,
        name: item?.name ?? "Unknown item",
        art: item?.art ?? "📦",
        totalQty,
      };
    })
    .sort((a, b) => b.totalQty - a.totalQty);
}
