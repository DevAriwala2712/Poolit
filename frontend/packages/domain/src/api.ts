import { ApiError } from "./errors.ts";
import { type RpcCaller, makeRpcApi } from "./rpcApi.ts";
import type { Hostel, MenuItem, Order, OrderLineItem, PickListLine, RestockLogEntry, Slot, StaffMember, Vendor } from "./types";

/**
 * Base URL of the Poolit backend (see `backend/`).
 * Override per app with VITE_API_URL in a .env file.
 */
export const API_URL: string =
  (import.meta.env?.VITE_API_URL as string | undefined)?.replace(/\/$/, "") ??
  "http://localhost:5057";

export { ApiError };

/**
 * Which backend answers the app's data calls. "express" is the old API
 * (VITE_API_URL); "supabase" calls the database's api_* functions directly
 * (the app must register its client with setRpcCaller). Defaults to "express"
 * so nothing changes until a build opts in with VITE_BACKEND=supabase.
 */
export type Backend = "express" | "supabase";
export const BACKEND: Backend = import.meta.env?.VITE_BACKEND === "supabase" ? "supabase" : "express";

let rpcCaller: RpcCaller | null = null;
/** Called once at startup by an app running with VITE_BACKEND=supabase. */
export function setRpcCaller(fn: RpcCaller) {
  rpcCaller = fn;
}

/**
 * Optional hook so an app (the vendor console) can attach an auth token to
 * every request. The student app never sets this — its endpoints stay public.
 */
type AuthTokenProvider = () => Promise<string | null | undefined> | string | null | undefined;
let getAuthToken: AuthTokenProvider = () => null;
export function setAuthTokenProvider(fn: AuthTokenProvider) {
  getAuthToken = fn;
}

