import { SLOT_DURATION_MINUTES } from "./constants";
import type { Hostel, MenuCategory, MenuItem, Order, Slot, Vendor } from "./types";

export const hostels: Hostel[] = [
  { id: "h1", name: "Ganga Hostel" },
  { id: "h2", name: "Yamuna Hostel" },
  { id: "h3", name: "Godavari Hostel" },
  { id: "h4", name: "Narmada Hostel" },
  { id: "h5", name: "Kaveri Hostel" },
];

interface MenuSeed {
  name: string;
  category: MenuCategory;
  price: number;
  unit: string;
  stockQty: number;
  lowStockThreshold?: number;
}

function buildMenu(vendorId: string, items: MenuSeed[]): MenuItem[] {
  return items.map((item, i) => ({
    id: `${vendorId}-m${i + 1}`,
    name: item.name,
    category: item.category,
    price: item.price,
    unit: item.unit,
    stockQty: item.stockQty,
    lowStockThreshold: item.lowStockThreshold ?? 15,
  }));
}

const initialVendors: Vendor[] = [
  {
    id: "v1",
    name: "Amma's Kitchen",
    hostelId: "h1",
    menu: buildMenu("v1", [
      { name: "Veg Thali", category: "Mains", price: 90, unit: "plate", stockQty: 45 },
      { name: "Chicken Biryani", category: "Mains", price: 130, unit: "plate", stockQty: 30 },
      { name: "Curd Rice", category: "Mains", price: 70, unit: "bowl", stockQty: 50 },
      { name: "Sambar Rice", category: "Mains", price: 65, unit: "bowl", stockQty: 40 },
      { name: "Masala Dosa", category: "Snacks", price: 60, unit: "plate", stockQty: 8 },
      { name: "Idli Sambar", category: "Snacks", price: 50, unit: "plate", stockQty: 60 },
      { name: "Paneer Roll", category: "Snacks", price: 75, unit: "piece", stockQty: 0 },
      { name: "Vada Pav", category: "Snacks", price: 35, unit: "piece", stockQty: 55 },
      { name: "Cold Coffee", category: "Beverages", price: 40, unit: "cup", stockQty: 25 },
      { name: "Filter Coffee", category: "Beverages", price: 25, unit: "cup", stockQty: 70 },
      { name: "Buttermilk", category: "Beverages", price: 20, unit: "glass", stockQty: 65 },
      { name: "Gulab Jamun", category: "Desserts", price: 30, unit: "bowl", stockQty: 12 },
      { name: "Payasam", category: "Desserts", price: 45, unit: "bowl", stockQty: 20 },
    ]),
  },
  {
    id: "v2",
    name: "Spice Route",
    hostelId: "h2",
    menu: buildMenu("v2", [
      { name: "Butter Chicken + Rice", category: "Mains", price: 140, unit: "plate", stockQty: 22 },
      { name: "Rajma Chawal", category: "Mains", price: 80, unit: "plate", stockQty: 48 },
      { name: "Chole Bhature", category: "Mains", price: 85, unit: "plate", stockQty: 35 },
      { name: "Dal Makhani + Rice", category: "Mains", price: 90, unit: "plate", stockQty: 40 },
      { name: "Chowmein", category: "Snacks", price: 70, unit: "plate", stockQty: 6 },
      { name: "Egg Roll", category: "Snacks", price: 55, unit: "piece", stockQty: 42 },
      { name: "Aloo Tikki", category: "Snacks", price: 45, unit: "plate", stockQty: 0 },
      { name: "Samosa (2pc)", category: "Snacks", price: 30, unit: "plate", stockQty: 60 },
      { name: "Lassi", category: "Beverages", price: 45, unit: "glass", stockQty: 30 },
      { name: "Masala Chai", category: "Beverages", price: 20, unit: "cup", stockQty: 75 },
      { name: "Nimbu Pani", category: "Beverages", price: 25, unit: "glass", stockQty: 50 },
      { name: "Gajar Halwa", category: "Desserts", price: 50, unit: "bowl", stockQty: 10 },
      { name: "Rasgulla", category: "Desserts", price: 35, unit: "bowl", stockQty: 28 },
    ]),
  },
  {
    id: "v3",
    name: "Tandoori Nights",
    hostelId: "h3",
    menu: buildMenu("v3", [
      { name: "Tandoori Chicken (Half)", category: "Mains", price: 160, unit: "plate", stockQty: 18 },
      { name: "Paneer Tikka Masala + Rice", category: "Mains", price: 110, unit: "plate", stockQty: 33 },
      { name: "Veg Biryani", category: "Mains", price: 95, unit: "plate", stockQty: 45 },
      { name: "Dal Tadka + Roti", category: "Mains", price: 70, unit: "plate", stockQty: 50 },
      { name: "Chicken 65", category: "Snacks", price: 65, unit: "plate", stockQty: 40 },
      { name: "Spring Rolls", category: "Snacks", price: 55, unit: "plate", stockQty: 5 },
      { name: "Onion Pakora", category: "Snacks", price: 40, unit: "plate", stockQty: 0 },
      { name: "Bread Pakora", category: "Snacks", price: 35, unit: "piece", stockQty: 38 },
      { name: "Sweet Lassi", category: "Beverages", price: 45, unit: "glass", stockQty: 26 },
      { name: "Cold Drink (Can)", category: "Beverages", price: 40, unit: "can", stockQty: 60 },
      { name: "Jaljeera", category: "Beverages", price: 25, unit: "glass", stockQty: 33 },
      { name: "Kheer", category: "Desserts", price: 45, unit: "bowl", stockQty: 14 },
      { name: "Ice Cream Cup", category: "Desserts", price: 35, unit: "cup", stockQty: 40 },
    ]),
  },
  {
    id: "v4",
    name: "Curry Leaf Cafe",
    hostelId: "h4",
    menu: buildMenu("v4", [
      { name: "Kerala Fish Curry + Rice", category: "Mains", price: 150, unit: "plate", stockQty: 15 },
      { name: "Veg Kurma + Appam", category: "Mains", price: 95, unit: "plate", stockQty: 30 },
      { name: "Chicken Chettinad + Rice", category: "Mains", price: 135, unit: "plate", stockQty: 20 },
      { name: "Lemon Rice", category: "Mains", price: 60, unit: "bowl", stockQty: 55 },
      { name: "Banana Chips", category: "Snacks", price: 30, unit: "packet", stockQty: 70 },
      { name: "Bonda", category: "Snacks", price: 35, unit: "piece", stockQty: 9 },
      { name: "Uttapam", category: "Snacks", price: 65, unit: "plate", stockQty: 0 },
      { name: "Medu Vada", category: "Snacks", price: 40, unit: "plate", stockQty: 45 },
      { name: "Filter Coffee", category: "Beverages", price: 25, unit: "cup", stockQty: 62 },
      { name: "Tender Coconut Water", category: "Beverages", price: 40, unit: "piece", stockQty: 20 },
      { name: "Rose Milk", category: "Beverages", price: 35, unit: "glass", stockQty: 27 },
      { name: "Payasam", category: "Desserts", price: 45, unit: "bowl", stockQty: 11 },
      { name: "Halwa", category: "Desserts", price: 40, unit: "bowl", stockQty: 25 },
    ]),
  },
  {
    id: "v5",
    name: "Street Food Co",
    hostelId: "h5",
    menu: buildMenu("v5", [
      { name: "Pav Bhaji", category: "Mains", price: 75, unit: "plate", stockQty: 40 },
      { name: "Chole Kulche", category: "Mains", price: 70, unit: "plate", stockQty: 35 },
      { name: "Veg Fried Rice + Manchurian", category: "Mains", price: 90, unit: "plate", stockQty: 28 },
      { name: "Egg Curry + Rice", category: "Mains", price: 85, unit: "plate", stockQty: 33 },
      { name: "Vada Pav", category: "Snacks", price: 30, unit: "piece", stockQty: 7 },
      { name: "Bhel Puri", category: "Snacks", price: 40, unit: "plate", stockQty: 50 },
      { name: "Pani Puri", category: "Snacks", price: 45, unit: "plate", stockQty: 0 },
      { name: "Dabeli", category: "Snacks", price: 40, unit: "piece", stockQty: 44 },
      { name: "Sugarcane Juice", category: "Beverages", price: 35, unit: "glass", stockQty: 24 },
      { name: "Masala Soda", category: "Beverages", price: 30, unit: "glass", stockQty: 58 },
      { name: "Iced Tea", category: "Beverages", price: 35, unit: "glass", stockQty: 40 },
      { name: "Falooda", category: "Desserts", price: 60, unit: "glass", stockQty: 13 },
      { name: "Kulfi", category: "Desserts", price: 40, unit: "stick", stockQty: 30 },
    ]),
  },
];

