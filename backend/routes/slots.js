const express = require("express");
const router = express.Router();
const slotController = require("../controllers/slotController");
const orderController = require("../controllers/orderController");

router.get("/:slotId", slotController.getSlotById);
router.get("/:slotId/orders", slotController.getSlotOrders);
router.get("/:slotId/pick-list", slotController.getPickList);
router.get("/:slotId/live-fee", orderController.getLiveFee);

router.post("/:slotId/orders", orderController.placeOrder);
router.post("/:slotId/close", slotController.closeSlotHandler);
router.post("/:slotId/dispatch", slotController.dispatchSlot);

module.exports = router;