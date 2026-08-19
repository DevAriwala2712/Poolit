const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");

router.get("/", vendorController.getAllVendors);
router.get("/:vendorId", vendorController.getVendorById);
router.get("/:vendorId/menu", vendorController.getVendorMenu);
router.get("/:vendorId/orders", vendorController.getVendorOrders);

module.exports = router;