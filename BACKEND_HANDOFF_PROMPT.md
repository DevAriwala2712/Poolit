# Poolit — Backend Implementation Brief (MongoDB)

> **Superseded:** the backend now runs on Supabase (Postgres), not MongoDB —
> see the README's setup instructions. This doc is kept as historical context
> for the business rules and original data-shape design; the MongoDB-specific
> implementation notes below no longer reflect `backend/`.

Hand this whole document to whoever is building the backend. It explains what
Poolit is, the exact business rules it depends on, the data shapes the
frontend already expects, and a concrete MongoDB-backed implementation plan.
The frontend is a working React + TypeScript prototype today, with all state
living in a client-side reducer + `localStorage`. Your job is to replace that
fake backend with a real one — same behavior, same data shapes, now durable
and multi-user.

---

## 1. What Poolit is

Poolit is a **group food-ordering app for college hostels**. Each hostel has
exactly one food vendor. Students order individually, but their orders are
**pooled together into a time-boxed slot**, and the **delivery fee per
student drops as more people join the same pool**. That live-dropping fee
counter is the entire product hook — it's the thing that makes pooling feel
worth it instead of just ordering alone.

There are two user types, with two very different UIs:

- **Students** (mobile-first): pick their hostel, browse that hostel's
  vendor's menu, add items to a cart, place an order into the hostel's
  currently-open pool, and watch the live fee counter as more students join.
  After the pool closes they track their order through dispatch to delivery.
- **Vendors** (desktop-first): see all their hostels' pools in one dashboard,
  manually close a pool early (or let the timer do it), see the consolidated
  pick list (total quantity per menu item across every order in the pool),
  mark a pool dispatched, mark individual orders delivered, and manage menu
  item stock (restock, low-stock alerts).

Today all of this runs against an in-memory reducer
(`src/domain/store.tsx`) seeded with fake data
(`src/domain/seed.ts`) and persisted only to `localStorage`. There is
**no real backend, no auth, no multi-device consistency** — that's what
you're building.

---

## 2. Core business rules (do not change these silently)

These are the rules the entire frontend is built against. If you think one
should change, flag it — don't just reinterpret it while building the API.

### 2.1 The delivery-fee ladder

Fee per student is based on the **count of distinct orders currently in the
same slot** — not total item quantity, not total money spent.

| Orders in slot | Fee per student |
|---|---|
| 1–2 | ₹20 |
| 3–5 | ₹10 |
| 6–10 | ₹5 |
| 10+ | Free (₹0) |

Reference implementation (`src/domain/feeLadder.ts`):

```ts
function feeForOrderCount(orderCount: number): number {
  if (orderCount <= 0) return 20;
  if (orderCount <= 2) return 20;
  if (orderCount <= 5) return 10;
  if (orderCount <= 10) return 5;
  return 0;
}
```

This must be **recomputed live** while a slot is open — every order
currently in the pool shows the *current* fee based on the *current* pool
size, not the fee at the moment that order was placed. The fee only locks in
once the slot closes (see 2.2).

### 2.2 Slot lifecycle

`open` → `closed` → `dispatched`

- A slot is `open` for `SLOT_DURATION_MINUTES` minutes from `opensAt`
  (currently a constant, `= 10`, chosen for demo purposes — it stands in for
  a real meal-time window like "dinner orders open 6:00–6:45pm").
- Students can only add orders to a slot while it is `open`.
- A slot transitions `open → closed` when **either** its timer expires
  **or** the vendor manually closes it early. On this transition:
  1. Compute `fee = feeForOrderCount(ordersInSlot.length)` using the final
     order count.
  2. Set `deliveryFeeCharged = fee` on **every** order in that slot (it's
     now locked and must never be recomputed again).
  3. Transition every order in the slot from `placed` → `pooled`.
  4. The consolidated pick list (total qty per menu item across all orders
     in the slot) becomes final at this point — it can be computed on the
     fly from the locked order set, doesn't need to be persisted separately
     unless you want a snapshot for audit purposes.
- A slot transitions `closed → dispatched` **only** via an explicit vendor
  action ("Mark dispatched"), after they've physically packed the order.
  This also transitions every `pooled` order in that slot to `dispatched`.
- **One vendor per hostel per slot.** Multi-vendor pooling per hostel is
  explicitly out of scope — don't design the schema in a way that implies
  it's coming (e.g. don't make `hostelId` → `vendorId` a many-to-many).

### 2.3 Order status lifecycle

`placed` → `pooled` → `dispatched` → `delivered`

- `placed`: student added items, slot is still open. Fee shown is the live,
  unlocked fee.
- `pooled`: slot has closed, `deliveryFeeCharged` is now locked, order is
  part of the final pick list.
