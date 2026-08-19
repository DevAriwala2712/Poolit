# Poolit

Pooled quick-commerce for college hostels. Students in the same hostel order in
a shared time window, and the **per-student delivery fee drops as more people
join the pool** — ₹20 → ₹10 → ₹5 → free.

```
poolit/
├── backend/                Express + MongoDB API          (port 5000)
└── frontend/
    ├── packages/domain/    Shared types, rules, API client
    ├── apps/student/       Mobile quick-commerce app      (port 5173)
    └── apps/vendor/        Desktop admin console          (port 5174)
```

## Running the stack

**1. Backend**

```bash
cd backend && npm install && cp .env.example .env
```

Fill in `MONGO_URI` in `backend/.env`, then seed and start:

```bash
cd backend && npm run seed && npm run dev
```

**2. Frontend** — the two apps run independently, on their own ports:

```bash
cd frontend && npm install
```

```bash
cd frontend && npm run dev:student
```

```bash
cd frontend && npm run dev:vendor
```

Both apps read `VITE_API_URL` (default `http://localhost:5000`). Copy
`.env.example` inside either app directory to override it.

Other frontend scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

## The two apps

### Student app — mobile quick-commerce

**Fresh Minimal + Soft Organic.** Warm cream ground (`#F8F5F0`), lime accent
(`#A8E10C`) for pooling/positive states, coral (`#FF5A4E`) for primary CTAs,
charcoal text. 8pt grid, 44pt minimum touch targets, safe-area aware.

Screens: onboarding (3 slides + location), home (location bar, search, category
rail, offers carousel, frequently-bought rail, trending grid), categories/search
with a filter sheet, product detail, cart with bill summary, checkout
(address, payment, tip, notes), live order tracking, orders history with
reorder, and profile (wallet, favourites, address, hostel switch).

### Vendor console — desktop admin

**Dark-first Minimal SaaS / Quiet Chrome.** Near-black ground (`#0F0F11`),
layered card surfaces, hairline borders, one vivid lime accent reserved for
CTAs and positive status. Collapsible sidebar, ⌘K command palette, ⌘B to
toggle the sidebar.

Screens: dashboard (KPIs, live pools, stock alerts, orders-by-hour, top
sellers, recent orders), orders (filterable table, bulk actions, detail drawer
with the full run pick list), inventory (cross-store table, inline price edit,
quick restock), analytics (revenue trend, volume by hour, peak-hours heatmap,
hostel breakdown), and settings.

## Business rules

Enforced server-side in `backend/`, mirrored in `frontend/packages/domain` so
both UIs agree:

- **Fee ladder** — fee is a function of the number of *distinct orders* in a
  slot (not item quantity, not order value). Recomputed live while the slot is
  open; locked onto each order when it closes.
- **Slot lifecycle** — `open → closed → dispatched`. A slot closes on timer
  expiry (lazily, on any read or write that touches it) or an explicit vendor
  action; closing locks every order's fee and moves it to `pooled`.
- **Order lifecycle** — `placed → pooled → dispatched → delivered`, never
  skipping a stage. Invalid transitions are rejected with a 409. The student
  app renders these as *Pooling → Preparing → On the way → Delivered*; the
  underlying states are unchanged.
- **Inventory** — placing an order decrements stock atomically inside a
  transaction, so concurrent orders can't oversell. Restocking is a vendor
  action with an audit log.

The frontend polls the API every 5s, so a vendor closing a pool shows up on the
student's tracking screen without a reload.

See [BACKEND_HANDOFF_PROMPT.md](BACKEND_HANDOFF_PROMPT.md) for the original
backend specification.

## Known gaps

- **Product imagery.** The student design calls for realistic product
  photography; this prototype ships no image assets, so products render through
  `frontend/apps/student/src/components/ProductArt.tsx` — a tinted gradient tile
  with the product's emoji. Swapping in real photos is a one-component change.
- **No authentication.** Student identity is a name typed into a field; the
  vendor console has no login at all. Both are noted in the handoff doc as the
  first thing to add before this goes anywhere real.
- **Riders are static.** The tracking screen's rider is a constant in
  `frontend/packages/domain/src/constants.ts` — there's no dispatch service yet.
