import type { Hostel, MenuItem, Order, OrderLineItem, PickListLine, RestockLogEntry, Slot, Vendor } from "./types";

/**
 * Base URL of the Poolit backend (see `backend/`).
 * Override per app with VITE_API_URL in a .env file.
 */
export const API_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      headers: { "Content-Type": "application/json" },
      ...init,
    });
  } catch {
    throw new ApiError(0, `Can't reach the Poolit API at ${API_URL}. Is the backend running?`);
  }

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { message?: string };
      if (body.message) message = body.message;
    } catch {
      // non-JSON error body — keep the generic message
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export interface PlaceOrderInput {
  slotId: string;
  studentName: string;
  items: OrderLineItem[];
  block?: string;
  room?: string;
  tip?: number;
  paymentMethod?: string;
  note?: string;
}

export const api = {
  getHostels: () => request<Hostel[]>("/hostels"),

  getCurrentSlot: (hostelId: string) =>
    request<{ slot: Slot; vendor: Vendor }>(`/hostels/${hostelId}/current-slot`),

  getVendors: () => request<Vendor[]>("/vendors"),

  getVendor: (vendorId: string) => request<Vendor>(`/vendors/${vendorId}`),

  getVendorOrders: (vendorId: string, status?: string) =>
    request<Order[]>(`/vendors/${vendorId}/orders${status ? `?status=${status}` : ""}`),

  getSlot: (slotId: string) => request<Slot>(`/slots/${slotId}`),

  getSlotOrders: (slotId: string) => request<Order[]>(`/slots/${slotId}/orders`),

  getPickList: (slotId: string) => request<PickListLine[]>(`/slots/${slotId}/pick-list`),

  getLiveFee: (slotId: string) =>
    request<{ orderCount: number; fee: number }>(`/slots/${slotId}/live-fee`),

  placeOrder: ({ slotId, ...body }: PlaceOrderInput) =>
    request<Order>(`/slots/${slotId}/orders`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  closeSlot: (slotId: string) =>
    request<{ slot: Slot }>(`/slots/${slotId}/close`, { method: "POST" }),

  dispatchSlot: (slotId: string) =>
    request<{ slot: Slot }>(`/slots/${slotId}/dispatch`, { method: "POST" }),

  markDelivered: (orderId: string) =>
    request<{ order: Order }>(`/orders/${orderId}/deliver`, { method: "POST" }),

  getInventory: (params: { vendorId?: string; status?: "low" | "out" } = {}) => {
    const q = new URLSearchParams();
    if (params.vendorId) q.set("vendorId", params.vendorId);
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<MenuItem[]>(`/inventory${qs ? `?${qs}` : ""}`);
  },

  restockItem: (menuItemId: string, amount: number) =>
    request<{ item: MenuItem; restockLog: RestockLogEntry }>(
      `/menu-items/${menuItemId}/restock`,
      { method: "POST", body: JSON.stringify({ amount }) },
    ),

  updateItem: (menuItemId: string, patch: { price?: number; lowStockThreshold?: number }) =>
    request<MenuItem>(`/menu-items/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  getRestockLog: (menuItemId: string) =>
    request<RestockLogEntry[]>(`/menu-items/${menuItemId}/restock-log`),
};
