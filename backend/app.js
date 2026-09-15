const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
require("./config/supabaseClient"); // validates env vars up front

// Routes
const hostelsRouter = require("./routes/hostels");
const vendorsRouter = require("./routes/vendors");
const slotsRouter = require("./routes/slots");
const ordersRouter = require("./routes/orders");
const menuItemsRouter = require("./routes/menuItems");
const inventoryRouter = require("./routes/inventory");
const internalRouter = require("./routes/internal");
const staffRouter = require("./routes/staff");

const app = express();

// Middleware
// ALLOWED_ORIGINS, if set, is a comma-separated allowlist (e.g. the deployed
// student/vendor URLs). Left unset, CORS stays wide open — the same
// permissive default this had before — since student ordering is public.
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors(
    allowedOrigins.length > 0
      ? {
          origin: (origin, callback) => {
            if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
            callback(new Error("Not allowed by CORS"));
          },
        }
      : undefined
  )
);
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
      "PATCH /vendors/:vendorId",
      "GET  /vendors/:vendorId/menu",
      "POST /vendors/:vendorId/menu-items",
      "GET  /vendors/:vendorId/orders",
      "GET  /vendors/:vendorId/staff",
      "POST /vendors/:vendorId/staff",
      "PATCH /staff/:staffId",
      "DELETE /staff/:staffId",
      "GET  /slots/:slotId",
      "GET  /slots/:slotId/orders",
      "GET  /slots/:slotId/pick-list",
      "GET  /slots/:slotId/live-fee",
      "POST /slots/:slotId/orders",
      "POST /slots/:slotId/close",
      "POST /slots/:slotId/dispatch",
      "POST /orders/:orderId/deliver",
      "GET  /inventory?vendorId=&status=low|out",
      "PATCH /menu-items/:itemId",
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
app.use("/internal", internalRouter);
app.use("/staff", staffRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = app;
