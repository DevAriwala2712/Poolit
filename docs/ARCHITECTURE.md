# Poolit — Backend Architecture

The backend is a small Express API in front of Supabase (Postgres). It has
two entry points into the same `app.js`:

- **[backend/server.js](../backend/server.js)** — local dev / traditional
  hosting. Calls `app.listen()` and starts the [pool scheduler](POOLING.md).
- **[backend/api/index.js](../backend/api/index.js)** — Vercel serverless
  entry, re-exports `app` for the `/api` rewrite in
  [backend/vercel.json](../backend/vercel.json). No persistent process, so
  it does **not** run the interval-based scheduler (see POOLING.md for how
  that deployment target closes pools instead).

## Request flow

```
routes/*.js  →  controllers/*.js  →  supabase (table query or RPC call)  →  utils/serialize.js (snake_case → camelCase)
```

- **routes/** wire URLs to controller functions and decide which ones need
  `middleware/requireAuth.js` (vendor-only mutations).
- **controllers/** validate input, talk to Supabase, and shape the HTTP
  response. Business-rule invariants that need to be atomic (can't-be-two-
  requests-racing) are delegated to a Postgres RPC function rather than
  done as separate select-then-update calls in JS — see "RPC functions"
  below.
- **utils/serialize.js** maps every DB row (snake_case columns) to the
  camelCase JSON shape the frontend expects — this mapping predates the
  Supabase migration and is kept stable on purpose so the frontend layer
  (`frontend/packages/domain`) never had to change.

## Routes

| Method & path | Auth | Controller | Notes |
|---|---|---|---|
| `GET /` | — | `app.js` | Health check + endpoint list |
| `GET /hostels` | — | `hostelController.getAllHostels` | |
| `GET /hostels/:hostelId/current-slot` | — | `hostelController.getCurrentSlot` | Lazily closes the slot if expired |
| `GET /vendors` | — | `vendorController.getAllVendors` | |
| `GET /vendors/:vendorId` | — | `vendorController.getVendorById` | |
| `GET /vendors/:vendorId/menu` | — | `vendorController.getVendorMenu` | |
| `GET /vendors/:vendorId/orders` | — | `vendorController.getVendorOrders` | `?status=` filter |
| `GET /slots/:slotId` | — | `slotController.getSlotById` | Lazily closes if expired |
| `GET /slots/:slotId/orders` | — | `slotController.getSlotOrders` | |
| `GET /slots/:slotId/pick-list` | — | `slotController.getPickList` | Aggregate qty per menu item |
| `GET /slots/:slotId/live-fee` | — | `orderController.getLiveFee` | |
| `POST /slots/:slotId/orders` | — | `orderController.placeOrder` | Public — students place orders here |
| `POST /slots/:slotId/close` | ✅ | `slotController.closeSlotHandler` | Manual "Close pool now" |
| `POST /slots/:slotId/dispatch` | ✅ | `slotController.dispatchSlot` | |
| `POST /orders/:orderId/deliver` | ✅ | `orderController.markDelivered` | |
| `GET /inventory` | — | `inventoryController.getInventory` | `?vendorId=&status=low|out` |
| `PATCH /menu-items/:itemId` | ✅ | `menuItemController.updateItem` | price / low-stock threshold |
| `POST /menu-items/:itemId/restock` | ✅ | `menuItemController.restockItem` | Any positive integer amount — see below |
| `GET /menu-items/:itemId/restock-log` | — | `menuItemController.getRestockLog` | |
| `POST /internal/sweep-slots` | 🔑 shared secret | — | Cron trigger for serverless deploys, see POOLING.md |

✅ = `requireAuth` (Supabase Auth bearer token, vendor session).

## Tables (inferred from queries — no migrations are checked into this repo)

- `hostels` — `id, name, blocks, created_at, updated_at`
- `vendors` — `id, name, hostel_id, prep_minutes, created_at, updated_at`
- `menu_items` — `id, vendor_id, name, category, price, mrp, unit, rating,
  rating_count, is_veg, art, tint, stock_qty, low_stock_threshold,
  created_at, updated_at`
- `slots` — `id, hostel_id, vendor_id, status (open|closed|dispatched),
  opens_at, closes_at, created_at, updated_at`
- `orders` — `id, slot_id, student_name, block, room, tip, payment_method,
  note, items (jsonb: [{menuItemId, qty}]), status
  (placed|pooled|dispatched|delivered), delivery_fee_charged, created_at,
  updated_at`
- `restock_logs` — `id, vendor_id, menu_item_id, amount, at`

**Gap:** none of this — table definitions, indexes, RLS policies, or the RPC
function bodies below — is version-controlled. It only exists in the live
Supabase project. See [BACKEND_NOTES.md](BACKEND_NOTES.md) for why that's
flagged as a risk, not just a style nitpick.

## RPC functions (Postgres, called via `supabase.rpc(...)`)

These exist so a read-check-write sequence that must be atomic happens in
one database transaction instead of racing across multiple round trips from
Node:

- **`close_slot(p_slot_id)`** — [utils/slotCloser.js](../backend/utils/slotCloser.js).
  Idempotent: closing an already-closed slot returns
  `{ alreadyClosed: true }` instead of erroring. Locks in the fee and order
  count at close time.
- **`dispatch_slot(p_slot_id)`** — [slotController.js](../backend/controllers/slotController.js).
  Only valid from `closed`; rejects with `SLOT_NOT_CLOSED:<status>` otherwise.
- **`place_order(p_slot_id, p_student_name, ..., p_items)`** — [orderController.js](../backend/controllers/orderController.js).
  Validates the slot is open, decrements stock for every line item, and
  inserts the order — all inside one transaction, so two students ordering
  the last unit of something can't both succeed.
- **`restock_item(p_item_id, p_amount)`** — [menuItemController.js](../backend/controllers/menuItemController.js).
  Atomically increments `stock_qty` and inserts a `restock_logs` row.
  `p_amount` just needs to be a positive integer — there is **no
  server-side restriction to preset values**; the +10/+25 buttons in the
  vendor console are a frontend convenience, and a custom-amount input
  next to them (added — see [BACKEND_NOTES.md](BACKEND_NOTES.md)) hits the
  exact same endpoint.

`markDelivered` deliberately does **not** use an RPC — see
[BACKEND_NOTES.md](BACKEND_NOTES.md) for why it used to race and how it was
fixed with a single conditional `UPDATE ... WHERE status = 'dispatched'`
instead of introducing a new database function.

## Auth

[middleware/requireAuth.js](../backend/middleware/requireAuth.js) expects
`Authorization: Bearer <supabase-access-token>` and calls
`supabase.auth.getUser(token)` to validate it — a network round trip to
Supabase Auth on every authenticated request. Student-facing and shared read
routes are public by design (ordering must stay frictionless); only vendor
mutations require a session.

## Config

[config/supabaseClient.js](../backend/config/supabaseClient.js) is a
module-level singleton Supabase client created with the **service-role**
key (full DB access, bypasses RLS) — this is a trusted-server client, never
exposed to either frontend. It throws at import time if `SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` are missing, which fails startup loudly instead
of limping along with a half-configured client.

See [backend/.env.example](../backend/.env.example) for every environment
variable the backend reads, including the ones added for the pool
scheduler and CORS allowlist (documented in [POOLING.md](POOLING.md) and
[BACKEND_NOTES.md](BACKEND_NOTES.md)).
