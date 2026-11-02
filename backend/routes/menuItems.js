const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");
const stockController = require("../controllers/stockController");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.patch("/:itemId", requireAuth, requireVendorAccess(vendorFrom.menuItem), menuItemController.updateItem);
router.post("/:itemId/restock", requireAuth, requireVendorAccess(vendorFrom.menuItem), menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);
router.post("/:itemId/barcode", requireAuth, requireVendorAccess(vendorFrom.menuItem), stockController.generateBarcode);
router.post("/:itemId/adjust", requireAuth, requireVendorAccess(vendorFrom.menuItem), stockController.adjustStock);
router.get("/:itemId/stock-history", requireAuth, requireVendorAccess(vendorFrom.menuItem), stockController.getStockHistory);

module.exports = router;