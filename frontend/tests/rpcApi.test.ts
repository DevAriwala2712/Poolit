import assert from "node:assert/strict";
import test from "node:test";
import { ApiError } from "../packages/domain/src/errors.ts";
import { type RpcCaller, makeRpcApi, toApiError } from "../packages/domain/src/rpcApi.ts";

type Call = { fn: string; args?: Record<string, unknown> };

/** A stand-in for supabase.rpc that records calls and answers with `data` or `error`. */
function fakeRpc(answer: { data?: unknown; error?: { code?: string; message: string } }) {
  const calls: Call[] = [];
  const rpc: RpcCaller = async (fn, args) => {
    calls.push({ fn, args });
    return { data: answer.data ?? null, error: answer.error ?? null };
  };
  return { rpc, calls };
}

// ---- which function each call uses, and with what ----

test("lists hostels with no arguments and returns what the database sends", async () => {
  const { rpc, calls } = fakeRpc({ data: [{ id: "h1", name: "Ganga" }] });
  const result = await makeRpcApi(() => rpc).getHostels();
  assert.deepEqual(calls, [{ fn: "api_hostels", args: undefined }]);
  assert.deepEqual(result, [{ id: "h1", name: "Ganga" }]);
});

test("current pool for a hostel passes the hostel id", async () => {
  const { rpc, calls } = fakeRpc({ data: { slot: {}, vendor: {} } });
  await makeRpcApi(() => rpc).getCurrentSlot("H-1");
  assert.deepEqual(calls, [{ fn: "api_current_slot", args: { p_hostel_id: "H-1" } }]);
});

test("pool size and a single pool use their own functions", async () => {
  const { rpc, calls } = fakeRpc({ data: {} });
  const api = makeRpcApi(() => rpc);
  await api.getLiveFee("S-1");
  await api.getSlot("S-2");
  assert.deepEqual(calls, [
    { fn: "api_live_fee", args: { p_slot_id: "S-1" } },
    { fn: "api_slot", args: { p_slot_id: "S-2" } },
  ]);
});

test("placing an order sends every field under the function's parameter names", async () => {
  const { rpc, calls } = fakeRpc({ data: { id: "o1" } });
  await makeRpcApi(() => rpc).placeOrder({
    slotId: "S-1",
    studentName: "Anaya",
    items: [{ menuItemId: "m1", qty: 2 }],
    block: "A",
    room: "204",
    tip: 10,
    paymentMethod: "UPI",
    note: "ring twice",
  });
  assert.deepEqual(calls, [
    {
      fn: "api_place_order",
      args: {
        p_slot_id: "S-1",
        p_student_name: "Anaya",
        p_items: [{ menuItemId: "m1", qty: 2 }],
        p_block: "A",
        p_room: "204",
        p_tip: 10,
        p_payment_method: "UPI",
        p_note: "ring twice",
      },
    },
  ]);
});

test("optional order fields that were not given are sent as null, not undefined", async () => {
  const { rpc, calls } = fakeRpc({ data: {} });
  await makeRpcApi(() => rpc).placeOrder({ slotId: "S-1", studentName: "Anaya", items: [{ menuItemId: "m1", qty: 1 }] });
  const args = calls[0].args as Record<string, unknown>;
  for (const k of ["p_block", "p_room", "p_payment_method", "p_note"]) assert.equal(args[k], null, k);
  assert.equal(args.p_tip, 0);
});

test("profile calls map the student's fields", async () => {
  const { rpc, calls } = fakeRpc({ data: { userId: "u", phone: null, profile: null } });
  const api = makeRpcApi(() => rpc);
  await api.getMe();
  await api.updateMe({ name: "Anaya", hostelId: "H-1", block: "A", room: "204" });
  await api.updateMe({ name: "Anaya" });
  assert.deepEqual(calls, [
    { fn: "api_me", args: undefined },
    { fn: "api_update_me", args: { p_name: "Anaya", p_hostel_id: "H-1", p_block: "A", p_room: "204" } },
    { fn: "api_update_me", args: { p_name: "Anaya", p_hostel_id: null, p_block: null, p_room: null } },
  ]);
});

