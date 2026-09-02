const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");
const requireAuth = require("../middleware/requireAuth");

router.post("/:orderId/deliver", requireAuth, orderController.markDelivered);

module.exports = router;