const express = require("express");
const router = express.Router();
const slotController = require("../controllers/slotController");
const orderController = require("../controllers/orderController");
const requireAuth = require("../middleware/requireAuth");

router.get("/:slotId", slotController.getSlotById);
router.get("/:slotId/orders", slotController.getSlotOrders);
router.get("/:slotId/pick-list", slotController.getPickList);
router.get("/:slotId/live-fee", orderController.getLiveFee);

// Public — the student app places orders here.
router.post("/:slotId/orders", orderController.placeOrder);

// Vendor-only actions.
router.post("/:slotId/close", requireAuth, slotController.closeSlotHandler);
router.post("/:slotId/dispatch", requireAuth, slotController.dispatchSlot);

module.exports = router;