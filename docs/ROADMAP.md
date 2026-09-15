# Roadmap / continuity notes

A short history of what's been done and what's logically next, so a new
session (human or agent) can pick up without re-deriving context from git
log and code archaeology.

## Phase history

1. **Frontend prototype** — React + TypeScript, both apps working against
   an in-memory reducer + `localStorage`, no real backend. Business rules
   (fee ladder, slot/order lifecycle, inventory rules) were designed here
   first and specified in [BACKEND_HANDOFF_PROMPT.md](../BACKEND_HANDOFF_PROMPT.md).
2. **Backend on MongoDB** — first real backend, per the handoff doc. Later
   superseded.
3. **Migrated to Supabase (Postgres)** — commit `9bd56ce` ("Migrate backend
   from MongoDB Atlas to Supabase"). Current backend architecture — see
   [ARCHITECTURE.md](ARCHITECTURE.md).
4. **Vendor authentication** — commit `d76866a` (Supabase Auth for the
   vendor console).
5. **Vendor console UI revamp** — commit `c3bd907`.
6. **Deploy to Vercel** — commit `2c0f6df`.
7. **This pass** —
   - Custom restock amount in the vendor Inventory screen (previously only
     fixed +10/+25 presets existed; the backend already accepted any
     positive integer, so this was purely a frontend gap).
   - Automated pool-closing: [utils/poolScheduler.js](../backend/utils/poolScheduler.js)
     + `POST /internal/sweep-slots` for serverless. Previously slots only
     closed as a side effect of a client happening to poll them. See
     [POOLING.md](POOLING.md).
   - Backend fixes: `markDelivered` race condition, N+1 query in
     `GET /vendors`, configurable CORS allowlist, removed a dead file. See
     [BACKEND_NOTES.md](BACKEND_NOTES.md) for the full list including what
     was deliberately left open and why.
   - This `docs/` directory.

## Known gaps carried forward (from the README, still true)

- No product imagery — student app renders an emoji tile, not photos.
- No per-store vendor account scoping — every vendor login sees every
  store.
- Riders are static (no real dispatch/courier service).
- Schema and RPC function bodies live only in the Supabase project, not in
  this repo (see BACKEND_NOTES.md).

## Logical next steps

Roughly in order of "cheap and clearly worth it" → "bigger, needs a
decision first":

1. Export the live Supabase schema + RPC function bodies into a checked-in
   `backend/sql/` directory (see BACKEND_NOTES.md — flagged, not done,
   needs live schema access to do accurately).
2. Local JWT verification for `requireAuth` instead of a network call per
   request — needs `SUPABASE_JWT_SECRET` configured and tested against a
   real login before trusting it (see BACKEND_NOTES.md).
3. Per-store vendor account scoping (right now every vendor sees every
   store — fine for a single-operator demo, not for multiple real vendors).
4. Pagination on the list endpoints once real order volume shows up.
5. Real product imagery.
6. A real dispatch/courier integration to replace the static rider.

## Where to update this file

Add a dated entry under "Phase history" when a meaningfully-sized chunk of
work lands (a feature, a migration, a significant refactor) — not for every
commit. Keep "Known gaps" and "Logical next steps" in sync with
[BACKEND_NOTES.md](BACKEND_NOTES.md) and the README's "Known gaps" section
rather than duplicating detail — link, don't re-explain.
