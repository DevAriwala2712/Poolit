const express = require("express");
const router = express.Router();
const { sweepExpiredSlots } = require("../utils/poolScheduler");

/**
 * POST /internal/sweep-slots
 *
 * Lets an external scheduler (e.g. Vercel Cron) trigger the same expired-pool
 * sweep that server.js runs on a setInterval — needed because the serverless
 * deployment (api/index.js) has no persistent process to host that interval.
 * Guarded by a shared secret so it isn't a public "close everyone's pools"
 * endpoint. Configure CRON_SECRET in the environment and have the scheduler
 * send it as `x-cron-secret`. See docs/POOLING.md.
 */
router.post("/sweep-slots", async (req, res) => {
  const configuredSecret = process.env.CRON_SECRET;
  if (!configuredSecret) {
    return res.status(503).json({ message: "CRON_SECRET is not configured" });
  }
  if (req.headers["x-cron-secret"] !== configuredSecret) {
    return res.status(401).json({ message: "Invalid cron secret" });
  }

  try {
    const result = await sweepExpiredSlots();
    res.json({ message: "Sweep complete", ...result });
  } catch (err) {
    console.error("[internal] sweep-slots failed:", err);
    res.status(500).json({ message: "Sweep failed" });
  }
});

module.exports = router;
