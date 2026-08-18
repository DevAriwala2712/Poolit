const Vendor = require("../models/Vendor");
const MenuItem = require("../models/MenuItem");
const Order = require("../models/Order");
const Slot = require("../models/Slot");

// GET /vendors
exports.getAllVendors = async (req, res) => {
  try {
    const vendors = await Vendor.find().sort({ name: 1 });
    const result = await Promise.all(
      vendors.map(async (v) => {
        const menu = await MenuItem.find({ vendorId: v._id }).sort({
          category: 1,
          name: 1,
        });
        return {
          ...v.toJSON(),
          menu: menu.map((m) => m.toJSON()),
        };
      })
    );
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendors" });
  }
};

// GET /vendors/:vendorId
exports.getVendorById = async (req, res) => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found" });
    }

    const menu = await MenuItem.find({ vendorId: vendor._id }).sort({
      category: 1,
      name: 1,
    });

    res.json({
      ...vendor.toJSON(),
      menu: menu.map((m) => m.toJSON()),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor" });
  }
};

// GET /vendors/:vendorId/menu
exports.getVendorMenu = async (req, res) => {
  try {
    const items = await MenuItem.find({ vendorId: req.params.vendorId }).sort({
      category: 1,
      name: 1,
    });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch menu" });
  }
};

// GET /vendors/:vendorId/orders?status=
exports.getVendorOrders = async (req, res) => {
  try {
    const { vendorId } = req.params;
    const { status } = req.query;

    const slots = await Slot.find({ vendorId }).select("_id");
    const slotIds = slots.map((s) => s._id);

    const filter = { slotId: { $in: slotIds } };
    if (status) {
      filter.status = status;
    }

    const orders = await Order.find(filter).sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch vendor orders" });
  }
};