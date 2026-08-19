const express = require("express");
const router = express.Router();
const hostelController = require("../controllers/hostelController");

router.get("/", hostelController.getAllHostels);
router.get("/:hostelId/current-slot", hostelController.getCurrentSlot);

module.exports = router;