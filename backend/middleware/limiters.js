const { rateLimit } = require("./rateLimit");

// Vendor mutations (restock, adjust, price, staff, close/dispatch/deliver…):
// 60 per minute per signed-in user. Scanning in continuous mode is about one
// restock a second at the very most, so this only stops runaway scripts.
const vendorWriteLimit = rateLimit({ windowMs: 60_000, max: 60, name: "vendor-writes" });

module.exports = { vendorWriteLimit };
