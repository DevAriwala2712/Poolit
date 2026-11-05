/**
 * The app's data calls, answered by the database's `api_*` functions through
 * Supabase (see supabase/migrations/20261104122329_api_functions.sql) instead
 * of the Express backend. Same method names and return shapes as `api` in
 * api.ts, so screens do not change; the choice is made by VITE_BACKEND.
 *
 * The Supabase client belongs to each app (its own login storage), so the app
 * hands in a `rpc` caller instead of this package depending on the client.
 *
 * Only the student app's calls are switched so far; the vendor console's
 * calls refuse with a 501 until it is.
 */
import { ApiError } from "./errors.ts";
import type { Api, PlaceOrderInput, StudentProfile } from "./api.ts";

export type RpcError = { code?: string; message: string; name?: string };
export type RpcCaller = (
  fn: string,
  args?: Record<string, unknown>,
) => Promise<{ data: unknown; error: RpcError | null }>;

/** Turns whatever went wrong into the ApiError the screens already handle. */
export function toApiError(e: unknown): ApiError {
  if (e instanceof ApiError) return e;
  const err = (e ?? {}) as { code?: string; message?: string };
  const message = typeof err.message === "string" ? err.message : "";

  // The database reports failures as SQLSTATE PT<http status> (401, 403, 404, 409, 400).
  const pt = /^PT(\d{3})$/.exec(err.code ?? "");
  if (pt) return new ApiError(Number(pt[1]), message);

  // "permission denied for function": a signed-out visitor called a signed-in function.
  if (err.code === "42501") return new ApiError(401, "Sign in to continue.");
  if (err.code === "PGRST301" || err.code === "PGRST303" || /jwt/i.test(message)) {
    return new ApiError(401, "Your session expired — sign in again.");
  }
  if (err.code === "22P02") return new ApiError(400, "That request was not valid.");
  if (e instanceof TypeError || /failed to fetch|fetch failed|load failed|network/i.test(message)) {
    return new ApiError(0, "Can't reach Poolit. Check your connection and try again.");
  }
  return new ApiError(500, message || "Something went wrong.");
}

export function makeRpcApi(getRpc: () => RpcCaller | null): Api {
  async function call<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
    const rpc = getRpc();
    if (!rpc) throw new ApiError(0, "The app is not configured to reach Poolit (the backend client is not set up).");
    let res: Awaited<ReturnType<RpcCaller>>;
    try {
      res = await rpc(fn, args);
    } catch (e) {
      throw toApiError(e);
    }
    if (res.error) throw toApiError(res.error);
    return res.data as T;
  }

  const notYet = async (): Promise<never> => {
    throw new ApiError(501, "This part of the app has not been switched to the new backend yet.");
  };

  return {
    // ---- student ----
    getMe: () => call("api_me"),
    updateMe: (p: StudentProfile) =>
      call("api_update_me", {
        p_name: p.name,
        p_hostel_id: p.hostelId ?? null,
        p_block: p.block ?? null,
        p_room: p.room ?? null,
      }),
    getMyOrders: () => call("api_my_orders"),
    getHostels: () => call("api_hostels"),
    getVendors: () => call("api_vendors"),
    getVendor: (vendorId: string) => call("api_vendor", { p_vendor_id: vendorId }),
    getCurrentSlot: (hostelId: string) => call("api_current_slot", { p_hostel_id: hostelId }),
    getSlot: (slotId: string) => call("api_slot", { p_slot_id: slotId }),
    getLiveFee: (slotId: string) => call("api_live_fee", { p_slot_id: slotId }),
    placeOrder: ({ slotId, ...o }: PlaceOrderInput) =>
      call("api_place_order", {
        p_slot_id: slotId,
        p_student_name: o.studentName,
        p_items: o.items,
        p_block: o.block ?? null,
        p_room: o.room ?? null,
        p_tip: o.tip ?? 0,
        p_payment_method: o.paymentMethod ?? null,
        p_note: o.note ?? null,
      }),
    getStudentView: (hostelId?: string) => call("api_student_view", { p_hostel_id: hostelId ?? null }),

    // ---- vendor console: not switched yet ----
    getVendorOverview: notYet,
    getRevenue: notYet,
    updateVendor: notYet,
    createMenuItem: notYet,
    getStaff: notYet,
    createStaff: notYet,
    updateStaff: notYet,
    deleteStaff: notYet,
    getVendorOrders: notYet,
    getSlotOrders: notYet,
    getPickList: notYet,
    closeSlot: notYet,
    dispatchSlot: notYet,
    markDelivered: notYet,
    getInventory: notYet,
    restockItem: notYet,
    updateItem: notYet,
    generateBarcode: notYet,
    generateMissingBarcodes: notYet,
    adjustStock: notYet,
    getStockHistory: notYet,
    getRestockLog: notYet,
  };
}
