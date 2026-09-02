// Vercel serverless entry point — see ../vercel.json for the rewrite that
// routes every path here so Express's own router still sees the real path.
require("dotenv").config();
module.exports = require("../app");
