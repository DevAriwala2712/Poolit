const express = require("express");
const router = express.Router();
const slotController = require("../controllers/slotController");
const orderController = require("../controllers/orderController");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");
const { rateLimit } = require("../middleware/rateLimit");
const optionalAuth = require("../middleware/optionalAuth");
const vendorOnlyWhenStudentLogin = require("../middleware/vendorOnlyWhenStudentLogin");

// Public endpoint: throttle per client IP so a script can't drain stock
// with fake orders. 30/min, not lower: a whole hostel on campus Wi-Fi
// often shares ONE public IP. Best-effort on serverless (per instance) until a shared
// store (Upstash Redis) replaces it — see docs/PRODUCTION_PLAN.md.
const orderLimiter = rateLimit({ windowMs: 60_000, max: 30, name: "orders" });

router.get("/:slotId", slotController.getSlotById);
router.get("/:slotId/orders", vendorOnlyWhenStudentLogin(vendorFrom.slot), slotController.getSlotOrders);
router.get("/:slotId/pick-list", vendorOnlyWhenStudentLogin(vendorFrom.slot), slotController.getPickList);
router.get("/:slotId/live-fee", orderController.getLiveFee);

// The student app places orders here. Signed-in students get the order
// linked to their account; STUDENT_LOGIN_REQUIRED=true makes sign-in mandatory.
router.post("/:slotId/orders", orderLimiter, optionalAuth, orderController.placeOrder);

// Vendor-only actions.
router.post("/:slotId/close", requireAuth, requireVendorAccess(vendorFrom.slot), slotController.closeSlotHandler);
router.post("/:slotId/dispatch", requireAuth, requireVendorAccess(vendorFrom.slot), slotController.dispatchSlot);

module.exports = router;