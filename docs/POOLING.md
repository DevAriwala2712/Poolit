# Pool (slot) lifecycle & auto-closing

A "pool" in the UI is a **slot** in the data model: `open → closed →
dispatched`. This doc covers how a slot transitions from `open` to `closed`
— specifically, what closes it automatically once its timer runs out.

## The three ways a slot closes

1. **Manual vendor action** — `POST /slots/:slotId/close`
   ([slotController.closeSlotHandler](../backend/controllers/slotController.js)),
   wired to the "Close pool" / "Close Pool" buttons in
   [Orders.tsx](../frontend/apps/vendor/src/screens/Orders.tsx) and
   [Dashboard.tsx](../frontend/apps/vendor/src/screens/Dashboard.tsx).

2. **Lazy close on read/write** —
   [utils/slotCloser.js `ensureSlotClosedIfExpired`](../backend/utils/slotCloser.js)
   checks `status === "open" && now >= closes_at` and closes the slot right
   before returning it. Called from `getCurrentSlot`, `getSlotById`,
   `getSlotOrders`, `getPickList`, and `getLiveFee`. This means a slot
   *looks* closed within moments of expiry as long as **some** client is
   actively polling it — the frontend polls every 5s
   (`POLL_INTERVAL_MS` in `frontend/packages/domain/src/store.tsx`) — but
   gives no guarantee if nobody's screen happens to be open.

3. **Automatic background sweep (new)** —
   [utils/poolScheduler.js](../backend/utils/poolScheduler.js). This is the
   piece that was missing: previously there was no process that closed a
   slot on its own; it only ever happened as a side effect of some other
   request. `sweepExpiredSlots()` queries every `open` slot whose
   `closes_at` has already passed and closes each one through the same
   `close_slot` RPC the manual button uses (so the "locks in the fee and
   order count atomically" behavior is identical either way).

## How the sweep runs, per deployment target

Whether the sweep can run as a background loop depends on whether the
process stays alive between requests:

- **`npm run dev` / `npm start` (backend/server.js)** — a real long-lived
  Node process. `startPoolScheduler()` is called once at boot and sets up
  a `setInterval` that calls `sweepExpiredSlots()` every
  `POOL_SWEEP_INTERVAL_MS` (default **30000ms**, configurable in
  `backend/.env`). This is the path used for local dev and any traditional
  host (a VM, a container, Render/Railway/Fly, etc).

- **Vercel serverless (backend/api/index.js)** — each request gets its own
  ephemeral function invocation; there is nowhere to keep a `setInterval`
  alive. For this target, trigger the same sweep externally instead:
  `POST /internal/sweep-slots` ([routes/internal.js](../backend/routes/internal.js))
  runs `sweepExpiredSlots()` on demand. It's guarded by a shared secret —
  set `CRON_SECRET` in the environment and have your scheduler send it as
  the `x-cron-secret` header. Without `CRON_SECRET` set, the route always
  returns `503` (fails closed, not open). Wire it up with
  [Vercel Cron Jobs](https://vercel.com/docs/cron-jobs) (add a `crons`
  entry in `backend/vercel.json` pointing at `/internal/sweep-slots` on
  whatever interval you want — Vercel Cron itself only supports minute
  granularity) or any other external scheduler that can make an
  authenticated POST on a timer.

## Why closing is idempotent

Both paths — the lazy check and the sweep — can race against each other or
against a manual close. That's fine: `close_slot(p_slot_id)` is idempotent
(returns `{ alreadyClosed: true }` instead of erroring if the slot is
already closed), so calling it twice for the same slot from two different
triggers is harmless.

## Tuning / disabling

- Slower or faster sweeps: set `POOL_SWEEP_INTERVAL_MS` in `backend/.env`
  (milliseconds). Lower values close pools more promptly but poll the DB
  more often; 30s is a reasonable default given `SLOT_DURATION_MINUTES` is
  typically 10 minutes in the seed data.
- There's no explicit "disable" flag — if you don't want the interval
  running (e.g. in a test process), don't call `startPoolScheduler()`. It's
  only invoked from `server.js`, not from `app.js`, specifically so
  requiring `app.js` alone (as tests or the serverless entry do) never
  starts a background timer as a side effect.
