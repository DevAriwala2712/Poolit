import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError, BACKEND } from "./api";
import type { PlaceOrderInput, StockAdjustmentInput } from "./api";
import type { Hostel, MenuItem, Order, PickListLine, Slot, Vendor } from "./types";

/**
 * Live application state, backed by the Poolit API (see `backend/`).
 *
 * Reads are polled so both apps stay in step: a vendor closing a pool shows up
 * on the student's tracking screen, and a student's order shows up in the
 * vendor's live feed, without either side reloading.
 */

/** The Supabase backend answers in one cheap call, so it polls less often than the old API did. */
const POLL_INTERVAL_MS = BACKEND === "supabase" ? 15_000 : 5000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface StoreData {
  hostels: Hostel[];
  vendors: Vendor[];
  slots: Slot[];
  /**
   * Vendor mode: every order for every store.
   * Student mode: only the signed-in student's own orders (empty when signed out).
   */
  orders: Order[];
  /** Live order count per open slot, from the server (student mode). */
  poolCounts: Record<string, number>;
}

const EMPTY: StoreData = { hostels: [], vendors: [], slots: [], orders: [], poolCounts: {} };

/**
 * "vendor": the console's view — all stores' orders (needs a vendor session).
 * "student": public catalogue + current pools + only the caller's own orders,
 *   so no student's name or room is ever sent to another student's browser.
 */
export type StoreMode = "vendor" | "student";

interface StoreContextValue extends StoreData {
  loading: boolean;
  error: string | null;
  /** Epoch ms of the last successful sync with the API (null before the first). */
  lastSyncedAt: number | null;
  refresh: () => Promise<void>;
  /**
   * Student mode: tell the store which hostel the student is looking at, so it
   * loads just that hostel's pool. Ignored for anything that is not a hostel id.
   */
  setHostelFocus: (hostelId: string | undefined) => void;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  closeSlot: (slotId: string) => Promise<void>;
  dispatchSlot: (slotId: string) => Promise<void>;
  markDelivered: (orderId: string) => Promise<void>;
  restockItem: (vendorId: string, menuItemId: string, amount: number) => Promise<void>;
  setItemPrice: (vendorId: string, menuItemId: string, price: number) => Promise<void>;
  setItemBarcode: (vendorId: string, menuItemId: string, barcode: string) => Promise<void>;
  /** Generate an in-store EAN-13 for an item; resolves to the new code. */
  generateBarcode: (menuItemId: string) => Promise<string>;
  /** Generate codes for every item in a store without one; resolves to the count. */
  generateMissingBarcodes: (vendorId: string) => Promise<number>;
  adjustStock: (menuItemId: string, input: StockAdjustmentInput) => Promise<void>;
  updateVendorSettings: (
    vendorId: string,
    patch: { acceptingOrders?: boolean; prepMinutes?: number; poolWindowMinutes?: number },
  ) => Promise<void>;
  createMenuItem: (
    vendorId: string,
    input: {
      name: string;
      category: string;
      price: number;
      unit: string;
      stockQty?: number;
      lowStockThreshold?: number;
      isVeg?: boolean;
      art?: string;
      tint?: string;
    },
  ) => Promise<MenuItem>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/**
 * Vendor view: one request for the signed-in vendor's stores, their pools
 * from the last 7 days plus any unfinished ones, and those pools' orders.
 * (Previously N stores × (orders + current pool + every historical pool),
 * which grew with order history on every poll.)
 */
async function fetchAll(): Promise<StoreData> {
  const { hostels, vendors, slots, orders } = await api.getVendorOverview(7);
  return { hostels, vendors, slots, orders, poolCounts: {} };
}

export function StoreProvider({
  children,
  onMutationError,
  mode = "vendor",
}: {
  children: ReactNode;
  mode?: StoreMode;
  /**
   * Called when a write (restock, close pool, …) fails, with a human-readable
   * message. The error is still re-thrown so callers that await can react.
   */
  onMutationError?: (message: string, error: unknown) => void;
}) {
  const [data, setData] = useState<StoreData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);
  const inFlight = useRef(false);
  const hostelFocus = useRef<string | undefined>(undefined);
  const onErrorRef = useRef(onMutationError);
  useEffect(() => {
    onErrorRef.current = onMutationError;
  }, [onMutationError]);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next: StoreData = mode === "student" ? await api.getStudentView(hostelFocus.current) : await fetchAll();
      setData(next);
      setError(null);
      setLastSyncedAt(Date.now());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong loading Poolit.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, [mode]);

  const setHostelFocus = useCallback(
    (hostelId: string | undefined) => {
      const next = hostelId && UUID.test(hostelId) ? hostelId : undefined;
      if (hostelFocus.current === next) return;
      hostelFocus.current = next;
      if (mode === "student") void refresh();
    },
    [mode, refresh],
  );

  // Poll while the tab is visible; pause in the background (saves battery and
  // API quota on phones) and catch up immediately when the user returns.
  useEffect(() => {
    void refresh();
    const id = setInterval(() => {
      if (typeof document === "undefined" || !document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => {
      if (!document.hidden) void refresh();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
    };
  }, [refresh]);

  /** Wrap a write so failures are always surfaced, then re-thrown. */
  const mutate = useCallback(
    <A extends unknown[], R>(fn: (...args: A) => Promise<R>) =>
      async (...args: A): Promise<R> => {
        try {
          return await fn(...args);
        } catch (err) {
          const message =
            err instanceof ApiError
              ? err.status === 401
                ? "Your session expired — sign in again."
                : err.message
              : "Something went wrong. Please try again.";
          onErrorRef.current?.(message, err);
          throw err;
        }
      },
    [],
  );

  const value = useMemo<StoreContextValue>(
    () => ({
      ...data,
      loading,
      error,
      lastSyncedAt,
      refresh,
      setHostelFocus,
      placeOrder: mutate(async (input) => {
        const order = await api.placeOrder(input);
        await refresh();
        return order;
      }),
      closeSlot: mutate(async (slotId) => {
        await api.closeSlot(slotId);
        await refresh();
      }),
      dispatchSlot: mutate(async (slotId) => {
        await api.dispatchSlot(slotId);
        await refresh();
      }),
      markDelivered: mutate(async (orderId) => {
        await api.markDelivered(orderId);
        await refresh();
      }),
      restockItem: mutate(async (_vendorId, menuItemId, amount) => {
        await api.restockItem(menuItemId, amount);
        await refresh();
      }),
      setItemPrice: mutate(async (_vendorId, menuItemId, price) => {
        await api.updateItem(menuItemId, { price });
        await refresh();
      }),
      setItemBarcode: mutate(async (_vendorId, menuItemId, barcode) => {
        await api.updateItem(menuItemId, { barcode });
        await refresh();
      }),
      generateBarcode: mutate(async (menuItemId) => {
        const item = await api.generateBarcode(menuItemId);
        await refresh();
        return item.barcode ?? "";
      }),
      generateMissingBarcodes: mutate(async (vendorId) => {
        const result = await api.generateMissingBarcodes(vendorId);
        await refresh();
        return result.generated;
      }),
      adjustStock: mutate(async (menuItemId, input) => {
        await api.adjustStock(menuItemId, input);
        await refresh();
      }),
      updateVendorSettings: mutate(async (vendorId, patch) => {
        await api.updateVendor(vendorId, patch);
        await refresh();
      }),
      createMenuItem: mutate(async (vendorId, input) => {
        const item = await api.createMenuItem(vendorId, input);
        await refresh();
        return item;
      }),
    }),
    [data, loading, error, lastSyncedAt, refresh, setHostelFocus, mutate],
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
