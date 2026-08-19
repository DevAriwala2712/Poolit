const mongoose = require("mongoose");
const MenuItem = require("../models/MenuItem");
const RestockLog = require("../models/RestockLog");

// POST /menu-items/:itemId/restock
exports.restockItem = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { itemId } = req.params;
    const { amount } = req.body;

    if (!amount || typeof amount !== "number" || amount <= 0 || !Number.isInteger(amount)) {
      await session.abortTransaction();
      return res.status(400).json({ message: "amount must be a positive integer" });
    }

    const item = await MenuItem.findById(itemId).session(session);
    if (!item) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Menu item not found" });
    }

    item.stockQty += amount;
    await item.save({ session });

    const [logEntry] = await RestockLog.create(
      [
        {
          vendorId: item.vendorId,
          menuItemId: item._id,
          amount,
          at: new Date(),
        },
      ],
      { session }
    );

    await session.commitTransaction();

    res.json({
      message: "Restocked successfully",
      item,
      restockLog: logEntry,
    });
  } catch (err) {
    await session.abortTransaction();
    console.error(err);
    res.status(500).json({ message: "Failed to restock item" });
  } finally {
    session.endSession();
  }
};

// PATCH /menu-items/:itemId
// Vendor-side edits to an item's price and/or low-stock threshold.
exports.updateItem = async (req, res) => {
  try {
    const { price, lowStockThreshold } = req.body;
    const update = {};

    if (price !== undefined) {
      if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
        return res.status(400).json({ message: "price must be a positive number" });
      }
      update.price = Math.round(price);
    }

    if (lowStockThreshold !== undefined) {
      if (
        typeof lowStockThreshold !== "number" ||
        !Number.isInteger(lowStockThreshold) ||
        lowStockThreshold < 0
      ) {
        return res
          .status(400)
          .json({ message: "lowStockThreshold must be a non-negative integer" });
      }
      update.lowStockThreshold = lowStockThreshold;
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const item = await MenuItem.findByIdAndUpdate(req.params.itemId, update, {
      new: true,
      runValidators: true,
    });
    if (!item) {
      return res.status(404).json({ message: "Menu item not found" });
    }

    res.json(item);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to update menu item" });
  }
};

// GET /menu-items/:itemId/restock-log
exports.getRestockLog = async (req, res) => {
  try {
    const logs = await RestockLog.find({ menuItemId: req.params.itemId }).sort({
      at: -1,
    });
    res.json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch restock log" });
  }
};