/** True when a signed-in session token is available for API calls. */
export async function hasAuthToken(): Promise<boolean> {
  return Boolean(await getAuthToken());
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    const token = await getAuthToken();
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (token) headers.Authorization = `Bearer ${token}`;

    res = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: { ...headers, ...init?.headers },
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

/** What the student app shows: catalogue, the student's hostel pool and size, their own orders. */
export interface StudentView {
  hostels: Hostel[];
  vendors: Vendor[];
  slots: Slot[];
  /** Only the signed-in student's own orders. */
  orders: Order[];
  /** Orders in each open pool, for everyone (a count, never names). */
  poolCounts: Record<string, number>;
  /** The hostel the view was built for (the Supabase backend; absent on Express). */
  hostelId?: string;
}

/** A store's cash for one day (all amounts in paise). */
export interface CashSummary {
  day: string;
  deliveredCount: number;
  expectedPaise: number;
  collectedPaise: number;
  /** Collected minus expected: negative means the store is short. */
  differencePaise: number;
  outstandingCount: number;
  outstandingPaise: number;
  outstanding: { orderId: string; studentName: string; block?: string; room?: string; amountDuePaise?: number }[];
}

/** What Poolit's commission came to for a store over a date range (paise). */
export interface FeeStatement {
  vendorId: string;
  from: string;
  to: string;
  terms: { feeType: "percent" | "fixed_per_order"; feeValue: number } | null;
  orders: number;
  goodsPaise: number;
  commissionPaise: number;
}

/** Everything Poolit holds about a signed-in student (api_export_my_data). */
export interface MyDataExport {
  exportedAt: string;
  account: { userId: string; phone?: string; email?: string };
  profile: { name: string; hostelId?: string; block?: string; room?: string; createdAt?: string } | null;
  consents: { version: string; ageConfirmed: boolean; acceptedAt: string }[];
  orders: Order[];
}

/** One kind of crash reported by the apps, with how often it happened. */
export interface ClientErrorEntry {
  app: "student" | "vendor";
  message: string;
  stack?: string;
  page?: string;
  userAgent?: string;
  firstAt: number;
  lastAt: number;
  occurrences: number;
}

/** One line of the activity log (api_audit_log); personal fields appear as "***". */
export interface AuditEntry {
  id: number;
  at: number;
  actor?: string;
  actorEmail?: string;
  actorRole?: string;
  table: string;
  op: "INSERT" | "UPDATE" | "DELETE";
  rowId?: string;
  old?: Record<string, unknown>;
  new?: Record<string, unknown>;
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
  /** One random key per intended order, reused on retries (see idempotency.ts). */
  idempotencyKey?: string;
}

export type StockAdjustmentReason = "count" | "damaged" | "expired" | "correction" | "other";

export interface StockAdjustmentInput {
  mode: "set" | "remove";
  qty: number;
  reason?: StockAdjustmentReason;
  note?: string;
  /** Optional key that makes a repeat of this adjustment harmless. */
  idempotencyKey?: string;
}

export interface StockHistoryEntry {
  id: string;
  kind: "restock" | StockAdjustmentReason;
  delta: number;
  previousQty?: number;
  newQty?: number;
  note?: string;
  at: number;
}

export interface StudentProfile {
  name: string;
  hostelId?: string;
  block?: string;
  room?: string;
}

export interface MeResponse {
  userId: string;
  phone: string | null;
  profile: StudentProfile | null;
}

const expressApi = {
  /** Signed-in student (phone OTP). */
  getMe: () => request<MeResponse>("/me"),

  updateMe: (profile: StudentProfile) =>
    request<MeResponse>("/me", { method: "PUT", body: JSON.stringify(profile) }),

  /** Vendor console: the signed-in vendor's stores, recent pools and their orders, in one call. */
  getVendorOverview: (days = 7) =>
    request<{ hostels: Hostel[]; vendors: Vendor[]; slots: Slot[]; orders: Order[]; days: number }>(
      `/vendor/overview?days=${days}`,
    ),

  /** Only the caller's own orders (and the slots they belong to). */
  getMyOrders: () => request<{ orders: Order[]; slots: Slot[] }>("/me/orders"),

  /**
   * The old way: every hostel's pool and size, one request each, on every poll.
   * Kept so the Express backend behaves exactly as before.
   */
  getStudentView: async (_hostelId?: string): Promise<StudentView> => {
    const [hostels, vendors] = await Promise.all([expressApi.getHostels(), expressApi.getVendors()]);
    const hostelIds = Array.from(new Set(vendors.map((v) => v.hostelId)));
    const current = await Promise.all(
      hostelIds.map((id) => expressApi.getCurrentSlot(id).then((r) => r.slot).catch(() => null)),
    );
    const openSlots = current.filter((sl): sl is Slot => sl !== null);
    const counts = await Promise.all(
      openSlots.map((sl) =>
        expressApi.getLiveFee(sl.id).then((r) => [sl.id, r.orderCount] as const).catch(() => null),
      ),
    );
    const poolCounts: Record<string, number> = {};
    for (const entry of counts) if (entry) poolCounts[entry[0]] = entry[1];

    let orders: Order[] = [];
    let mySlots: Slot[] = [];
    if (await hasAuthToken()) {
      const mine = await expressApi.getMyOrders();
      orders = mine.orders;
      mySlots = mine.slots;
    }
    const bySlotId = new Map([...mySlots, ...openSlots].map((sl) => [sl.id, sl]));
    return { hostels, vendors, slots: Array.from(bySlotId.values()), orders, poolCounts };
  },

  getHostels: () => request<Hostel[]>("/hostels"),

  getCurrentSlot: (hostelId: string) =>
    request<{ slot: Slot; vendor: Vendor }>(`/hostels/${hostelId}/current-slot`),

  getVendors: () => request<Vendor[]>("/vendors"),

  getVendor: (vendorId: string) => request<Vendor>(`/vendors/${vendorId}`),

  updateVendor: (vendorId: string, patch: { acceptingOrders?: boolean; prepMinutes?: number; poolWindowMinutes?: number }) =>
    request<Vendor>(`/vendors/${vendorId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

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
  ) =>
    request<MenuItem>(`/vendors/${vendorId}/menu-items`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  getStaff: (vendorId: string) => request<StaffMember[]>(`/vendors/${vendorId}/staff`),

  createStaff: (vendorId: string, input: { name: string; role: string; email?: string }) =>
    request<StaffMember>(`/vendors/${vendorId}/staff`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  updateStaff: (staffId: string, patch: { name?: string; role?: string; status?: string }) =>
    request<StaffMember>(`/staff/${staffId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  deleteStaff: (staffId: string) =>
    request<{ message: string }>(`/staff/${staffId}`, { method: "DELETE" }),

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

  /** Hand an order over. For cash on delivery, `cashCollectedPaise` is the cash taken (default: the amount due). */
  markDelivered: (orderId: string, _cashCollectedPaise?: number) =>
    request<{ order: Order }>(`/orders/${orderId}/deliver`, { method: "POST" }),

  /** The store's cash for a day (default today). Only the Supabase backend has it. */
  getCashSummary: async (_vendorId: string, _day?: string): Promise<CashSummary> => {
    throw new ApiError(501, "The cash summary needs the new backend (VITE_BACKEND=supabase).");
  },

  /** Commission statement for a date range. Only the Supabase backend has it. */
  getFeeStatement: async (_vendorId: string, _from: string, _to: string): Promise<FeeStatement> => {
    throw new ApiError(501, "The commission statement needs the new backend (VITE_BACKEND=supabase).");
  },

  /** Cancel an order that is still waiting for its pool to close. Only the Supabase backend has it. */
  cancelOrder: async (_orderId: string): Promise<{ message: string; order: Order }> => {
    throw new ApiError(501, "Cancelling needs the new backend (VITE_BACKEND=supabase).");
  },

  /** Record that the student accepted this version of the Terms and Privacy Policy and is 18 or older. */
  recordConsent: async (_version: string, _ageConfirmed: boolean): Promise<{ version: string; acceptedAt: number }> => {
    throw new ApiError(501, "Consent records need the new backend (VITE_BACKEND=supabase).");
  },

  exportMyData: async (): Promise<MyDataExport> => {
    throw new ApiError(501, "Data download needs the new backend (VITE_BACKEND=supabase).");
  },

  /** Erase the account. `confirm` must be the word DELETE. */
  deleteMyAccount: async (_confirm: string): Promise<{ deleted: boolean }> => {
    throw new ApiError(501, "Account deletion needs the new backend (VITE_BACKEND=supabase).");
  },

  /** Poolit team only: set a store's commission ("percent" 0-50, or "fixed_per_order" rupees 0-100). */
  setFeeTerms: async (_vendorId: string, _feeType: "percent" | "fixed_per_order", _feeValue: number): Promise<{ vendorId: string; feeType: string; feeValue: number }> => {
    throw new ApiError(501, "Fee settings need the new backend (VITE_BACKEND=supabase).");
  },

  /** Tell Poolit about a crash in the app (see errorReporting.ts). Does nothing on the old backend. */
  reportError: async (_app: "student" | "vendor", _message: string, _stack?: string, _page?: string, _userAgent?: string): Promise<void> => {},

  /** Poolit team only: crash reports from the apps, newest first. */
  getClientErrors: async (_limit?: number): Promise<ClientErrorEntry[]> => {
    throw new ApiError(501, "Error reports need the new backend (VITE_BACKEND=supabase).");
  },

  /** Whether the signed-in user is on the Poolit team. */
  isAdmin: async (): Promise<boolean> => false,

  getAuditLog: async (_params?: { table?: string; rowId?: string; actor?: string; before?: number; limit?: number }): Promise<AuditEntry[]> => {
    throw new ApiError(501, "The activity log needs the new backend (VITE_BACKEND=supabase).");
  },

  getInventory: (params: { vendorId?: string; status?: "low" | "out" } = {}) => {
    const q = new URLSearchParams();
    if (params.vendorId) q.set("vendorId", params.vendorId);
    if (params.status) q.set("status", params.status);
    const qs = q.toString();
    return request<MenuItem[]>(`/inventory${qs ? `?${qs}` : ""}`);
  },

  restockItem: (menuItemId: string, amount: number, _idempotencyKey?: string) =>
    request<{ item: MenuItem; restockLog: RestockLogEntry }>(
      `/menu-items/${menuItemId}/restock`,
      { method: "POST", body: JSON.stringify({ amount }) },
    ),

  updateItem: (
    menuItemId: string,
    patch: { price?: number; lowStockThreshold?: number; barcode?: string | null },
  ) =>
    request<MenuItem>(`/menu-items/${menuItemId}`, {
      method: "PATCH",
      body: JSON.stringify(patch),
    }),

  /** Give an item its own in-store EAN-13 (idempotent). */
  generateBarcode: (menuItemId: string) =>
    request<MenuItem>(`/menu-items/${menuItemId}/barcode`, { method: "POST" }),

  /** Generate barcodes for every item in a store that has none. */
  generateMissingBarcodes: (vendorId: string) =>
    request<{ generated: number; items: MenuItem[] }>(`/vendors/${vendorId}/barcodes`, { method: "POST" }),

  /** Set an exact count ("set") or remove units ("remove"), with a reason. */
  adjustStock: (menuItemId: string, input: StockAdjustmentInput) =>
    request<{ item: MenuItem; adjustment: StockHistoryEntry }>(`/menu-items/${menuItemId}/adjust`, {
      method: "POST",
      body: JSON.stringify(input),
    }),

  /** Attach (or, with null, remove) a product picture. Only the Supabase backend has pictures. */
  setItemImage: async (_menuItemId: string, _path: string | null): Promise<MenuItem> => {
    throw new ApiError(501, "Product pictures need the new backend (VITE_BACKEND=supabase).");
  },

  getStockHistory: (menuItemId: string) => request<StockHistoryEntry[]>(`/menu-items/${menuItemId}/stock-history`),

  getRestockLog: (menuItemId: string) =>
    request<RestockLogEntry[]>(`/menu-items/${menuItemId}/restock-log`),
};

export type Api = typeof expressApi;

/** The app's data calls, answered by whichever backend VITE_BACKEND selected. */
export const api: Api = BACKEND === "supabase" ? makeRpcApi(() => rpcCaller) : expressApi;
