const express = require("express");
const cors = require("cors");
const { requestContext } = require("./middleware/requestContext");
require("./config/supabaseClient"); // validates env vars up front
const { initSentry, captureServerError } = require("./utils/sentry");
initSentry();

// Routes
const hostelsRouter = require("./routes/hostels");
const vendorsRouter = require("./routes/vendors");
const slotsRouter = require("./routes/slots");
const ordersRouter = require("./routes/orders");
const menuItemsRouter = require("./routes/menuItems");
const inventoryRouter = require("./routes/inventory");
const internalRouter = require("./routes/internal");
const staffRouter = require("./routes/staff");
const meRouter = require("./routes/me");
const vendorConsoleRouter = require("./routes/vendorConsole");

const app = express();
app.disable("x-powered-by");
// Behind Vercel / a load balancer: trust the first proxy so req.ip is the
// real client (needed for any future rate limiting / audit logs).
app.set("trust proxy", 1);

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
            const err = new Error("Not allowed by CORS");
            err.status = 403;
            callback(err);
          },
        }
      : undefined
  )
);
app.use(express.json({ limit: "100kb" }));
// One JSON log line per request (quiet under tests); every response gets an
// X-Request-Id and every error body a stable `code`.
app.use(requestContext(process.env.NODE_ENV === "test" || process.env.NODE_TEST_CONTEXT ? { log: () => {} } : {}));
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  // API responses are live data — never let a proxy or the browser cache them.
  res.setHeader("Cache-Control", "no-store");
  next();
});

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
      "POST /menu-items/:itemId/barcode",
      "POST /menu-items/:itemId/adjust",
      "GET  /menu-items/:itemId/stock-history",
      "POST /vendors/:vendorId/barcodes",
      "GET  /me",
      "PUT  /me",
      "GET  /me/orders",
      "GET  /vendor/overview?days=7",
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
app.use("/me", meRouter);
app.use("/vendor", vendorConsoleRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: "Route not found",
    path: req.originalUrl,
  });
});

// Global error handler
// eslint-disable-next-line no-unused-vars
app.use(async (err, req, res, next) => {
  // Client errors raised by middleware (bad JSON, body too large, CORS) keep
  // their 4xx status instead of being reported as a server crash.
  const status = err.status || err.statusCode;
  if (status && status >= 400 && status < 500) {
    return res.status(status).json({
      message: err.type === "entity.parse.failed" ? "Request body is not valid JSON" : err.message,
    });
  }
  await captureServerError(err, req);
  console.error(JSON.stringify({ level: "error", msg: "unhandled error", requestId: req.id, stack: err.stack }));
  res.status(500).json({
    message: "Internal server error",
    error: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

module.exports = app;
