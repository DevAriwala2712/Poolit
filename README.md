# Poolit

Pooled quick-commerce for college hostels. Students in the same hostel order in
a shared time window, and the **per-student delivery fee drops as more people
join the pool** — ₹20 → ₹10 → ₹5 → free.

```
poolit/
├── backend/                Express + Supabase (Postgres) API (port 5057)
└── frontend/
    ├── packages/domain/    Shared types, rules, API client
    ├── apps/student/       Mobile quick-commerce app      (port 5173)
    └── apps/vendor/        Desktop admin console          (port 5174)
```

## Running the stack

You'll run three processes at once (backend, student app, vendor console) —
open a separate terminal tab for each.

### 1. Backend (terminal 1)

```bash
cd backend && npm install && cp .env.example .env
```

Open `backend/.env` and fill in `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
from your Supabase project (Project Settings → API in the Supabase dashboard).

Seed the database (safe to re-run — it clears and reseeds demo data) and
start the server:

```bash
npm run seed
npm run dev
```

The API is now live at `http://localhost:5057` — leave this terminal running.
(Default port is 5057, not 5000, because macOS's AirPlay Receiver squats on
5000. Override with `PORT=<port>` in `backend/.env` if 5057 is also taken.)

### 2. Student app (terminal 2)

```bash
cd frontend && npm install
npm run dev:student
```

Opens at `http://localhost:5173`.

### 3. Vendor console (terminal 3)

```bash
cd frontend && npm run dev:vendor
```

Opens at `http://localhost:5174`. (Skip `npm install` here if you already ran
it for the student app — it installs once for the whole `frontend/` workspace.)

Both frontend apps read `VITE_API_URL` (defaults to `http://localhost:5057`,
matching the backend above). To point either app at a different backend URL,
copy `.env.example` to `.env` inside that app's directory and edit it.

Other frontend scripts: `npm run build`, `npm run typecheck`, `npm run lint`.

### Vendor login

The vendor console requires signing in (Supabase Auth, email + password) —
the student app stays fully public. To create a vendor account, run this once
from `backend/` (needs `SUPABASE_SERVICE_ROLE_KEY` set, as above):

```bash
node -e "
require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
supabase.auth.admin
  .createUser({ email: process.argv[1], password: process.argv[2], email_confirm: true })
  .then(({ data, error }) => console.log(error ? error.message : \`Created: \${data.user.email}\`));
" you@example.com "a-strong-password"
```

Sign in at `http://localhost:5174` with that email/password. Add more vendor
users the same way — there's currently no self-serve signup or per-store
scoping (every vendor login sees every store, same as the store-switcher
already in the UI).

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
- **Partial authentication.** The vendor console requires login (Supabase
  Auth, email + password) and the backend rejects unauthenticated vendor
  mutations (close/dispatch a slot, mark delivered, restock, edit price).
  Student identity is still just a name typed into a field — deliberately, so
  ordering stays frictionless — and every logged-in vendor can see every
  store (no per-store account scoping yet).
- **Riders are static.** The tracking screen's rider is a constant in
  `frontend/packages/domain/src/constants.ts` — there's no dispatch service yet.
