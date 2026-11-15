const express = require("express");
const router = express.Router();
const staffController = require("../controllers/staffController");
const { validate } = require("../middleware/validate");
const S = require("../schemas");
const { vendorWriteLimit } = require("../middleware/limiters");
const requireAuth = require("../middleware/requireAuth");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.patch("/:staffId", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.staff, { roles: ["owner"] }), validate({ body: S.updateStaffBody }), staffController.updateStaff);
router.delete("/:staffId", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.staff, { roles: ["owner"] }), staffController.deleteStaff);

module.exports = router;