export { initialVendors as vendors };

const now = Date.now();
const slotMs = SLOT_DURATION_MINUTES * 60 * 1000;

// Staggered closing times so the dashboard doesn't look artificially synced.
export const initialSlots: Slot[] = [
  { id: "s1", hostelId: "h1", vendorId: "v1", status: "open", opensAt: now, closesAt: now + slotMs },
  { id: "s2", hostelId: "h2", vendorId: "v2", status: "open", opensAt: now, closesAt: now + slotMs - 90_000 },
  { id: "s3", hostelId: "h3", vendorId: "v3", status: "open", opensAt: now, closesAt: now + slotMs - 210_000 },
  { id: "s4", hostelId: "h4", vendorId: "v4", status: "open", opensAt: now, closesAt: now + slotMs + 60_000 },
  { id: "s5", hostelId: "h5", vendorId: "v5", status: "open", opensAt: now, closesAt: now + slotMs - 30_000 },
  // Yesterday's dinner slots, already wrapped up — gives the vendor dashboard order history.
  {
    id: "s1-hist1",
    hostelId: "h1",
    vendorId: "v1",
    status: "dispatched",
    opensAt: now - 20 * 60 * 60 * 1000,
    closesAt: now - 20 * 60 * 60 * 1000 + slotMs,
  },
  {
    id: "s2-hist1",
    hostelId: "h2",
    vendorId: "v2",
    status: "dispatched",
    opensAt: now - 19 * 60 * 60 * 1000,
    closesAt: now - 19 * 60 * 60 * 1000 + slotMs,
  },
  {
    id: "s3-hist1",
    hostelId: "h3",
    vendorId: "v3",
    status: "dispatched",
    opensAt: now - 44 * 60 * 60 * 1000,
    closesAt: now - 44 * 60 * 60 * 1000 + slotMs,
  },
];

