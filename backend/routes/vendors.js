const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const menuItemController = require("../controllers/menuItemController");
const staffController = require("../controllers/staffController");
const requireAuth = require("../middleware/requireAuth");

router.get("/", vendorController.getAllVendors);
router.get("/:vendorId", vendorController.getVendorById);
router.patch("/:vendorId", requireAuth, vendorController.updateVendor);
router.get("/:vendorId/menu", vendorController.getVendorMenu);
router.post("/:vendorId/menu-items", requireAuth, menuItemController.createItem);
router.get("/:vendorId/orders", vendorController.getVendorOrders);
router.get("/:vendorId/staff", requireAuth, staffController.getStaff);
router.post("/:vendorId/staff", requireAuth, staffController.createStaff);

module.exports = router;