// Vercel serverless entry point — see ../vercel.json for the rewrite that
// routes every path here so Express's own router still sees the real path.
// no-op: verifying the git-triggered deploy pipeline after clearing a corrupted build cache
require("dotenv").config();
module.exports = require("../app");