test("my orders and the student view each use one function", async () => {
  const { rpc, calls } = fakeRpc({ data: {} });
  const api = makeRpcApi(() => rpc);
  await api.getMyOrders();
  await api.getStudentView("H-1");
  await api.getStudentView(undefined);
  assert.deepEqual(calls, [
    { fn: "api_my_orders", args: undefined },
    { fn: "api_student_view", args: { p_hostel_id: "H-1" } },
    { fn: "api_student_view", args: { p_hostel_id: null } },
  ]);
});

// ---- failures ----

test("database errors keep their HTTP status and message", () => {
  const e = toApiError({ code: "PT409", message: "Insufficient stock for one or more items" });
  assert.ok(e instanceof ApiError);
  assert.equal(e.status, 409);
  assert.equal(e.message, "Insufficient stock for one or more items");
  assert.equal(toApiError({ code: "PT403", message: "x" }).status, 403);
  assert.equal(toApiError({ code: "PT404", message: "x" }).status, 404);
  assert.equal(toApiError({ code: "PT400", message: "x" }).status, 400);
});

test("'permission denied' from a signed-out caller becomes a 401", () => {
  const e = toApiError({ code: "42501", message: "permission denied for function api_me" });
  assert.equal(e.status, 401);
  assert.match(e.message, /sign in/i);
});

test("an expired login becomes a 401", () => {
  assert.equal(toApiError({ code: "PGRST303", message: "JWT expired" }).status, 401);
  assert.equal(toApiError({ message: "JWT expired" }).status, 401);
});

test("a bad id becomes a 400", () => {
  assert.equal(toApiError({ code: "22P02", message: "invalid input syntax for type uuid" }).status, 400);
});

test("no network becomes status 0 with a plain message", () => {
  const e = toApiError(new TypeError("Failed to fetch"));
  assert.equal(e.status, 0);
  assert.match(e.message, /connection|reach/i);
});

test("anything else is a 500 that still shows the message", () => {
  const e = toApiError({ code: "XX000", message: "boom" });
  assert.equal(e.status, 500);
  assert.equal(e.message, "boom");
});

test("a failing call rejects with an ApiError the app can handle", async () => {
  const { rpc } = fakeRpc({ error: { code: "PT409", message: 'Cannot place order: slot is "closed"' } });
  await assert.rejects(
    () => makeRpcApi(() => rpc).placeOrder({ slotId: "S", studentName: "A", items: [{ menuItemId: "m", qty: 1 }] }),
    (e: unknown) => e instanceof ApiError && e.status === 409 && /closed/.test(e.message),
  );
});

test("a caller that throws (offline) rejects with status 0", async () => {
  const rpc: RpcCaller = async () => {
    throw new TypeError("Failed to fetch");
  };
  await assert.rejects(() => makeRpcApi(() => rpc).getHostels(), (e: unknown) => e instanceof ApiError && e.status === 0);
});

test("using it before the app has registered its Supabase client is a clear error", async () => {
  await assert.rejects(() => makeRpcApi(() => null).getHostels(), /not (set up|configured)/i);
});

// ---- the vendor console ----

