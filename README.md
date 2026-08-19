# Poolit

Pooled quick-commerce for college hostels. Students in the same hostel order in
a shared time window, and the **per-student delivery fee drops as more people
join the pool** — ₹20 → ₹10 → ₹5 → free.

This repo is a monorepo containing **two separate applications** plus the shared
business rules they both run on.

```
poolit/
├── packages/domain/     Shared business rules, types and mock store
├── apps/student/        Mobile quick-commerce app  (port 5173)
└── apps/vendor/         Desktop admin console      (port 5174)
```

## Running

```bash
npm install
```

The two apps run independently, on their own ports:

```bash
npm run dev:student
```

```bash
npm run dev:vendor
```

Other scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

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

## Shared domain (`packages/domain`)

Both apps import the same rules, so the two UIs can never drift apart on
business logic:

- **Fee ladder** — fee is a function of the number of *distinct orders* in a
  slot (not item quantity, not order value). Recomputed live while the slot is
  open; locked onto each order when it closes.
- **Slot lifecycle** — `open → closed → dispatched`. A slot closes on timer
  expiry or an explicit vendor action; closing locks every order's fee and
  moves it to `pooled`.
- **Order lifecycle** — `placed → pooled → dispatched → delivered`, never
  skipping a stage. The student app renders these as *Pooling → Preparing → On
  the way → Delivered*; the underlying states are unchanged.
- **Inventory** — placing an order decrements stock immediately; restocking is
  a vendor action with an audit log.

State is held in a React reducer and persisted to `localStorage`, so both apps
share data when opened in the same browser. See
[BACKEND_HANDOFF_PROMPT.md](BACKEND_HANDOFF_PROMPT.md) for the MongoDB backend
specification that replaces it.

## Known gap: product imagery

The student design calls for realistic product photography. This prototype
ships no image assets, so every product renders through
`apps/student/src/components/ProductArt.tsx` — a soft tinted gradient tile with
the product's emoji mark. Swapping in real photos means changing that one
component to render an `<img>`; every call site already passes the full product
through.
