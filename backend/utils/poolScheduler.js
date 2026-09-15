const supabase = require("../config/supabaseClient");
const { closeSlot } = require("./slotCloser");

/**
 * Finds every "open" slot whose timer has already expired and closes each
 * one via the same atomic close_slot() RPC the manual "Close pool" button
 * and the lazy per-request check use. This is what makes closing actually
 * automatic instead of only happening the next time some client happens to
 * GET that slot (see docs/POOLING.md).
 */
async function sweepExpiredSlots() {
  const nowIso = new Date().toISOString();

  const { data: expired, error } = await supabase
    .from("slots")
    .select("id")
    .eq("status", "open")
    .lte("closes_at", nowIso);

  if (error) {
    console.error("[poolScheduler] Failed to query expired slots:", error.message);
    return { checked: 0, closed: 0, failed: 0 };
  }

  let closed = 0;
  let failed = 0;

  for (const { id } of expired) {
    try {
      await closeSlot(id);
      closed += 1;
    } catch (err) {
      failed += 1;
      console.error(`[poolScheduler] Failed to close slot ${id}:`, err.message);
    }
  }

  return { checked: expired.length, closed, failed };
}

/**
 * Runs sweepExpiredSlots() on a fixed interval. Only meaningful in a
 * long-lived process (server.js) — Vercel's serverless function
 * (api/index.js) has no persistent memory between invocations, so it
 * cannot host a setInterval; for that deployment target use the
 * POST /internal/sweep-slots route (see routes/internal.js) driven by
 * Vercel Cron or another external scheduler instead.
 */
function startPoolScheduler({ intervalMs } = {}) {
  const interval = intervalMs || Number(process.env.POOL_SWEEP_INTERVAL_MS) || 30000;

  const timer = setInterval(() => {
    sweepExpiredSlots()
      .then(({ checked, closed, failed }) => {
        if (closed > 0 || failed > 0) {
          console.log(
            `[poolScheduler] swept ${checked} expired slot(s): ${closed} closed, ${failed} failed`
          );
        }
      })
      .catch((err) => console.error("[poolScheduler] Sweep crashed:", err));
  }, interval);

  // Don't let this timer keep the process alive on its own (e.g. in tests).
  if (typeof timer.unref === "function") timer.unref();

  console.log(`[poolScheduler] Started — sweeping for expired pools every ${interval}ms`);
  return timer;
}

module.exports = { sweepExpiredSlots, startPoolScheduler };