- `dispatched`: vendor marked the whole slot as sent out.
- `delivered`: vendor marks the individual order received (this happens
  per-order, not per-slot, since delivery to individual rooms may be
  staggered).

**Never let an order skip a stage.** The API must reject any transition that
isn't the immediate next step in this sequence — the frontend assumes this
invariant everywhere (e.g. "Mark delivered" only ever appears for orders
that are currently `dispatched`).

### 2.4 Inventory / stock

Each menu item has a `stockQty` and a `lowStockThreshold`. Rules:

- Placing an order **decrements stock immediately** (at order-placement
  time, not at slot-close time) — this reflects real inventory depletion as
  orders come in, and lets other students see "Only 3 left" / "Out of
  stock" in near-real-time.
- Stock can never go negative. A line item's `qty` in a new order must never
  exceed the item's current `stockQty` — reject or clamp server-side even
  though the frontend already prevents this client-side (never trust the
  client).
- **Restocking** is a vendor action that adds a positive amount to
  `stockQty`. Log every restock (vendor, item, amount, timestamp) — the
  frontend already has a `RestockLogEntry` shape for this.
- `stockQty <= lowStockThreshold` (and `> 0`) → "low stock". `stockQty === 0`
  → "out of stock". Out-of-stock items can't be added to new orders.

### 2.5 What must never silently change

- The four-tier fee ladder and its thresholds.
- Fee being computed from **distinct order count**, not item quantity or
  order value.
- The one-vendor-per-hostel-per-slot assumption.
- The strict order-status sequence (no skipping stages).

If a future requirement needs one of these to change, that's a product
decision, not something to quietly reinterpret while wiring up the API.

---

## 3. Current data shapes (frontend TypeScript — your schema's source of truth)

These are the exact types the frontend already works with
(`src/domain/types.ts`). Your MongoDB documents should be able to serialize
into these shapes (or something the frontend's API client can trivially map
to these shapes) with minimal frontend rework.

```ts
type MenuCategory = "Mains" | "Snacks" | "Beverages" | "Desserts";

interface Hostel {
  id: string;
  name: string;
}

interface MenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number;          // in ₹, integer
  unit: string;            // e.g. "plate", "cup", "bowl", "piece"
  stockQty: number;
  lowStockThreshold: number;
}

interface Vendor {
  id: string;
  name: string;
  hostelId: string;        // 1:1 — this vendor is THE vendor for this hostel
  menu: MenuItem[];
}

type SlotStatus = "open" | "closed" | "dispatched";

interface Slot {
  id: string;
  hostelId: string;
  vendorId: string;
  status: SlotStatus;
  opensAt: number;          // epoch ms
  closesAt: number;         // epoch ms — opensAt + SLOT_DURATION_MINUTES
}

type OrderStatus = "placed" | "pooled" | "dispatched" | "delivered";

interface OrderLineItem {
  menuItemId: string;
  qty: number;
}

interface Order {
  id: string;
  slotId: string;
  studentName: string;
  items: OrderLineItem[];
  status: OrderStatus;
  deliveryFeeCharged?: number;   // undefined until slot closes, then locked
  createdAt: number;             // epoch ms
}

interface RestockLogEntry {
  id: string;
  vendorId: string;
  menuItemId: string;
  amount: number;
  at: number;                     // epoch ms
}

interface PickListLine {           // derived, not stored
  menuItemId: string;
  name: string;
  totalQty: number;
}
```

---

## 4. What the backend replaces, action by action

Everything below currently lives in `src/domain/store.tsx` as an in-memory
reducer. Each of these needs to become a real API endpoint with the same
semantics, but with server-side validation (never trust the client) and
atomic writes (multiple students can hit "place order" on the same slot at
the same moment — your writes need to handle that safely).

| Frontend action | What it must do server-side |
|---|---|
| **Place order** | Validate slot is `open`. Validate every line item's `qty <= stockQty` at that moment. Atomically decrement stock per item. Insert the order with `status: "placed"`. Return the created order (frontend needs the generated id back to track "my order"). |
| **Close slot** (vendor, or automatic on timer) | Validate slot is `open`. Count orders in slot → compute fee via the ladder. Set `deliveryFeeCharged` on every order in the slot. Transition slot → `closed`, every order → `pooled`. Must be idempotent / race-safe — see §6.1. |
| **Dispatch slot** (vendor) | Validate slot is `closed`. Transition slot → `dispatched`, every `pooled` order in it → `dispatched`. |
| **Mark order delivered** (vendor) | Validate order is `dispatched`. Transition → `delivered`. |
| **Restock item** (vendor) | Validate `amount > 0`. Atomically `$inc` the item's `stockQty`. Append a `RestockLogEntry`. |

