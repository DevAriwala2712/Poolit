const express = require("express");
const router = express.Router();
const requireAuth = require("../middleware/requireAuth");
const vendorConsoleController = require("../controllers/vendorConsoleController");

// The signed-in vendor's console data (scoped to their stores).
router.get("/overview", requireAuth, vendorConsoleController.getOverview);
router.get("/analytics", requireAuth, vendorConsoleController.getAnalytics);

module.exports = router;
