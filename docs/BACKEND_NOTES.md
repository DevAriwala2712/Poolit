# Backend notes — issues found, fixes applied, what's still open

This is a running log of backend correctness/performance issues discovered
during review, so future work doesn't rediscover the same things. "Fixed"
entries link the actual change; "Open" entries are deliberately *not* fixed
yet, with a reason.

## Fixed

### `markDelivered` race condition
**Was:** [orderController.js](../backend/controllers/orderController.js)
read the order (`SELECT`), checked `status === "dispatched"` in JavaScript,
then issued a separate `UPDATE`. Two concurrent `POST
/orders/:orderId/deliver` requests for the same order could both pass the
JS check before either write landed — every other status-mutating endpoint
(`placeOrder`, `closeSlot`, `dispatchSlot`, `restockItem`) instead delegates
its read-check-write to an atomic Postgres RPC, so this was the one place
that skipped that pattern.
**Fix:** collapsed it to a single conditional
`UPDATE orders SET status = 'delivered' ... WHERE id = :id AND status =
'dispatched' RETURNING *`. That query is atomic in Postgres by itself — no
new RPC function needed. If it affects 0 rows, a follow-up `SELECT`
distinguishes "not found" (404) from "wrong status" (409) purely for the
error message; the actual state transition no longer depends on that
follow-up read.

### N+1 query in `GET /vendors`
**Was:** [vendorController.js](../backend/controllers/vendorController.js)
`getAllVendors` fetched all vendors, then fired one `menu_items` query per
vendor via `Promise.all` — parallelized, but still N+1 round trips (21
queries for 20 vendors).
**Fix:** one `menu_items` query with `.in("vendor_id", vendorIds)`,
grouped into a `Map` in JS. Two queries total regardless of vendor count.
Verified: `curl http://localhost:5057/vendors` still returns the same
shape with correct per-vendor menu arrays (5 vendors / 24 menu items in the
seeded dataset).

### No automated pool-closing
See [POOLING.md](POOLING.md) — this was the headline gap: closing a slot
only ever happened as a side effect of some client reading/writing it, or a
vendor manually clicking "Close pool." Added
[utils/poolScheduler.js](../backend/utils/poolScheduler.js) (interval sweep
for the long-lived server process) and `POST /internal/sweep-slots`
([routes/internal.js](../backend/routes/internal.js), secret-gated) for the
serverless deployment target where a `setInterval` can't survive between
invocations.

### Wide-open CORS
**Was:** `app.use(cors())` with no options — any origin, unconditionally.
**Fix:** `ALLOWED_ORIGINS` env var (comma-separated) now restricts it when
set; unset keeps the previous fully-open behavior so nothing breaks by
default. See `backend/.env.example`.

### Dead file
Deleted `backend/index.js` — it was 0 bytes and not required anywhere. The
real entry points are `server.js` (local) and `api/index.js` (Vercel); the
empty file next to them was a pure footgun for anyone editing "the" entry
point by habit.

## Open (deliberately not changed — here's why)

### `requireAuth` calls Supabase Auth on every request
[middleware/requireAuth.js](../backend/middleware/requireAuth.js) calls
`supabase.auth.getUser(token)` — a network round trip to Supabase's auth
service on every single vendor-authenticated request. This is a real
latency cost. The fix is local JWT signature verification (no network
call), but it requires the project's JWT secret
(`SUPABASE_JWT_SECRET`, different from the service-role key already in
`.env`) to be configured correctly — getting this wrong silently breaks
vendor login/auth, which is worse than the current slowness. **Left as a
documented follow-up**, not applied blind. To do it safely: add
`SUPABASE_JWT_SECRET` to `.env`, verify locally with a short-TTL fallback
to the network call, and test an actual vendor login end-to-end before
trusting it.

### `inventory?status=low` filters in JS, not SQL
[inventoryController.js](../backend/controllers/inventoryController.js)
fetches every matching row, then filters `stock_qty > 0 && stock_qty <=
low_stock_threshold` in JavaScript, because Supabase's query builder
doesn't support comparing two columns of the same row directly. Fine at
demo scale (tens of items per vendor); would need a Postgres view or a
`.rpc()` wrapper to push down at real scale. Not fixed because it needs a
schema change (a view), and there's no migrations directory in this repo to
put one in yet (see below).

### No pagination on list endpoints
`getAllVendors`, `getInventory`, `getVendorOrders`, `getSlotOrders`,
`getRestockLog` all return unbounded result sets. Not an issue at seed-data
scale; will matter once a hostel/vendor has real order history.

### Schema and RPC bodies aren't version-controlled
There is no `/migrations` or `/sql` directory in this repo — table
definitions, indexes, RLS policies, and the four RPC functions
(`close_slot`, `dispatch_slot`, `place_order`, `restock_item`) only exist
in the live Supabase project. This means the schema can't be code-reviewed,
diffed, or recreated from the repo alone. Worth fixing by exporting the
current schema (`supabase db dump` or the SQL editor) into a checked-in
`backend/sql/` directory — flagged here rather than done blind, since it
needs read access to the actual live schema to do accurately.

### Crash-on-unhandled-rejection in `server.js`
`process.on("unhandledRejection"/"uncaughtException", ... process.exit(1))`
in [server.js](../backend/server.js) takes the whole process down on any
single unhandled rejection. This is a standard "fail fast, let the process
manager restart you" pattern (and `nodemon`/a real process manager does
restart it), so it's not clearly a bug — but it does mean one bad edge case
in a request handler can cause a brief outage for every concurrent user.
Left as-is: every current controller already wraps its logic in try/catch,
so this handler is a safety net for truly unexpected failures, not a path
hit in normal operation.
