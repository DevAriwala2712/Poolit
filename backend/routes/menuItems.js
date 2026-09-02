const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");
const requireAuth = require("../middleware/requireAuth");

router.patch("/:itemId", requireAuth, menuItemController.updateItem);
router.post("/:itemId/restock", requireAuth, menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);

module.exports = router;