import { SLOT_DURATION_MINUTES } from "./constants";
import type { Hostel, MenuCategory, MenuItem, Order, Slot, Vendor } from "./types";

export const hostels: Hostel[] = [
  { id: "h1", name: "Ganga Hostel", blocks: ["Block A", "Block B", "Block C"] },
  { id: "h2", name: "Yamuna Hostel", blocks: ["Block A", "Block B"] },
  { id: "h3", name: "Godavari Hostel", blocks: ["Block A", "Block B", "Block C", "Block D"] },
  { id: "h4", name: "Narmada Hostel", blocks: ["Block A", "Block B"] },
  { id: "h5", name: "Kaveri Hostel", blocks: ["Block A", "Block B", "Block C"] },
];

interface CatalogEntry {
  name: string;
  category: MenuCategory;
  unit: string;
  price: number;
  mrp?: number;
  isVeg: boolean;
  art: string;
  tint: string;
  rating: number;
  ratingCount: number;
}

/** Master catalog — each store carries a rotating subset of this. */
const CATALOG: CatalogEntry[] = [
  // Snacks
  { name: "Lay's Magic Masala", category: "Snacks", unit: "52 g pack", price: 20, isVeg: true, art: "🥔", tint: "#FFF1D6", rating: 4.4, ratingCount: 1820 },
  { name: "Kurkure Masala Munch", category: "Snacks", unit: "75 g pack", price: 20, isVeg: true, art: "🌽", tint: "#FFE9D6", rating: 4.3, ratingCount: 1240 },
  { name: "Dark Fantasy Choco Fills", category: "Snacks", unit: "75 g pack", price: 40, mrp: 45, isVeg: true, art: "🍪", tint: "#F0E4DA", rating: 4.7, ratingCount: 2960 },
  { name: "Oreo Original", category: "Snacks", unit: "120 g pack", price: 35, isVeg: true, art: "🍪", tint: "#E8E6F2", rating: 4.6, ratingCount: 2110 },
  { name: "Haldiram Aloo Bhujia", category: "Snacks", unit: "200 g pack", price: 55, mrp: 60, isVeg: true, art: "🥨", tint: "#FFEDD2", rating: 4.5, ratingCount: 980 },
  { name: "Good Day Cashew", category: "Snacks", unit: "100 g pack", price: 30, isVeg: true, art: "🍪", tint: "#FFF3D9", rating: 4.4, ratingCount: 760 },

  // Instant Food
  { name: "Maggi 2-Minute Noodles", category: "Instant Food", unit: "Pack of 4", price: 56, mrp: 60, isVeg: true, art: "🍜", tint: "#FFE7CC", rating: 4.8, ratingCount: 5410 },
  { name: "Yippee Magic Masala", category: "Instant Food", unit: "Pack of 4", price: 52, isVeg: true, art: "🍜", tint: "#FFEFD1", rating: 4.4, ratingCount: 1320 },
  { name: "Knorr Sweet Corn Soup", category: "Instant Food", unit: "44 g sachet", price: 55, isVeg: true, art: "🥣", tint: "#F1F4DC", rating: 4.2, ratingCount: 540 },
  { name: "Ching's Manchow Noodles", category: "Instant Food", unit: "240 g pack", price: 60, isVeg: true, art: "🍲", tint: "#FFE3DC", rating: 4.3, ratingCount: 870 },
  { name: "Cup Noodles Masala", category: "Instant Food", unit: "70 g cup", price: 45, isVeg: true, art: "🥡", tint: "#FFEAD8", rating: 4.1, ratingCount: 620 },
  { name: "MTR Ready Poha", category: "Instant Food", unit: "160 g box", price: 70, isVeg: true, art: "🍚", tint: "#F6F0E0", rating: 4.0, ratingCount: 310 },

  // Drinks
  { name: "Coca-Cola", category: "Drinks", unit: "750 ml bottle", price: 45, isVeg: true, art: "🥤", tint: "#FBDCDC", rating: 4.6, ratingCount: 3300 },
  { name: "Red Bull Energy", category: "Drinks", unit: "250 ml can", price: 125, isVeg: true, art: "⚡", tint: "#DCE7F5", rating: 4.5, ratingCount: 1450 },
  { name: "Amul Kool Kesar", category: "Drinks", unit: "200 ml pack", price: 25, isVeg: true, art: "🥛", tint: "#FFF0D4", rating: 4.3, ratingCount: 690 },
  { name: "Real Mixed Fruit Juice", category: "Drinks", unit: "1 L pack", price: 110, mrp: 125, isVeg: true, art: "🧃", tint: "#FFE6D0", rating: 4.4, ratingCount: 820 },
  { name: "Nescafé Classic Sachet", category: "Drinks", unit: "Pack of 10", price: 60, isVeg: true, art: "☕", tint: "#EDE0D4", rating: 4.5, ratingCount: 1130 },
  { name: "Sting Energy Drink", category: "Drinks", unit: "250 ml can", price: 20, isVeg: true, art: "🥤", tint: "#FFDCDC", rating: 4.2, ratingCount: 2040 },

  // Essentials
  { name: "Colgate Strong Teeth", category: "Essentials", unit: "100 g tube", price: 55, isVeg: true, art: "🪥", tint: "#DDEBF7", rating: 4.6, ratingCount: 1560 },
  { name: "Surf Excel Easy Wash", category: "Essentials", unit: "500 g pack", price: 65, mrp: 72, isVeg: true, art: "🧺", tint: "#DFEAF6", rating: 4.4, ratingCount: 940 },
  { name: "Dettol Original Soap", category: "Essentials", unit: "Pack of 3", price: 96, isVeg: true, art: "🧼", tint: "#E1EEE6", rating: 4.5, ratingCount: 1210 },
  { name: "Origami Tissue Roll", category: "Essentials", unit: "Pack of 4", price: 80, isVeg: true, art: "🧻", tint: "#F1EDE6", rating: 4.2, ratingCount: 430 },
  { name: "Classmate Notebook", category: "Essentials", unit: "180 pages", price: 65, isVeg: true, art: "📓", tint: "#E6E9F5", rating: 4.5, ratingCount: 1890 },
  { name: "Cello Gel Pen Set", category: "Essentials", unit: "Pack of 5", price: 50, isVeg: true, art: "🖊️", tint: "#E9E6F2", rating: 4.3, ratingCount: 720 },

  // Fresh
  { name: "Amul Taaza Milk", category: "Fresh", unit: "500 ml pack", price: 28, isVeg: true, art: "🥛", tint: "#EAF2FA", rating: 4.7, ratingCount: 4120 },
  { name: "Farm Eggs", category: "Fresh", unit: "Tray of 6", price: 48, isVeg: false, art: "🥚", tint: "#FBF0DC", rating: 4.5, ratingCount: 1670 },
  { name: "Britannia Brown Bread", category: "Fresh", unit: "400 g loaf", price: 45, isVeg: true, art: "🍞", tint: "#F4E7D6", rating: 4.3, ratingCount: 980 },
  { name: "Fresh Bananas", category: "Fresh", unit: "6 pieces", price: 40, isVeg: true, art: "🍌", tint: "#FFF6D0", rating: 4.2, ratingCount: 640 },
  { name: "Amul Masti Curd", category: "Fresh", unit: "400 g cup", price: 35, isVeg: true, art: "🍶", tint: "#F0F5FA", rating: 4.4, ratingCount: 1050 },
  { name: "Amul Butter", category: "Fresh", unit: "100 g pack", price: 58, isVeg: true, art: "🧈", tint: "#FFF3D2", rating: 4.8, ratingCount: 2280 },

  // Midnight Cravings
  { name: "Cadbury Dairy Milk Silk", category: "Midnight Cravings", unit: "150 g bar", price: 175, mrp: 190, isVeg: true, art: "🍫", tint: "#E9DDE8", rating: 4.8, ratingCount: 3640 },
  { name: "Amul Chocolate Ice Cream", category: "Midnight Cravings", unit: "700 ml tub", price: 190, isVeg: true, art: "🍨", tint: "#EFE2DC", rating: 4.6, ratingCount: 1420 },
  { name: "Chocolate Brownie", category: "Midnight Cravings", unit: "2 pieces", price: 90, isVeg: true, art: "🍰", tint: "#EADFD6", rating: 4.7, ratingCount: 890 },
  { name: "Cold Coffee Tetra", category: "Midnight Cravings", unit: "180 ml pack", price: 45, isVeg: true, art: "🧋", tint: "#EDE1D6", rating: 4.4, ratingCount: 1180 },
  { name: "Late-Night Chips Combo", category: "Midnight Cravings", unit: "3 packs", price: 55, mrp: 60, isVeg: true, art: "🍿", tint: "#FFF0DA", rating: 4.5, ratingCount: 760 },
  { name: "Instant Hot Chocolate", category: "Midnight Cravings", unit: "200 g jar", price: 145, isVeg: true, art: "🍫", tint: "#E8DCD4", rating: 4.3, ratingCount: 520 },
];

