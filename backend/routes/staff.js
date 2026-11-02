const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.patch("/:staffId", requireAuth, requireVendorAccess(vendorFrom.staff, { roles: ["owner"] }), staffController.updateStaff);
router.delete("/:staffId", requireAuth, requireVendorAccess(vendorFrom.staff, { roles: ["owner"] }), staffController.deleteStaff);

module.exports = router;
