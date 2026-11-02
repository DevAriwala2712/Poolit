const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.post("/:orderId/deliver", requireAuth, requireVendorAccess(vendorFrom.order), orderController.markDelivered);

module.exports = router;