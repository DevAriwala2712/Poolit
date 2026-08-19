const MenuItem = require("../models/MenuItem");

// GET /inventory?vendorId=&status=low|out
exports.getInventory = async (req, res) => {
  try {
    const { vendorId, status } = req.query;
    const filter = {};

    if (vendorId) {
      filter.vendorId = vendorId;
    }

    if (status === "out") {
      filter.stockQty = 0;
    } else if (status === "low") {
      const items = await MenuItem.find(filter).sort({ stockQty: 1, name: 1 });
      const low = items.filter(
        (i) => i.stockQty > 0 && i.stockQty <= i.lowStockThreshold
      );
      return res.json(low);
    }

    const items = await MenuItem.find(filter).sort({ stockQty: 1, name: 1 });
    res.json(items);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};