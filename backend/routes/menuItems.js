const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");

router.patch("/:itemId", menuItemController.updateItem);
router.post("/:itemId/restock", menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);

module.exports = router;