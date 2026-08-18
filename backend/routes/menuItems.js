const express = require("express");
const router = express.Router();
const menuItemController = require("../controllers/menuItemController");

router.post("/:itemId/restock", menuItemController.restockItem);
router.get("/:itemId/restock-log", menuItemController.getRestockLog);

module.exports = router;