const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const menuItemController = require("../controllers/menuItemController");
const staffController = require("../controllers/staffController");
const requireAuth = require("../middleware/requireAuth");
const vendorOnlyWhenStudentLogin = require("../middleware/vendorOnlyWhenStudentLogin");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.get("/", vendorController.getAllVendors);
router.get("/:vendorId", vendorController.getVendorById);
router.patch("/:vendorId", requireAuth, requireVendorAccess(vendorFrom.param, { roles: ["owner"] }), vendorController.updateVendor);
router.get("/:vendorId/menu", vendorController.getVendorMenu);
router.post("/:vendorId/menu-items", requireAuth, requireVendorAccess(vendorFrom.param), menuItemController.createItem);
router.get("/:vendorId/orders", vendorOnlyWhenStudentLogin(vendorFrom.param), vendorController.getVendorOrders);
router.get("/:vendorId/staff", requireAuth, requireVendorAccess(vendorFrom.param), staffController.getStaff);
router.post("/:vendorId/staff", requireAuth, requireVendorAccess(vendorFrom.param, { roles: ["owner"] }), staffController.createStaff);

module.exports = router;