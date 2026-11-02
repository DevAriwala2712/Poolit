const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.patch("/:itemId", requireAuth, requireVendorAccess(vendorFrom.menuItem), menuItemController.updateItem);
router.post("/:itemId/restock", requireAuth, requireVendorAccess(vendorFrom.menuItem), menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);

module.exports = router;