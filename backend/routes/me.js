const express = require("express");
const router = express.Router();
const studentController = require("../controllers/studentController");
const { validate } = require("../middleware/validate");
const { idempotency } = require("../middleware/idempotency");
const S = require("../schemas");
const requireAuth = require("../middleware/requireAuth");

// Signed-in student (phone OTP) routes.
router.get("/", requireAuth, studentController.getMe);
router.put("/", requireAuth, validate({ body: S.updateMeBody }), studentController.updateMe);
router.get("/orders", requireAuth, studentController.getMyOrders);

module.exports = router;
