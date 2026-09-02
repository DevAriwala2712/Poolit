/**
 * Seed script for Poolit
 * Run: npm run seed
 *
 * Mirrors frontend/packages/domain/src/seed.ts so the API serves the same
 * demo data the UI was designed against.
 */
require("dotenv").config();

console.log("🌱 Starting seed script...");
console.log("📁 Current directory:", process.cwd());
console.log("🔍 SUPABASE_URL:", process.env.SUPABASE_URL ? "✅ Found" : "❌ Not found");
console.log("---");

const supabase = require("./config/supabaseClient");

const NIL_UUID = "00000000-0000-0000-0000-000000000000";
const SLOT_DURATION_MINUTES = Number(process.env.SLOT_DURATION_MINUTES) || 10;

/* ------------------------------------------------------------------ data */

const HOSTELS = [
  { name: "Ganga Hostel", blocks: ["Block A", "Block B", "Block C"] },
  { name: "Yamuna Hostel", blocks: ["Block A", "Block B"] },
  { name: "Godavari Hostel", blocks: ["Block A", "Block B", "Block C", "Block D"] },
  { name: "Narmada Hostel", blocks: ["Block A", "Block B"] },
  { name: "Kaveri Hostel", blocks: ["Block A", "Block B", "Block C"] },
];

const STORES = [
  { name: "Campus Mart", prepMinutes: 6, offset: 0, size: 24 },
  { name: "Night Owl Store", prepMinutes: 8, offset: 6, size: 22 },
  { name: "Hostel Daily Needs", prepMinutes: 5, offset: 12, size: 24 },
  { name: "QuickBite Corner", prepMinutes: 7, offset: 18, size: 20 },
  { name: "The Tuck Shop", prepMinutes: 6, offset: 24, size: 22 },
];

