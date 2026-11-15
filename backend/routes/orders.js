const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const { vendorWriteLimit } = require("../middleware/limiters");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.post("/:orderId/deliver", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.order), orderController.markDelivered);

module.exports = router;