There's also a demo-only `simulateJoin` action in the current prototype
(spawns a fake student order with a random item, for demoing the fee ladder
live). Decide with the product owner whether that's worth keeping as a
real endpoint (e.g. gated to a `demo: true` flag) or dropped entirely for
production — it's not core functionality.

---

## 5. MongoDB schema design

Recommended: **Node.js + Express + TypeScript + Mongoose**, to match the
frontend's language and keep types shareable.

### 5.1 Collections

**`hostels`**
```js
{
  _id: ObjectId,
  name: String,           // "Ganga Hostel"
}
```

**`vendors`**
```js
{
  _id: ObjectId,
  name: String,            // "Amma's Kitchen"
  hostelId: ObjectId,      // ref hostels, unique index — enforces 1:1
}
```

**`menuItems`** — a **separate collection**, not embedded in `vendors`.
This is a deliberate deviation from the frontend's current in-memory shape
(where `menu` is an array on `Vendor`). Reasons:
- Stock decrements need to be atomic, single-document `findOneAndUpdate`
  operations. Embedding menu items in an array on the vendor document means
  every stock change is an array-element update (`arrayFilters`), which is
  more error-prone under concurrent writes and harder to index well.
- A top-level collection lets you put a proper index on `vendorId` +
  `category`, and lets restock/low-stock queries run efficiently across all
  vendors at once (the vendor dashboard's Inventory view queries *all*
  vendors' items together).

```js
{
  _id: ObjectId,
  vendorId: ObjectId,       // ref vendors
  name: String,
  category: String,         // "Mains" | "Snacks" | "Beverages" | "Desserts"
  price: Number,
  unit: String,
  stockQty: Number,
  lowStockThreshold: Number,
}
```
Index: `{ vendorId: 1, category: 1 }`, and `{ vendorId: 1, stockQty: 1 }` for
low-stock queries.

When the API sends a `Vendor` to the frontend, join in its menu items
(`$lookup` or a second query) to match the `Vendor.menu: MenuItem[]` shape
the frontend expects — the frontend doesn't need to know you split them
into two collections.

**`slots`**
```js
{
  _id: ObjectId,
  hostelId: ObjectId,
  vendorId: ObjectId,
  status: String,          // "open" | "closed" | "dispatched"
  opensAt: Date,
  closesAt: Date,
}
```
Index: `{ hostelId: 1, status: 1 }` (find the current open slot for a
hostel), `{ status: 1, closesAt: 1 }` (find slots whose timer has expired —
see §6.2).

**`orders`**
```js
{
  _id: ObjectId,
  slotId: ObjectId,
  studentName: String,
  items: [{ menuItemId: ObjectId, qty: Number }],
  status: String,             // "placed" | "pooled" | "dispatched" | "delivered"
  deliveryFeeCharged: Number, // absent/null until slot closes
  createdAt: Date,
}
```
Index: `{ slotId: 1 }` (every read is "orders in this slot"), `{ slotId: 1,
status: 1 }`.

**`restockLog`**
```js
{
  _id: ObjectId,
  vendorId: ObjectId,
  menuItemId: ObjectId,
  amount: Number,
  at: Date,
}
```
Index: `{ vendorId: 1, at: -1 }`.

Use MongoDB's `_id` as the `id` the frontend expects — just `.toString()`
it in your API responses (frontend types treat `id` as an opaque string
already).

### 5.2 Suggested REST endpoints

```
GET    /hostels
GET    /hostels/:hostelId/current-slot        # the live open/closed slot + its vendor + menu
GET    /vendors/:vendorId
GET    /vendors/:vendorId/menu
GET    /slots/:slotId
GET    /slots/:slotId/orders
GET    /slots/:slotId/pick-list                # derived: qty per item across the slot's orders

POST   /slots/:slotId/orders                   # place order  { studentName, items }
POST   /slots/:slotId/close                    # vendor action (or system, on timer)
POST   /slots/:slotId/dispatch                 # vendor action
POST   /orders/:orderId/deliver                # vendor action

GET    /vendors/:vendorId/orders?status=       # vendor dashboard / order history across slots
GET    /vendors                                # all vendors, for the "all hostels" dashboard view
GET    /inventory?vendorId=&status=low|out     # cross-vendor inventory table (vendor dashboard)
POST   /menu-items/:itemId/restock             # { amount }
GET    /menu-items/:itemId/restock-log
```

Response shapes should match §3 as closely as possible so the frontend's
API client is a thin fetch wrapper, not a translation layer.

---

## 6. Critical implementation details — get these right

### 6.1 Atomic stock decrement (prevent overselling)

Two students placing orders for the last unit of an item at the same moment
is a real race condition. Don't read-then-write. Use a single atomic
operation that only succeeds if enough stock exists:

```js
const result = await MenuItem.findOneAndUpdate(
  { _id: itemId, stockQty: { $gte: qty } },
  { $inc: { stockQty: -qty } },
  { new: true }
);
if (!result) {
  // not enough stock — reject this line item / the whole order
}
```

Do this per line item, inside a MongoDB transaction alongside the order
insert (use a `mongoose` session / `client.startSession()`), so a
partially-failed multi-item order doesn't leave stock decremented for some
items but not others, and doesn't leave an order in the database with no
matching stock deduction.

### 6.2 Auto-closing a slot when its timer expires

The current frontend does this with a client-side `setInterval` — that
obviously can't be how the real system works once it's multi-user. Two
valid approaches, and you likely want both:

1. **Lazy evaluation (required, do this first):** any read of a slot (or
   any write attempt against it, like placing an order) should first check
   `if (slot.status === "open" && Date.now() >= slot.closesAt)` and, if
   true, run the close-slot logic (§2.2 step-by-step) *before* proceeding.
   This guarantees correctness even with zero background jobs — a slot can
   never be read or written as "open" after its time has passed.
2. **Background sweep (nice to have):** a cron job (e.g. `node-cron` or
   `agenda`) every 30–60s that finds `{ status: "open", closesAt: { $lte:
   now } }` and closes them. This makes the dashboard update promptly even
   when nobody happens to be reading/writing that slot — without it, a slot
   only closes the next time someone touches it, which is fine correctness-
   wise but can look stale on an idle vendor dashboard.

Either way, the actual "close" logic (lock fees, flip statuses) must be a
single idempotent function both paths call — don't duplicate it.

### 6.3 Fee locking is one-way

Once `deliveryFeeCharged` is set on an order, never recompute or overwrite
it. It's not derived data after that point — it's a historical fact ("this
student was charged ₹10 for this order"), even if, say, you later fix a bug
in the fee ladder function. Migrations that touch already-closed orders
should be a deliberate, separate decision, not a side effect of a code
change.

### 6.4 Order-status transitions must be validated, not assumed

Every status-changing endpoint should check the order/slot is in the
expected *current* state before transitioning, and reject (409, not 500) if
not — e.g. "Mark delivered" on an order that's still `placed` should fail
loudly, not silently no-op or crash. The frontend already only shows these
actions when the precondition holds, but the API must not assume the
frontend is the only caller.

### 6.5 Never trust client-sent prices or fees

The client sends `menuItemId` + `qty` when placing an order — **look up the
current price server-side**, don't accept a client-sent price. Same for the
fee: it's always server-computed from the ladder, never client-supplied.

---

## 7. Auth (currently missing — needs a decision)

The prototype has **no real authentication**:
- "Student identity" is just a name typed into a text field, remembered in
  `localStorage`. Nothing stops two students from using the same name, or a
  student from claiming someone else's order.
- The vendor dashboard has **no login at all** — anyone who knows the URL
  can close/dispatch any vendor's slots and restock any vendor's inventory.

This is fine for a demo, not for anything real. Recommended minimum for a
first real backend:
- **Students:** lightweight auth tied to their college identity — e.g.
  email/phone OTP, or SSO if the college has one. This also solves "find my
  order across devices" for free (query orders by authenticated student id
  instead of a name string).
- **Vendors:** simple email+password or magic-link login, with each vendor
  account scoped to exactly one `vendorId` (matches the one-vendor-per-
  hostel model) so a vendor's JWT/session can be checked against
  `order.slotId → slot.vendorId` on every vendor-only mutation.

Flag this explicitly to whoever's building it — it's a real gap, not a nice-
to-have, before this goes anywhere beyond a demo.

---

## 8. Seeding

Mirror `src/domain/seed.ts` for your seed script so the existing demo data
(5 hostels, 5 vendors, ~13 menu items each across the 4 categories, a mix of
healthy/low/out-of-stock items, a few live open slots with orders already in
them, plus a couple of historical dispatched slots) continues to work
out of the box once the frontend is pointed at the real API. This isn't
required to match byte-for-byte, but keeping recognizable hostel/vendor/item
names makes it much easier to sanity-check the migration side by side with
the current prototype.

---

## 9. Definition of done

- [ ] All 5 collections modeled and indexed as above.
- [ ] Every endpoint in §5.2 implemented, validated server-side per §6.
- [ ] Stock decrements are atomic and transactional with order creation.
- [ ] Slot auto-close works via lazy evaluation at minimum.
- [ ] Fee is always server-computed, never client-supplied, and locks
      permanently at slot close.
- [ ] Order status transitions are validated against the current state.
- [ ] Seed script produces a working demo dataset.
- [ ] A written decision (even if "not yet") on the auth gap in §7.
