# Poolit — Overview

## The idea

Poolit is a **group food-ordering app for college hostels**. Each hostel is
served by one vendor at a time. Students order individually, but their orders
are pooled together into a shared, time-boxed window ("slot"), and the
**delivery fee per student drops as more students join the same pool**:

| Orders in the slot | Fee per student |
|---|---|
| 1–2  | ₹20  |
| 3–5  | ₹10  |
| 6–9  | ₹5   |
| 10+  | Free |

That live-dropping fee counter is the whole product hook — pooling only feels
worth it if the discount is visible and updates in real time as more people
join.

## The two users

- **Students** (mobile-first, [frontend/apps/student](../frontend/apps/student)) —
  pick their hostel, browse that hostel's vendor's menu, add items to a cart,
  place an order into the hostel's currently-open pool, and watch the live
  fee counter drop. After the pool closes they track the order through
  dispatch to delivery.
- **Vendors** (desktop-first, [frontend/apps/vendor](../frontend/apps/vendor)) —
  see every hostel's pools on one dashboard, close a pool early (or let the
  timer close it automatically — see [POOLING.md](POOLING.md)), see the
  consolidated pick list per pool, dispatch a closed pool, mark individual
  orders delivered, and manage menu item stock (restock with a preset or a
  custom amount, low-stock alerts).

## Where things live

```
poolit/
├── backend/                 Express + Supabase (Postgres) API — see ARCHITECTURE.md
├── frontend/
│   ├── packages/domain/     Shared types, business rules, API client
│   ├── apps/student/        Mobile quick-commerce app
│   └── apps/vendor/         Desktop admin console
└── docs/                    You are here
    ├── OVERVIEW.md          This file — what Poolit is and why
    ├── ARCHITECTURE.md      System design: schema, RPCs, request flow
    ├── POOLING.md            Slot lifecycle and the auto-close scheduler
    ├── BACKEND_NOTES.md     Bugs found + fixed, and what's still open
    └── ROADMAP.md           Phase history and what's next
```

## Where to start reading

- New to the project? Read this file, then [ARCHITECTURE.md](ARCHITECTURE.md).
- Working on pool timing/auto-closing? Read [POOLING.md](POOLING.md).
- Picking up backend work? Read [BACKEND_NOTES.md](BACKEND_NOTES.md) first —
  it lists what's already fixed and what's still a known gap, so you don't
  rediscover the same issues.
- Planning what's next? Read [ROADMAP.md](ROADMAP.md).
- Full local run instructions (env vars, seeding, three dev servers, creating
  a vendor login) stay in the top-level [README.md](../README.md).
- [BACKEND_HANDOFF_PROMPT.md](../BACKEND_HANDOFF_PROMPT.md) is the original
  (now superseded) MongoDB-era spec — still useful as a business-rules
  reference, not as an implementation guide.