/** Master catalog — each store carries a rotating subset. */
const CATALOG = [
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

const STUDENT_NAMES = [
  "Riya Sharma", "Kabir Nair", "Aarav Mehta", "Diya Patel", "Ishaan Rao",
  "Meera Iyer", "Vihaan Gupta", "Ananya Bose", "Rohan Desai", "Sana Khan",
  "Arjun Reddy", "Priya Menon", "Zoya Ahmed", "Kiran Joshi", "Nisha Verma",
  "Yash Malhotra", "Tanvi Shah", "Dev Kulkarni", "Aisha Siddiqui", "Manav Sinha",
];

/** Deterministic stock so the demo looks the same on every seed. */
function stockFor(storeIndex, itemIndex) {
  const seed = (storeIndex * 37 + itemIndex * 17) % 100;
  if (seed < 8) return 0;
  if (seed < 22) return 3 + (seed % 8);
  return 18 + (seed % 60);
}

async function insertAndReturn(table, rows) {
  const { data, error } = await supabase.from(table).insert(rows).select();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data;
}

/* ------------------------------------------------------------------ seed */

async function seed() {
  try {
    console.log("🗑️  Clearing existing tables...");
    for (const table of ["restock_logs", "orders", "menu_items", "slots", "vendors", "hostels"]) {
      const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
      if (error) throw new Error(`clear ${table}: ${error.message}`);
    }

    // Hostels
    const hostels = await insertAndReturn(
      "hostels",
      HOSTELS.map((h) => ({ name: h.name, blocks: h.blocks }))
    );
    console.log(`🏨 Created ${hostels.length} hostels`);

    // Vendors — one per hostel
    const vendors = await insertAndReturn(
      "vendors",
      STORES.map((store, i) => ({
        name: store.name,
        hostel_id: hostels[i].id,
        prep_minutes: store.prepMinutes,
      }))
    );
    console.log(`🏪 Created ${vendors.length} vendors`);

    // Menu items — rotating slice of the catalog per store
    const menuRows = [];
    STORES.forEach((store, storeIndex) => {
      for (let i = 0; i < store.size; i++) {
        const entry = CATALOG[(store.offset + i) % CATALOG.length];
        const priceDrift = ((storeIndex + i) % 3) - 1;
        menuRows.push({
          vendor_id: vendors[storeIndex].id,
          name: entry.name,
          category: entry.category,
          unit: entry.unit,
          price: Math.max(10, entry.price + priceDrift * 2),
          mrp: entry.mrp ? entry.mrp + priceDrift * 2 : null,
          stock_qty: stockFor(storeIndex, i),
          low_stock_threshold: 12,
          rating: entry.rating,
          rating_count: entry.ratingCount,
          is_veg: entry.isVeg,
          art: entry.art,
          tint: entry.tint,
        });
      }
    });
    const menuItems = await insertAndReturn("menu_items", menuRows);
    console.log(`🍽️  Created ${menuItems.length} menu items`);

    const menuByVendor = new Map();
    menuItems.forEach((item) => {
      if (!menuByVendor.has(item.vendor_id)) menuByVendor.set(item.vendor_id, []);
      menuByVendor.get(item.vendor_id).push(item);
    });

    // Slots — one live pool per hostel, plus a few dispatched runs for history
    const now = Date.now();
    const slotMs = SLOT_DURATION_MINUTES * 60 * 1000;
    const liveOffsets = [0, -90_000, -210_000, 60_000, -30_000];

    const liveSlots = await insertAndReturn(
      "slots",
      hostels.map((hostel, i) => ({
        hostel_id: hostel.id,
        vendor_id: vendors[i].id,
        status: "open",
        opens_at: new Date(now).toISOString(),
        closes_at: new Date(now + slotMs + liveOffsets[i]).toISOString(),
      }))
    );

    const historySpecs = [
      { index: 0, hoursAgo: 20, orders: 8, fee: 5 },
      { index: 1, hoursAgo: 19, orders: 4, fee: 10 },
      { index: 2, hoursAgo: 26, orders: 12, fee: 0 },
      { index: 4, hoursAgo: 44, orders: 6, fee: 5 },
    ];

    const historySlots = await insertAndReturn(
      "slots",
      historySpecs.map((spec) => ({
        hostel_id: hostels[spec.index].id,
        vendor_id: vendors[spec.index].id,
        status: "dispatched",
        opens_at: new Date(now - spec.hoursAgo * 3_600_000).toISOString(),
        closes_at: new Date(now - spec.hoursAgo * 3_600_000 + slotMs).toISOString(),
      }))
    );
    console.log(`⏰ Created ${liveSlots.length} open slots and ${historySlots.length} dispatched slots`);

    // Orders
    function buildOrders(slot, hostel, vendorId, count, status, fee) {
      const menu = (menuByVendor.get(vendorId) || []).filter((m) => m.stock_qty > 0);
      if (menu.length === 0) return [];
      const slotOpensAtMs = new Date(slot.opens_at).getTime();
      return Array.from({ length: count }, (_, i) => {
        const lineCount = 1 + ((i * 3) % 3);
        const items = Array.from({ length: lineCount }, (_, j) => ({
          menuItemId: menu[(i * 5 + j * 11) % menu.length].id,
          qty: 1 + ((i + j) % 2),
        }));
        return {
          slot_id: slot.id,
          student_name: STUDENT_NAMES[(i * 7 + count) % STUDENT_NAMES.length],
          block: hostel.blocks[i % hostel.blocks.length],
          room: String(201 + ((i * 13) % 120)),
          items,
          status,
          delivery_fee_charged: fee ?? null,
          created_at: new Date(slotOpensAtMs + i * 45_000).toISOString(),
        };
      });
    }

    const liveCounts = [6, 3, 9, 1, 4];
    const orderRows = [];

    liveSlots.forEach((slot, i) => {
      orderRows.push(
        ...buildOrders(slot, hostels[i], vendors[i].id, liveCounts[i], "placed", undefined)
      );
    });

    historySlots.forEach((slot, i) => {
      const spec = historySpecs[i];
      orderRows.push(
        ...buildOrders(slot, hostels[spec.index], vendors[spec.index].id, spec.orders, "delivered", spec.fee)
      );
    });

    const orders = orderRows.length > 0 ? await insertAndReturn("orders", orderRows) : [];
    console.log(`📝 Created ${orders.length} orders`);

    console.log("\n✅ Seed completed successfully!");
    console.log("   📊 Summary:");
    console.log(`   🏨 Hostels    : ${hostels.length}`);
    console.log(`   🏪 Vendors    : ${vendors.length}`);
    console.log(`   🍽️  Menu items : ${menuItems.length}`);
    console.log(`   ⏰ Open slots : ${liveSlots.length}`);
    console.log(`   ⏰ Dispatched : ${historySlots.length}`);
    console.log(`   📝 Orders     : ${orders.length}`);

    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    console.error("💡 Error details:", error.stack);
    process.exit(1);
  }
}

process.on("unhandledRejection", (err) => {
  console.error("❌ Unhandled Rejection:", err);
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  console.error("❌ Uncaught Exception:", err);
  process.exit(1);
});

seed();
