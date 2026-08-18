/**
 * Seed script for Poolit
 * Run: npm run seed
 */
require("dotenv").config();

// Debug: Check if MONGO_URI is loaded
console.log('🌱 Starting seed script...');
console.log('📁 Current directory:', process.cwd());
console.log('🔍 MONGO_URI:', process.env.MONGO_URI ? '✅ Found' : '❌ Not found');
if (process.env.MONGO_URI) {
  console.log('📊 Database:', process.env.MONGO_URI.split('/').pop().split('?')[0] || 'default');
}
console.log('---');

// Check if MONGO_URI exists
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is not defined in environment variables');
  console.error('📁 Please check if .env file exists in:', process.cwd());
  console.error('📄 Make sure .env file contains: MONGO_URI=your_connection_string');
  process.exit(1);
}

const mongoose = require("mongoose");
const connectDB = require("./config/db");

const Hostel = require("./models/Hostel");
const Vendor = require("./models/Vendor");
const MenuItem = require("./models/MenuItem");
const Slot = require("./models/Slot");
const Order = require("./models/Order");
const RestockLog = require("./models/RestockLog");

const SLOT_DURATION_MINUTES = Number(process.env.SLOT_DURATION_MINUTES) || 10;

const hostelNames = [
  "Ganga Hostel",
  "Yamuna Hostel",
  "Narmada Hostel",
  "Kaveri Hostel",
  "Godavari Hostel",
];

const vendorNames = [
  "Amma's Kitchen",
  "Hostel Bites",
  "Spice Route",
  "Campus Curry",
  "Tiffin Box",
];

const sampleMenu = [
  { name: "Veg Thali", category: "Mains", price: 80, unit: "plate", stockQty: 40, lowStockThreshold: 8 },
  { name: "Chicken Biryani", category: "Mains", price: 120, unit: "plate", stockQty: 25, lowStockThreshold: 5 },
  { name: "Paneer Butter Masala + Rice", category: "Mains", price: 100, unit: "plate", stockQty: 30, lowStockThreshold: 6 },
  { name: "Dal Fry + Roti (2)", category: "Mains", price: 60, unit: "plate", stockQty: 50, lowStockThreshold: 10 },
  { name: "Samosa (2 pcs)", category: "Snacks", price: 30, unit: "plate", stockQty: 60, lowStockThreshold: 12 },
  { name: "Vada Pav", category: "Snacks", price: 25, unit: "piece", stockQty: 45, lowStockThreshold: 10 },
  { name: "Maggi", category: "Snacks", price: 40, unit: "bowl", stockQty: 35, lowStockThreshold: 8 },
  { name: "French Fries", category: "Snacks", price: 50, unit: "plate", stockQty: 20, lowStockThreshold: 5 },
  { name: "Masala Chai", category: "Beverages", price: 15, unit: "cup", stockQty: 100, lowStockThreshold: 20 },
  { name: "Cold Coffee", category: "Beverages", price: 40, unit: "cup", stockQty: 40, lowStockThreshold: 8 },
  { name: "Lassi", category: "Beverages", price: 35, unit: "glass", stockQty: 30, lowStockThreshold: 6 },
  { name: "Gulab Jamun (2)", category: "Desserts", price: 40, unit: "plate", stockQty: 25, lowStockThreshold: 5 },
  { name: "Ice Cream Cup", category: "Desserts", price: 50, unit: "cup", stockQty: 15, lowStockThreshold: 4 },
];