interface StoreSeed {
  id: string;
  name: string;
  hostelId: string;
  prepMinutes: number;
  /** Index into CATALOG to start this store's rotating subset. */
  offset: number;
  size: number;
}

const STORES: StoreSeed[] = [
  { id: "v1", name: "Campus Mart", hostelId: "h1", prepMinutes: 6, offset: 0, size: 24 },
  { id: "v2", name: "Night Owl Store", hostelId: "h2", prepMinutes: 8, offset: 6, size: 22 },
  { id: "v3", name: "Hostel Daily Needs", hostelId: "h3", prepMinutes: 5, offset: 12, size: 24 },
  { id: "v4", name: "QuickBite Corner", hostelId: "h4", prepMinutes: 7, offset: 18, size: 20 },
  { id: "v5", name: "The Tuck Shop", hostelId: "h5", prepMinutes: 6, offset: 24, size: 22 },
];

/** Deterministic stock so the demo looks the same on every load. */
function stockFor(storeIndex: number, itemIndex: number): number {
  const seed = (storeIndex * 37 + itemIndex * 17) % 100;
  if (seed < 8) return 0;
  if (seed < 22) return 3 + (seed % 8);
  return 18 + (seed % 60);
}

function buildMenu(store: StoreSeed, storeIndex: number): MenuItem[] {
  return Array.from({ length: store.size }, (_, i) => {
    const entry = CATALOG[(store.offset + i) % CATALOG.length];
    const priceDrift = ((storeIndex + i) % 3) - 1;
    return {
      id: `${store.id}-m${i + 1}`,
      vendorId: store.id,
      name: entry.name,
      category: entry.category,
      unit: entry.unit,
      price: Math.max(10, entry.price + priceDrift * 2),
      mrp: entry.mrp ? entry.mrp + priceDrift * 2 : undefined,
      stockQty: stockFor(storeIndex, i),
      lowStockThreshold: 12,
      rating: entry.rating,
      ratingCount: entry.ratingCount,
      isVeg: entry.isVeg,
      art: entry.art,
      tint: entry.tint,
    };
  });
}