const STUDENT_NAMES = [
  "Riya", "Kabir", "Aarav", "Diya", "Ishaan", "Meera", "Vihaan", "Ananya",
  "Rohan", "Sana", "Arjun", "Priya", "Zoya", "Kiran", "Nisha", "Yash",
  "Tanvi", "Dev", "Aisha", "Manav",
];

let seedOrderCounter = 0;
function makeOrder(
  slotId: string,
  studentName: string,
  items: { menuItemId: string; qty: number }[],
  status: Order["status"],
  createdAt: number,
  deliveryFeeCharged?: number,
): Order {
  seedOrderCounter += 1;
  return {
    id: `o-seed-${seedOrderCounter}`,
    slotId,
    studentName,
    items,
    status,
    deliveryFeeCharged,
    createdAt,
  };
}

function randomOrdersFor(
  slotId: string,
  vendor: Vendor,
  count: number,
  createdAt: number,
  status: Order["status"],
  feeIfLocked?: number,
): Order[] {
  const inStockItems = vendor.menu.filter((m) => m.stockQty > 0);
  return Array.from({ length: count }, (_, i) => {
    const name = STUDENT_NAMES[(i * 7 + slotId.length) % STUDENT_NAMES.length];
    const numItems = 1 + ((i * 3) % 2);
    const items = Array.from({ length: numItems }, (_, j) => {
      const item = inStockItems[(i * 5 + j * 11) % inStockItems.length];
      return { menuItemId: item.id, qty: 1 + ((i + j) % 2) };
    });
    return makeOrder(slotId, name, items, status, createdAt, feeIfLocked);
  });
}

const v1 = initialVendors.find((v) => v.id === "v1")!;
const v2 = initialVendors.find((v) => v.id === "v2")!;
const v3 = initialVendors.find((v) => v.id === "v3")!;
const v4 = initialVendors.find((v) => v.id === "v4")!;
const v5 = initialVendors.find((v) => v.id === "v5")!;

export const initialOrders: Order[] = [
  // Live pools — enough orders that the fee ladder already shows movement.
  ...randomOrdersFor("s1", v1, 6, now, "placed"),
  ...randomOrdersFor("s2", v2, 3, now, "placed"),
  ...randomOrdersFor("s3", v3, 9, now, "placed"),
  ...randomOrdersFor("s4", v4, 1, now, "placed"),
  ...randomOrdersFor("s5", v5, 4, now, "placed"),
  // Yesterday's history, fully wrapped up.
  ...randomOrdersFor("s1-hist1", v1, 8, now - 20 * 60 * 60 * 1000, "delivered", 5),
  ...randomOrdersFor("s2-hist1", v2, 4, now - 19 * 60 * 60 * 1000, "delivered", 10),
  ...randomOrdersFor("s3-hist1", v3, 12, now - 44 * 60 * 60 * 1000, "delivered", 0),
];
