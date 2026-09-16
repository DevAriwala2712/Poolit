// Vercel serverless entry point — see ../vercel.json for the rewrite that
// routes every path here so Express's own router still sees the real path.
// no-op: verifying git-triggered deploys after fixing Root Directory (was ".", now "backend")
require("dotenv").config();
module.exports = require("../app");
