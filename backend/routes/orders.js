const express = require("express");
const router = express.Router();
const orderController = require("../controllers/orderController");

router.post("/:orderId/deliver", orderController.markDelivered);

module.exports = router;