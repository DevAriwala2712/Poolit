const supabase = require("../config/supabaseClient");

/**
 * Keeps every hostel's pool cycling without anyone having to open the app:
 * closes expired pools (locking fees) and opens the next one. Uses the same
 * atomic ensure_open_slot() function as GET /hostels/:id/current-slot.
 */
async function sweepExpiredSlots() {
  // Every hostel with a store gets ensure_open_slot(): expired pools with
  // orders are closed (fees locked) and replaced by a fresh pool, empty
  // expired pools have their timer restarted, paused stores open nothing.
  const { data: vendors, error } = await supabase.from("vendors").select("hostel_id");
  if (error) {
    console.error("[poolScheduler] Failed to list stores:", error.message);
    return { checked: 0, closed: 0, failed: 0 };
  }

  let closed = 0;
  let failed = 0;
  for (const { hostel_id: hostelId } of vendors) {
    const { data: before } = await supabase
      .from("slots")
      .select("id")
      .eq("hostel_id", hostelId)
      .eq("status", "open")
      .lte("closes_at", new Date().toISOString())
      .maybeSingle();
    const { data: after, error: rpcErr } = await supabase.rpc("ensure_open_slot", { p_hostel_id: hostelId });
    if (rpcErr) {
      failed += 1;
      console.error(`[poolScheduler] Failed to rotate pool for hostel ${hostelId}:`, rpcErr.message);
    } else if (before && after && after.id !== before.id) {
      closed += 1;
    }
  }

  return { checked: vendors.length, closed, failed };
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
