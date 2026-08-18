// server.js
// Load environment variables FIRST
require('dotenv').config();

// Debug
console.log('🚀 Starting Poolit Backend...');
console.log('📁 NODE_ENV:', process.env.NODE_ENV || 'development');
console.log('🔍 MONGO_URI:', process.env.MONGO_URI ? '✅ Configured' : '❌ Missing');
if (process.env.MONGO_URI) {
  console.log('📊 Database:', process.env.MONGO_URI.split('/').pop().split('?')[0] || 'default');
}
console.log('🔌 PORT:', process.env.PORT || 5000);
console.log('---');

const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const connectDB = require("./config/db");

// Routes
const hostelsRouter = require("./routes/hostels");
const vendorsRouter = require("./routes/vendors");
const slotsRouter = require("./routes/slots");
const ordersRouter = require("./routes/orders");
const menuItemsRouter = require("./routes/menuItems");
const inventoryRouter = require("./routes/inventory");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// Health check
app.get("/", (req, res) => {
  res.json({
    message: "Poolit Backend is running",
    version: "1.0.0",
    status: "healthy",
    timestamp: new Date().toISOString(),
    endpoints: [
      "GET  /hostels",
      "GET  /hostels/:hostelId/current-slot",
      "GET  /vendors",
      "GET  /vendors/:vendorId",
      "GET  /vendors/:vendorId/menu",
      "GET  /vendors/:vendorId/orders",
      "GET  /slots/:slotId",
      "GET  /slots/:slotId/orders",
      "GET  /slots/:slotId/pick-list",
      "GET  /slots/:slotId/live-fee",
      "POST /slots/:slotId/orders",
      "POST /slots/:slotId/close",
      "POST /slots/:slotId/dispatch",
      "POST /orders/:orderId/deliver",
      "GET  /inventory?vendorId=&status=low|out",
      "POST /menu-items/:itemId/restock",
      "GET  /menu-items/:itemId/restock-log",
    ],
  });
});

// API routes
app.use("/hostels", hostelsRouter);
app.use("/vendors", vendorsRouter);
app.use("/slots", slotsRouter);
app.use("/orders", ordersRouter);
app.use("/menu-items", menuItemsRouter);
app.use("/inventory", inventoryRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    message: "Route not found",
    path: req.originalUrl 
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Error:', err.stack);
  res.status(500).json({ 
    message: "Internal server error",
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

const PORT = process.env.PORT || 5000;

// Start the server
const start = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    
    // Start the server
    app.listen(PORT, () => {
      console.log(`✅ Poolit backend running on http://localhost:${PORT}`);
      console.log(`📊 Health check: http://localhost:${PORT}/`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  console.error('❌ Unhandled Rejection:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
  process.exit(1);
});

// Start the application
start();