async function seed() {
  try {
    console.log('🔄 Connecting to MongoDB...');
    await connectDB();

    console.log("🗑️ Clearing existing data...");
    await Promise.all([
      Hostel.deleteMany({}),
      Vendor.deleteMany({}),
      MenuItem.deleteMany({}),
      Slot.deleteMany({}),
      Order.deleteMany({}),
      RestockLog.deleteMany({}),
    ]);
    console.log("✅ Existing data cleared");

    console.log("🏗️ Creating hostels & vendors...");
    const hostels = [];
    const vendors = [];

    for (let i = 0; i < hostelNames.length; i++) {
      console.log(`  📍 Creating ${hostelNames[i]}...`);
      
      const hostel = await Hostel.create({ name: hostelNames[i] });
      hostels.push(hostel);

      const vendor = await Vendor.create({
        name: vendorNames[i],
        hostelId: hostel._id,
      });
      vendors.push(vendor);

      const menuDocs = sampleMenu.map((item, idx) => ({
        ...item,
        vendorId: vendor._id,
        stockQty:
          idx === 7 ? 3 :
          idx === 12 ? 0 :
          item.stockQty + Math.floor(Math.random() * 10) - 5,
      }));
      menuDocs.forEach((m) => {
        if (m.stockQty < 0) m.stockQty = 0;
      });

      await MenuItem.insertMany(menuDocs);
      console.log(`  ✅ Created ${menuDocs.length} menu items for ${vendorNames[i]}`);
    }

    console.log("⏰ Creating slots & sample orders...");
    const now = Date.now();
    const durationMs = SLOT_DURATION_MINUTES * 60 * 1000;

    // Open slots for first 3 hostels
    console.log("  📋 Creating open slots...");
    for (let i = 0; i < 3; i++) {
      const opensAt = new Date(now - 2 * 60 * 1000);
      const closesAt = new Date(opensAt.getTime() + durationMs);

      const slot = await Slot.create({
        hostelId: hostels[i]._id,
        vendorId: vendors[i]._id,
        status: "open",
        opensAt,
        closesAt,
      });

      const menuItems = await MenuItem.find({ vendorId: vendors[i]._id }).limit(4);
      if (menuItems.length >= 2) {
        await Order.create([
          {
            slotId: slot._id,
            studentName: "Aarav Sharma",
            items: [
              { menuItemId: menuItems[0]._id, qty: 1 },
              { menuItemId: menuItems[1]._id, qty: 2 },
            ],
            status: "placed",
            createdAt: new Date(now - 90 * 1000),
          },
          {
            slotId: slot._id,
            studentName: "Priya Patel",
            items: [{ menuItemId: menuItems[0]._id, qty: 1 }],
            status: "placed",
            createdAt: new Date(now - 60 * 1000),
          },
        ]);
        console.log(`  ✅ Created 2 orders for ${hostelNames[i]}`);
      }
    }

    // One closed slot
    console.log("  📋 Creating closed slot...");
    {
      const opensAt = new Date(now - 40 * 60 * 1000);
      const closesAt = new Date(opensAt.getTime() + durationMs);
      const slot = await Slot.create({
        hostelId: hostels[3]._id,
        vendorId: vendors[3]._id,
        status: "closed",
        opensAt,
        closesAt,
      });

      const menuItems = await MenuItem.find({ vendorId: vendors[3]._id }).limit(3);
      if (menuItems.length >= 2) {
        await Order.create([
          {
            slotId: slot._id,
            studentName: "Rohan Gupta",
            items: [{ menuItemId: menuItems[0]._id, qty: 2 }],
            status: "pooled",
            deliveryFeeCharged: 10,
            createdAt: new Date(opensAt.getTime() + 5 * 60 * 1000),
          },
          {
            slotId: slot._id,
            studentName: "Sneha Reddy",
            items: [
              { menuItemId: menuItems[1]._id, qty: 1 },
              { menuItemId: menuItems[2]._id, qty: 1 },
            ],
            status: "pooled",
            deliveryFeeCharged: 10,
            createdAt: new Date(opensAt.getTime() + 8 * 60 * 1000),
          },
          {
            slotId: slot._id,
            studentName: "Vikram Singh",
            items: [{ menuItemId: menuItems[0]._id, qty: 1 }],
            status: "pooled",
            deliveryFeeCharged: 10,
            createdAt: new Date(opensAt.getTime() + 12 * 60 * 1000),
          },
        ]);
        console.log(`  ✅ Created 3 orders for closed slot`);
      }
    }

    // One dispatched slot
    console.log("  📋 Creating dispatched slot...");
    {
      const opensAt = new Date(now - 90 * 60 * 1000);
      const closesAt = new Date(opensAt.getTime() + durationMs);
      const slot = await Slot.create({
        hostelId: hostels[4]._id,
        vendorId: vendors[4]._id,
        status: "dispatched",
        opensAt,
        closesAt,
      });

      const menuItems = await MenuItem.find({ vendorId: vendors[4]._id }).limit(2);
      if (menuItems.length >= 1) {
        await Order.create([
          {
            slotId: slot._id,
            studentName: "Ananya Joshi",
            items: [{ menuItemId: menuItems[0]._id, qty: 1 }],
            status: "dispatched",
            deliveryFeeCharged: 20,
            createdAt: new Date(opensAt.getTime() + 3 * 60 * 1000),
          },
          {
            slotId: slot._id,
            studentName: "Karan Mehta",
            items: [{ menuItemId: menuItems[0]._id, qty: 2 }],
            status: "delivered",
            deliveryFeeCharged: 20,
            createdAt: new Date(opensAt.getTime() + 6 * 60 * 1000),
          },
        ]);
        console.log(`  ✅ Created 2 orders for dispatched slot`);
      }
    }

    console.log("\n✅ Seed completed successfully!");
    console.log(`   📊 Summary:`);
    console.log(`   🏨 Hostels : ${hostels.length}`);
    console.log(`   🏪 Vendors : ${vendors.length}`);
    console.log(`   🍽️ Menu items per vendor ≈ ${sampleMenu.length}`);
    console.log(`   ⏰ Open slots : 3`);
    console.log(`   ⏰ Closed / Dispatched slots : 2`);
    console.log(`   📝 Total orders created: ~13`);

    await mongoose.connection.close();
    console.log("🔌 Database connection closed");
    process.exit(0);
  } catch (error) {
    console.error("❌ Seed failed:", error.message);
    console.error("💡 Error details:", error.stack);
    
    // Close connection if open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
      console.log("🔌 Database connection closed");
    }
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Run the seed
seed();