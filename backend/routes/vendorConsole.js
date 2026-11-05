const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const { validate } = require("../middleware/validate");
const S = require("../schemas");
const vendorConsoleController = require("../controllers/vendorConsoleController");

// The signed-in vendor's console data (scoped to their stores).
router.get("/overview", requireAuth, vendorConsoleController.getOverview);
router.get("/revenue", requireAuth, validate({ query: S.revenueQuery }), vendorConsoleController.getRevenue);

module.exports = router;
