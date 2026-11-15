const { z } = require("zod");

const id = z.string().trim().min(1).max(64);
const optText = (max) => z.string().trim().max(max).nullish();
const whole = (min, max) => z.number().int().min(min).max(max);

const placeOrderBody = z.object({
  studentName: z.string().trim().min(1, "is required").max(60),
  items: z
    .array(z.object({ menuItemId: id, qty: whole(1, 100) }))
    .min(1, "must have at least one item")
    .max(50, "can have at most 50 lines"),
  block: optText(40),
  room: optText(20),
  tip: z.number().min(0).max(1000).optional(),
  paymentMethod: optText(30),
  note: optText(500),
});

const restockBody = z.object({ amount: whole(1, 10_000) });

const adjustBody = z
  .object({
    mode: z.enum(["set", "remove"]),
    qty: whole(0, 100_000),
    reason: z.enum(["count", "damaged", "expired", "correction", "other"]).optional(),
    note: z.string().max(140).nullish(),
  })
  .refine((b) => b.mode !== "remove" || b.qty >= 1, { path: ["qty"], message: "must be at least 1 to remove" });

const updateMeBody = z.object({
  name: z.string().trim().min(1, "is required").max(60),
  hostelId: id.nullish(),
  block: optText(40),
  room: optText(20),
});

const createItemBody = z.object({
  name: z.string().trim().min(1, "is required").max(120),
  category: z.string().trim().min(1).max(40),
  price: z.number().positive().max(100_000),
  unit: z.string().trim().min(1, "is required").max(30),
  stockQty: whole(0, 1_000_000).optional(),
  lowStockThreshold: whole(0, 1_000_000).optional(),
  isVeg: z.boolean().optional(),
  art: z.string().max(200).nullish(),
  tint: z.string().max(40).nullish(),
});

module.exports = { placeOrderBody, restockBody, adjustBody, updateMeBody, createItemBody };

// ---- remaining write routes ----
const updateVendorBody = z
  .object({
    acceptingOrders: z.boolean().optional(),
    prepMinutes: whole(1, 240).optional(),
    poolWindowMinutes: whole(3, 60).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" });

const createStaffBody = z.object({
  name: z.string().trim().min(1, "is required").max(80),
  role: z.string().trim().min(1, "is required").max(40),
  email: z.string().trim().email().max(200).nullish().or(z.literal("")),
});

const updateStaffBody = z
  .object({
    name: z.string().trim().min(1).max(80).optional(),
    role: z.string().trim().min(1).max(40).optional(),
    status: z.enum(["active", "break", "inactive"]).optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" });

const updateItemBody = z
  .object({
    price: z.number().positive().max(100_000).optional(),
    lowStockThreshold: whole(0, 1_000_000).optional(),
    barcode: z.string().trim().min(1).max(64).nullable().optional(),
  })
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update" });

const inviteMemberBody = z.object({
  email: z.string().trim().toLowerCase().email().max(200),
  role: z.enum(["owner", "staff"]).default("staff"),
});

const updateMemberBody = z.object({ role: z.enum(["owner", "staff"]) });

const revenueQuery = z.object({
  days: z.coerce.number().int().min(1).max(92).default(30),
});

Object.assign(module.exports, {
  updateVendorBody, createStaffBody, updateStaffBody, updateItemBody,
  inviteMemberBody, updateMemberBody, revenueQuery,
});
