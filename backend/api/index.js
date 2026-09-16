// Vercel serverless entry point — see ../vercel.json for the rewrite that
// routes every path here so Express's own router still sees the real path.
// no-op: verifying git-triggered deploys after setting VERCEL_FORCE_NO_BUILD_CACHE=1
require("dotenv").config();
module.exports = require("../app");
