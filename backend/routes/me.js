const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const requireAuth = require("../middleware/requireAuth");

// Signed-in student (phone OTP) routes.
router.get("/", requireAuth, studentController.getMe);
router.put("/", requireAuth, studentController.updateMe);
router.get("/orders", requireAuth, studentController.getMyOrders);

module.exports = router;
