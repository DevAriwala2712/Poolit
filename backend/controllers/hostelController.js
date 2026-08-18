const Hostel = require("../models/Hostel");
const Slot = require("../models/Slot");
const Vendor = require("../models/Vendor");
const MenuItem = require("../models/MenuItem");
const { ensureSlotClosedIfExpired } = require("../utils/slotCloser");

// GET /hostels
exports.getAllHostels = async (req, res) => {
  try {
    const hostels = await Hostel.find().sort({ name: 1 });
    res.json(hostels);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch hostels" });
  }
};

// GET /hostels/:hostelId/current-slot
exports.getCurrentSlot = async (req, res) => {
  try {
    const { hostelId } = req.params;

    let slot = await Slot.findOne({
      hostelId,
      status: "open",
    }).sort({ opensAt: -1 });

    if (!slot) {
      slot = await Slot.findOne({ hostelId }).sort({ opensAt: -1 });
    }

    if (!slot) {
      return res.status(404).json({ message: "No slot found for this hostel" });
    }

    const closeResult = await ensureSlotClosedIfExpired(slot);
    if (!closeResult.skipped) {
      slot = closeResult.slot;
    }

    const vendor = await Vendor.findById(slot.vendorId);
    if (!vendor) {
      return res.status(404).json({ message: "Vendor not found for slot" });
    }

    const menuItems = await MenuItem.find({ vendorId: vendor._id }).sort({
      category: 1,
      name: 1,
    });

    const vendorWithMenu = {
      ...vendor.toJSON(),
      menu: menuItems.map((m) => m.toJSON()),
    };

    res.json({
      slot: slot.toJSON(),
      vendor: vendorWithMenu,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch current slot" });
  }
};