test("every vendor call uses its own function with the right argument names", async () => {
  const { rpc, calls } = fakeRpc({ data: {} });
  const api = makeRpcApi(() => rpc);
  const cases: [() => Promise<unknown>, string, Record<string, unknown> | undefined][] = [
    [() => api.getVendorOverview(7), "api_vendor_overview", { p_days: 7 }],
    [() => api.updateVendor("V", { acceptingOrders: false, prepMinutes: 8 }), "api_update_vendor", { p_vendor_id: "V", p_patch: { acceptingOrders: false, prepMinutes: 8 } }],
    [() => api.createMenuItem("V", { name: "Cola", category: "Drinks", price: 45, unit: "750 ml", stockQty: 4 }), "api_create_menu_item", { p_vendor_id: "V", p_input: { name: "Cola", category: "Drinks", price: 45, unit: "750 ml", stockQty: 4 } }],
    [() => api.getStaff("V"), "api_staff", { p_vendor_id: "V" }],
    [() => api.createStaff("V", { name: "Ravi", role: "Packer", email: "r@x.com" }), "api_create_staff", { p_vendor_id: "V", p_name: "Ravi", p_role: "Packer", p_email: "r@x.com" }],
    [() => api.createStaff("V", { name: "Sita", role: "Cook" }), "api_create_staff", { p_vendor_id: "V", p_name: "Sita", p_role: "Cook", p_email: null }],
    [() => api.updateStaff("S", { status: "break" }), "api_update_staff", { p_staff_id: "S", p_patch: { status: "break" } }],
    [() => api.deleteStaff("S"), "api_delete_staff", { p_staff_id: "S" }],
    [() => api.getVendorOrders("V", "delivered"), "api_vendor_orders", { p_vendor_id: "V", p_status: "delivered" }],
    [() => api.getVendorOrders("V"), "api_vendor_orders", { p_vendor_id: "V", p_status: null }],
    [() => api.getSlotOrders("P"), "api_slot_orders", { p_slot_id: "P" }],
    [() => api.getPickList("P"), "api_pick_list", { p_slot_id: "P" }],
    [() => api.closeSlot("P"), "api_close_slot", { p_slot_id: "P" }],
    [() => api.dispatchSlot("P"), "api_dispatch_slot", { p_slot_id: "P" }],
    [() => api.markDelivered("O"), "api_mark_delivered", { p_order_id: "O" }],
    [() => api.getInventory({ vendorId: "V", status: "low" }), "api_inventory", { p_vendor_id: "V", p_status: "low" }],
    [() => api.getInventory(), "api_inventory", { p_vendor_id: null, p_status: null }],
    [() => api.restockItem("M", 25), "api_restock_item", { p_item_id: "M", p_amount: 25 }],
    [() => api.updateItem("M", { price: 60, lowStockThreshold: 3, barcode: null }), "api_update_menu_item", { p_item_id: "M", p_patch: { price: 60, lowStockThreshold: 3, barcode: null } }],
    [() => api.generateBarcode("M"), "api_generate_barcode", { p_item_id: "M" }],
    [() => api.generateMissingBarcodes("V"), "api_generate_missing_barcodes", { p_vendor_id: "V" }],
    [() => api.adjustStock("M", { mode: "remove", qty: 2, reason: "damaged", note: "dropped" }), "api_adjust_stock", { p_item_id: "M", p_mode: "remove", p_qty: 2, p_reason: "damaged", p_note: "dropped" }],
    [() => api.adjustStock("M", { mode: "set", qty: 40 }), "api_adjust_stock", { p_item_id: "M", p_mode: "set", p_qty: 40, p_reason: null, p_note: null }],
    [() => api.getStockHistory("M"), "api_stock_history", { p_item_id: "M" }],
    [() => api.getRestockLog("M"), "api_restock_log", { p_item_id: "M" }],
  ];
  for (const [call] of cases) await call();
  assert.deepEqual(
    calls.map((c) => ({ fn: c.fn, args: c.args })),
    cases.map(([, fn, args]) => ({ fn, args })),
  );
});

test("a vendor call refused for a non-vendor surfaces as a 403 with the store's message", async () => {
  const { rpc } = fakeRpc({ error: { code: "PT403", message: "This account isn't a vendor account" } });
  await assert.rejects(
    () => makeRpcApi(() => rpc).getVendorOverview(7),
    (e: unknown) => e instanceof ApiError && e.status === 403 && /isn't a vendor/.test(e.message),
  );
});
