const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const requireAuth = require("../middleware/requireAuth");

router.patch("/:staffId", requireAuth, staffController.updateStaff);
router.delete("/:staffId", requireAuth, staffController.deleteStaff);

module.exports = router;
