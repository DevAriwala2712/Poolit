import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { api, ApiError } from "./api";
import type { PlaceOrderInput } from "./api";
import type { Hostel, MenuItem, Order, PickListLine, Slot, Vendor } from "./types";

/**
 * Live application state, backed by the Poolit API (see `backend/`).
 *
 * Reads are polled so both apps stay in step: a vendor closing a pool shows up
 * on the student's tracking screen, and a student's order shows up in the
 * vendor's live feed, without either side reloading.
 */

const POLL_INTERVAL_MS = 5000;

interface StoreData {
  hostels: Hostel[];
  vendors: Vendor[];
  slots: Slot[];
  orders: Order[];
}

const EMPTY: StoreData = { hostels: [], vendors: [], slots: [], orders: [] };

interface StoreContextValue extends StoreData {
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  placeOrder: (input: PlaceOrderInput) => Promise<Order>;
  closeSlot: (slotId: string) => Promise<void>;
  dispatchSlot: (slotId: string) => Promise<void>;
  markDelivered: (orderId: string) => Promise<void>;
  restockItem: (vendorId: string, menuItemId: string, amount: number) => Promise<void>;
  setItemPrice: (vendorId: string, menuItemId: string, price: number) => Promise<void>;
}

const StoreContext = createContext<StoreContextValue | null>(null);

/** Pull the whole world in one pass. The dataset is small enough to refetch. */
async function fetchAll(): Promise<StoreData> {
  const [hostels, vendors] = await Promise.all([api.getHostels(), api.getVendors()]);

  // Every slot for every vendor, plus that vendor's orders.
  const perVendor = await Promise.all(
    vendors.map(async (vendor) => {
      const orders = await api.getVendorOrders(vendor.id);
      const slotIds = Array.from(new Set(orders.map((o) => o.slotId)));

      // The current slot per hostel is guaranteed; older slots come from orders.
      let current: Slot | null = null;
      try {
        current = (await api.getCurrentSlot(vendor.hostelId)).slot;
      } catch {
        current = null;
      }

      const extraIds = slotIds.filter((id) => id !== current?.id);
      const extras = await Promise.all(
        extraIds.map((id) => api.getSlot(id).catch(() => null)),
      );

      const slots = [current, ...extras].filter((s): s is Slot => s !== null);
      return { slots, orders };
    }),
  );

  const slots = perVendor.flatMap((v) => v.slots);
  const orders = perVendor.flatMap((v) => v.orders);

  // De-dupe slots that appear via more than one path.
  const bySlotId = new Map(slots.map((s) => [s.id, s]));

  return { hostels, vendors, slots: Array.from(bySlotId.values()), orders };
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<StoreData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      const next = await fetchAll();
      setData(next);
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong loading Poolit.");
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  const value = useMemo<StoreContextValue>(
    () => ({
      ...data,
      loading,
      error,
      refresh,
      placeOrder: async (input) => {
        const order = await api.placeOrder(input);
        await refresh();
        return order;
      },
      closeSlot: async (slotId) => {
        await api.closeSlot(slotId);
        await refresh();
      },
      dispatchSlot: async (slotId) => {
        await api.dispatchSlot(slotId);
        await refresh();
      },
      markDelivered: async (orderId) => {
        await api.markDelivered(orderId);
        await refresh();
      },
      restockItem: async (_vendorId, menuItemId, amount) => {
        await api.restockItem(menuItemId, amount);
        await refresh();
      },
      setItemPrice: async (_vendorId, menuItemId, price) => {
        await api.updateItem(menuItemId, { price });
        await refresh();
      },
    }),
    [data, loading, error, refresh],
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
