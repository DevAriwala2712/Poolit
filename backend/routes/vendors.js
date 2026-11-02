const express = require("express");
const router = express.Router();
const vendorController = require("../controllers/vendorController");
const menuItemController = require("../controllers/menuItemController");
const staffController = require("../controllers/staffController");
const stockController = require("../controllers/stockController");
const { validate } = require("../middleware/validate");
const { idempotency } = require("../middleware/idempotency");
const S = require("../schemas");
const memberController = require("../controllers/memberController");
const { vendorWriteLimit } = require("../middleware/limiters");
const requireAuth = require("../middleware/requireAuth");
const vendorOnlyWhenStudentLogin = require("../middleware/vendorOnlyWhenStudentLogin");
const { requireVendorAccess, vendorFrom } = require("../middleware/requireVendorAccess");

router.get("/", vendorController.getAllVendors);
router.get("/:vendorId", vendorController.getVendorById);
router.patch("/:vendorId", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.param, { roles: ["owner"] }), validate({ body: S.updateVendorBody }), vendorController.updateVendor);
router.get("/:vendorId/menu", vendorController.getVendorMenu);
router.post("/:vendorId/menu-items", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.param), validate({ body: S.createItemBody }), menuItemController.createItem);
router.post("/:vendorId/barcodes", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.param), stockController.generateMissingBarcodes);
router.get("/:vendorId/orders", vendorOnlyWhenStudentLogin(vendorFrom.param), vendorController.getVendorOrders);
router.get("/:vendorId/staff", requireAuth, requireVendorAccess(vendorFrom.param), staffController.getStaff);
router.post("/:vendorId/staff", requireAuth, vendorWriteLimit, requireVendorAccess(vendorFrom.param, { roles: ["owner"] }), validate({ body: S.createStaffBody }), staffController.createStaff);

// Store logins. Owner-only and always scoped to the store.
const owner = requireVendorAccess(vendorFrom.param, { roles: ["owner"], alwaysScoped: true });
router.get("/:vendorId/members", requireAuth, owner, memberController.listMembers);
router.post("/:vendorId/members", requireAuth, vendorWriteLimit, owner, validate({ body: S.inviteMemberBody }), memberController.inviteMember);
router.patch("/:vendorId/members/:userId", requireAuth, vendorWriteLimit, owner, validate({ body: S.updateMemberBody }), memberController.updateMember);
router.delete("/:vendorId/members/:userId", requireAuth, vendorWriteLimit, owner, memberController.removeMember);

module.exports = router;