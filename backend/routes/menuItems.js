const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");
const stockController = require("../controllers/stockController");
const { validate } = require("../middleware/validate");
const { idempotency } = require("../middleware/idempotency");
const S = require("../schemas");
const { vendorWriteLimit } = require("../middleware/limiters");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.patch("/:itemId", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.menuItem), validate({ body: S.updateItemBody }), menuItemController.updateItem);
router.post("/:itemId/restock", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.menuItem), validate({ body: S.restockBody }), idempotency(), menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);
router.post("/:itemId/barcode", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.menuItem), stockController.generateBarcode);
router.post("/:itemId/adjust", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.menuItem), validate({ body: S.adjustBody }), idempotency(), stockController.adjustStock);
router.get("/:itemId/stock-history", requireAuth, requireVendorAccess(vendorFrom.menuItem), stockController.getStockHistory);

module.exports = router;