export const vendors: Vendor[] = STORES.map((store, i) => ({
  id: store.id,
  name: store.name,
  hostelId: store.hostelId,
  prepMinutes: store.prepMinutes,
  menu: buildMenu(store, i),
}));

const now = Date.now();
const slotMs = SLOT_DURATION_MINUTES * 60 * 1000;

export const initialSlots: Slot[] = [
  { id: "s1", hostelId: "h1", vendorId: "v1", status: "open", opensAt: now, closesAt: now + slotMs },
  { id: "s2", hostelId: "h2", vendorId: "v2", status: "open", opensAt: now, closesAt: now + slotMs - 90_000 },
  { id: "s3", hostelId: "h3", vendorId: "v3", status: "open", opensAt: now, closesAt: now + slotMs - 210_000 },
  { id: "s4", hostelId: "h4", vendorId: "v4", status: "open", opensAt: now, closesAt: now + slotMs + 60_000 },
  { id: "s5", hostelId: "h5", vendorId: "v5", status: "open", opensAt: now, closesAt: now + slotMs - 30_000 },
  { id: "s1-h", hostelId: "h1", vendorId: "v1", status: "dispatched", opensAt: now - 20 * 3600_000, closesAt: now - 20 * 3600_000 + slotMs },
  { id: "s2-h", hostelId: "h2", vendorId: "v2", status: "dispatched", opensAt: now - 19 * 3600_000, closesAt: now - 19 * 3600_000 + slotMs },
  { id: "s3-h", hostelId: "h3", vendorId: "v3", status: "dispatched", opensAt: now - 26 * 3600_000, closesAt: now - 26 * 3600_000 + slotMs },
  { id: "s5-h", hostelId: "h5", vendorId: "v5", status: "dispatched", opensAt: now - 44 * 3600_000, closesAt: now - 44 * 3600_000 + slotMs },
];

const STUDENT_NAMES = [
  "Riya Sharma", "Kabir Nair", "Aarav Mehta", "Diya Patel", "Ishaan Rao",
  "Meera Iyer", "Vihaan Gupta", "Ananya Bose", "Rohan Desai", "Sana Khan",
  "Arjun Reddy", "Priya Menon", "Zoya Ahmed", "Kiran Joshi", "Nisha Verma",
  "Yash Malhotra", "Tanvi Shah", "Dev Kulkarni", "Aisha Siddiqui", "Manav Sinha",
];

let orderCounter = 0;

function ordersForSlot(
  slot: Slot,
  vendor: Vendor,
  count: number,
  status: Order["status"],
  lockedFee?: number,
): Order[] {
  const inStock = vendor.menu.filter((m) => m.stockQty > 0);
  const hostel = hostels.find((h) => h.id === slot.hostelId);
  return Array.from({ length: count }, (_, i) => {
    orderCounter += 1;
    const lineCount = 1 + ((i * 3) % 3);
    const items = Array.from({ length: lineCount }, (_, j) => ({
      menuItemId: inStock[(i * 5 + j * 11) % inStock.length].id,
      qty: 1 + ((i + j) % 2),
    }));
    return {
      id: `o-seed-${orderCounter}`,
      slotId: slot.id,
      studentName: STUDENT_NAMES[(i * 7 + slot.id.length) % STUDENT_NAMES.length],
      block: hostel?.blocks[i % hostel.blocks.length],
      room: String(201 + ((i * 13) % 120)),
      items,
      status,
      deliveryFeeCharged: lockedFee,
      createdAt: slot.opensAt + i * 45_000,
    };
  });
}

function vendorOf(slot: Slot): Vendor {
  return vendors.find((v) => v.id === slot.vendorId)!;
}

const liveCounts: Record<string, number> = { s1: 6, s2: 3, s3: 9, s4: 1, s5: 4 };
const historyCounts: Record<string, { count: number; fee: number }> = {
  "s1-h": { count: 8, fee: 5 },
  "s2-h": { count: 4, fee: 10 },
  "s3-h": { count: 12, fee: 0 },
  "s5-h": { count: 6, fee: 5 },
};

export const initialOrders: Order[] = initialSlots.flatMap((slot) => {
  if (slot.status === "open") {
    return ordersForSlot(slot, vendorOf(slot), liveCounts[slot.id] ?? 0, "placed");
  }
  const hist = historyCounts[slot.id];
  if (!hist) return [];
  return ordersForSlot(slot, vendorOf(slot), hist.count, "delivered", hist.fee);
});

export const rider = {
  name: "Suresh Kumar",
  phone: "+91 98765 43210",
  vehicle: "Campus e-cycle · CY-14",
  rating: 4.8,
};
