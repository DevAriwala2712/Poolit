# Poolit — Production Readiness Plan

As of 4 Nov 2026 (architecture, scale and photo sections added; the rest as of 2 Nov 2026). Living version (with comments and the drawn roadmap): https://claude.ai/artifact/6VVhZgzxfnwiYuhkmitBr1

## Summary

Poolit is a working prototype; it now has a five-week Phase 1 (section "Plan: phases, weeks and dates" below) with two developers, ending in a pilot with a native Android student app; UPI payments and the compliance sign-offs follow in Phase 2 because they wait on gateway and registration approvals. The blocking gaps are payments, student identity, per-store vendor access control, a version-controlled database schema, and Indian legal/compliance setup.

Poolit is pooled quick-commerce for college hostels: students in one hostel order inside a shared time window, and the per-student delivery fee drops as the pool grows (₹20 → ₹10 → ₹5 → free). It has three parts: an Express + Supabase (Postgres) API on Vercel, a student web app, and a vendor console.

**Already shipped** (PR #1, commit `5bb4793`):

- A dedicated full-screen camera barcode scanner in the vendor console that works on Android **and iPhone**, plus USB/Bluetooth handheld scanners.
- The vendor console now works as a phone app: bottom tab bar with a central Scan button, card layouts, and installable as a PWA.
- Reliability fixes: failed actions are no longer silent, real sync status instead of fake labels, polling pauses in the background, crash guards, and backend error codes corrected.

All of it was verified end-to-end in a real Chromium browser at phone size with a simulated camera pointed at one of the repo's dummy barcodes: decode → item match → `+5` restock request sent → stock went from 3 to 8.

## Current state audit

The core business logic is sound: stock decrements, pool closing and dispatch already run as atomic Postgres functions, so two students can't buy the last unit. The weak points are around it: identity, data loading, and operations.

**Stack:** React 19 + Vite + Tailwind (two apps sharing a `domain` package), Express 4 on Vercel serverless (Singapore region), Supabase Postgres + Supabase Auth. The frontend polls the API every 5 seconds.

| Issue | Where | Impact | Status |
| --- | --- | --- | --- |
| Barcode scanning worked only in Chrome (`BarcodeDetector`); no iPhone/Firefox support | vendor `BarcodeScanModal` | Most vendors on iPhone couldn't scan | Fixed |
| No navigation at all below tablet width (sidebar hidden, no replacement) | vendor `Shell.tsx` | Console unusable on a phone | Fixed |
| Failed actions (restock, close pool, deliver) fail silently | all vendor screens | Vendor thinks stock was added when it wasn't | Fixed (toast on every failed write) |
| Fake status labels: "12s ago", "0ms lag", "Normal Rush"; Sync button did nothing | Shell, Dashboard | Misleading during an outage | Fixed (real last-sync time, offline banner) |
| Crash if the API returns zero stores (`vendors[0].id`) | `VendorContext` | White screen on a fresh database | Fixed |
| CORS rejection and malformed JSON returned HTTP 500 | `backend/app.js` | Noise in error tracking, wrong client handling | Fixed (403 / 400) |
| Auth check could throw when Supabase Auth is unreachable | `requireAuth.js` | Unhandled 500 | Fixed (503) |
| Polling continued in background tabs | domain `store.tsx` | Battery drain, wasted API quota | Fixed |
| Every poll refetches everything: N stores × (orders + current slot + every historical slot) | domain `fetchAll` | Load grows with order history; will hit limits within weeks of real use | Fixed — `GET /vendor/overview` (one request, 7-day window) |
| No new pool ever opens: only the seed script created slots | backend + DB | Ordering stops once the seeded pools close (all 5 hostels had no open pool on 2 Nov) | Fixed — automatic pool rotation |
| Any vendor login sees and edits every store | backend + console | A rival store can change your prices | Ready — migration applied and logins linked; turn on `ENFORCE_VENDOR_SCOPING=true` in Vercel |
| Students have no identity; `POST /slots/:id/orders` is public | backend | Fake orders can drain stock | Fixed in code — phone login; throttled to 30/min per IP |
| No payments; "payment method" is a text field | everywhere | Cannot go live | Open — Phase 2 |
| Schema, indexes, RLS and RPC function bodies exist only in the live Supabase project | repo | No reproducible environments, no rollback | Fixed — `supabase/migrations/` |
| No automated tests, no CI | repo | Regressions ship unnoticed | Fixed — 20 tests + GitHub Actions |
| Auth check is a network call to Supabase per request | `requireAuth.js` | Adds latency to every vendor action | Open — Phase 1 |
| Every student's browser downloads **all** orders (names, block, room) via public `GET /vendors/:id/orders` | domain `fetchAll`, backend | Privacy breach; a DPDP problem once live | Fixed in code — closes when `STUDENT_LOGIN_REQUIRED=true` after the new student app is deployed |
| Stray files: `test.md`, empty `backend/test` | repo root | Clutter | Fixed |

## Camera barcode scanner

The scanner is a dedicated full-screen page (`/scan`) built for a phone held in one hand at the shelf: point at a product, the item card slides up, tap `+5`, and the camera resumes for the next item.

**How it decodes:** it uses the phone's built-in `BarcodeDetector` when that supports retail formats (Chrome on Android). Everywhere else (iPhone Safari, Firefox) it loads a WebAssembly build of ZXing-C++ via the `barcode-detector` library. The 947 KB decoder file is bundled and served from our own domain (414 KB gzipped), loads only when the scanner opens, and is cached for offline use.

**What it does:**

- Reads EAN-13, EAN-8, UPC-A/E, Code 128, Code 39, ITF and QR codes.
- Rejects misreads: EAN/UPC codes must pass the check digit; other formats must read identically twice in a row.
- Decodes only the on-screen target box, downscaled, about 8 times a second, so older phones stay cool.
- Flashlight toggle and front/back camera switch where the phone allows it.
- Beep and vibration on a successful read.
- Continuous mode: after a restock it returns to the camera automatically (can be switched off).
- Unknown barcode → search your store's items and link the code in two taps; next time it restocks in one scan.
- The same barcode in several stores → prefers the active store, otherwise asks which one.
- A session log shows scans and total units added.
- USB and Bluetooth handheld scanners work on the same screen (they type the code + Enter; the page captures it).
- Typed entry remains as a fallback.
- Clear messages for each camera failure: permission denied, no camera, camera busy, or page not on HTTPS.
- The camera is released when the app goes to the background and re-acquired on return.

**Files:** `frontend/apps/vendor/src/screens/Scan.tsx`, `hooks/useBarcodeScanner.ts`, `lib/scanner.ts`.

**Constraint to know:** browsers only allow the camera on HTTPS (or `localhost`). Testing from a phone on the LAN over `http://192.168.x.x` will show the HTTPS message; use the deployed Vercel URL or an HTTPS tunnel.

**Generated barcodes and quantity tracking (added 2 Nov 2026):**

- Any item without a barcode can get one: per item (Inventory → "Generate barcode") or all at once ("Generate N missing barcodes"). Codes are EAN-13 in the GS1 "29" in-store range, so they never collide with a manufacturer's code; the database assigns them atomically and they are unique across stores.
- Labels: preview, print an A4 sheet (3 × 7 labels with name, price, MRP), or download an SVG.
- Scanning any barcode shows the live quantity with three actions: **Add stock**, **Set count** (stock take: type what's on the shelf) and **Remove** (damaged / expired / other). Every change is recorded with the before/after quantity and who made it (`stock_adjustments`); `GET /menu-items/:id/stock-history` returns restocks and adjustments together.
- Verified end to end: a printed label for the generated code `2900000000018` was decoded by the camera scanner, matched to its item, and a count of 46 was saved.

**Next steps for scanning:**

- [ ] Add a `barcodes` table (one item, many codes) so multipacks and alternate packaging map to one product.
- [ ] "Stock count" mode: scan everything on a shelf, then reconcile the counts in one go.
- [ ] Look up unknown EANs in a product database (e.g. GS1 India DataKart or Open Food Facts) to pre-fill name and MRP when creating new items.
- [ ] Make restock idempotent (client request ID) so a retry on bad Wi-Fi can't double-count.

## Mobile-first, installable vendor console

The vendor console now behaves like a phone app and can be installed to the home screen ("Add to Home Screen" on iPhone, "Install app" on Android) with no app-store release.

**Done:**

- Bottom tab bar on phones: Overview, Orders, a raised **Scan** button, Inventory, More. Badges show pending orders and low-stock counts.
- "More" sheet with store switcher, Settings/Analytics, live sync status and sign out.
- KPI cards two per row instead of one; inventory becomes a card list with large `+10` / `+25` / custom buttons instead of a sideways-scrolling table.
- Safe-area padding for notched phones, 16 px inputs so iOS doesn't zoom on focus, no tap flash or double-tap delay.
- PWA: web manifest with app shortcuts ("Scan to restock", "Orders"), PNG and maskable icons, and a service worker. The worker caches only the app shell and build files; live API data is never cached, so stock counts are never stale.
- `vercel.json` for both apps: deep links like `/scan` work on refresh, long-term caching for hashed files, and security headers (camera allowed for our own origin only).
- Real connection status: "Synced 12s ago", an offline banner when the API is unreachable, and an immediate refresh when the phone comes back online or the tab is reopened.
- Scanner and decoder code are split out of the main bundle (17 KB + decoder, loaded on demand).

**Still to do:**

- [x] Card layouts for the Orders list and the Overview's recent orders on phones (desktop layout unchanged: phone-only elements below the `md` breakpoint).
- [ ] Web Push notifications for new orders (supported on Android and on iPhone for installed PWAs, iOS 16.4+).
- [ ] Replace 5-second polling with Supabase Realtime subscriptions (see Production architecture).
- [ ] Code-split Analytics and charts; the main bundle is 550 KB (153 KB gzipped).
- [ ] Apply the same mobile pass and PWA setup to the student app.
- [ ] Optional later: wrap the PWA with Capacitor for Play Store / App Store listings if distribution needs it.

## Production architecture

Keep the current stack — Vercel + Express + Supabase is enough for the first 50+ hostels — and harden it, rather than rewriting. The changes below are ordered by risk removed per unit of effort.

### Data and schema

- [x] Export the live schema, indexes, RLS policies and the four RPC functions (`place_order`, `close_slot`, `dispatch_slot`, `restock_item`) into `supabase/migrations/`. From then on, every change is a reviewed migration. *(Done: exact history recovered, 7 migrations, byte-identical to the live project.)*
- [ ] Separate Supabase projects for staging and production, with migrations applied by CI.
- [x] Add a `vendor_users` table (user ↔ store, role: owner / staff) and check it on every vendor route. This closes the "any vendor edits any store" hole. *(Migration applied, logins linked; switch on with `ENFORCE_VENDOR_SCOPING=true` on Vercel.)*
- [x] Row Level Security on every table, and table/function grants revoked from the public `anon`/`authenticated` roles — the public key can't read or write anything directly. *(Add read policies later if Realtime is used from the browser.)*
- [x] Database functions hardened: pinned `search_path`; `place_order` rejects quantities outside 1–100 and `restock_item` amounts outside 1–10,000 at the database level.
- [ ] Turn on leaked-password protection and MFA in Supabase Auth settings (dashboard only).
- [x] Indexes: `orders(slot_id)`, `orders(status)`, `slots(hostel_id, status)`, `menu_items(vendor_id)` *(most already existed; the missing `slots(vendor_id)`, `restock_logs(menu_item_id, at)`, `staff(vendor_id)` applied)*; unique `menu_items(vendor_id, barcode)` already exists.
- [ ] Money in integer paise, every order line storing the price at the time of sale (today the bill is recomputed from the current menu price, so editing a price changes old receipts).
- [ ] Enable Supabase Point-in-Time Recovery (Pro plan) and test a restore once.

### API

- [x] Replace the frontend's `fetchAll` (N stores × orders × historical slots, every 5 s) with purpose-built endpoints. *(Vendor console: one `GET /vendor/overview` — 7 days + unfinished pools, scoped to the vendor's stores, fixed number of queries. Student app: public catalogue + `GET /me/orders` + live pool counts.)*
- [x] Pools open and rotate automatically (`ensure_open_slot`): previously only the seed script created pools, so ordering stopped for good once a pool closed.
- [ ] Analytics: the 14/30-day revenue trend is simulated ("wobble" numbers) except today — replace with a server-side daily revenue aggregate.
- [ ] Then switch live updates to Supabase Realtime (Postgres changes on `orders` and `slots`), keeping a 30–60 s poll as a fallback.
- [ ] Verify Supabase JWTs locally (JWKS) instead of calling Supabase Auth on every request.
- [ ] Input validation with a schema library (zod) on every route; consistent error shape `{ code, message }`.
- [ ] Idempotency keys on order placement, restock and payment callbacks.
- [ ] Rate limiting with a shared store (Upstash Redis): deferred; the database rule above covers the order-abuse case at pilot scale. *(Interim per-IP limiter on order placement shipped: 30/min, since a hostel often shares one IP.)*
- [ ] Pool closing and rotation via Supabase `pg_cron` calling `ensure_open_slot` every minute; then remove the in-process scheduler and `/internal/sweep-slots`. (Chosen over Vercel Cron: no plan limit, no extra cost.)
- [ ] Student and vendor polling from 5 s to 30 s, plus an immediate refetch when the tab becomes visible.
- [ ] Product photos: `menu_items.image_path`, Supabase Storage bucket with vendor-scoped upload policy, in-browser resize to 400 px and 800 px (WebP, JPEG fallback on Safari), one-year cache headers, emoji tile fallback.
- [ ] RLS read policies for hostels, stores, menu items and the current pool; student catalogue reads go direct to Supabase.
- [ ] Set `ALLOWED_ORIGINS` on Vercel to the two app URLs.
- [x] At most 3 orders per student per pool enforced inside the database (the in-memory rate limiter only works per serverless instance). *(Written and tested; not yet applied to the live project.)*
- [ ] Version the API (`/v1`) before a native app ever ships, so old app versions keep working.

### Identity

- [x] Stop exposing other students' orders: student app reads only its own orders (`GET /me/orders`); order lists become vendor-only with `STUDENT_LOGIN_REQUIRED=true`.
- [x] Students sign in with phone OTP (Supabase Auth). *(Built and tested; needs the Phone provider + a DLT-registered SMS sender enabled in Supabase — docs/PHASE1_RUNBOOK.md.)*
- [x] Orders tied to `student_id`, not a typed name; name, hostel, block and room saved per student (`students` table).
- [ ] Vendor staff invited by the store owner; roles enforced server-side.

### Observability and operations

- [ ] Error tracking (Sentry) on both apps and the API, with release tags.
- [ ] Structured JSON logs with a request ID; uptime check on `GET /` (Better Stack or UptimeRobot) paging a phone.
- [ ] Product analytics on the funnel: app open → cart → order → delivered.
- [ ] Runbooks: "payments failing", "pool didn't close", "API down", and a restore drill.

### Quality

- [x] GitHub Actions on every PR: typecheck, lint, build, unit tests.
- [x] Unit tests for the fee ladder (frontend/backend parity), barcode validation, rate limiter, vendor access, API error handling.
- [ ] Integration tests for the RPCs and order-state transitions against a local Supabase.
- [ ] Playwright smoke tests for: place order, close pool, dispatch, deliver, scan-to-restock.
- [ ] Preview deployments per PR pointed at the staging Supabase project.

### Rough monthly cost at launch

Approximate, from memory of list prices — confirm before budgeting.

| Item | Approx. cost |
| --- | --- |
| Supabase Pro (incl. PITR add-on later) | $25 + usage |
| Vercel Pro (needed for frequent cron, team seats) | $20 per member |
| Sentry, uptime monitoring | Free tiers at this scale |
| SMS OTP (India) | Roughly ₹0.15–0.25 per SMS |
| Payment gateway | ~2% per transaction; UPI often lower |

## Architecture decisions, scale and product photos

Full numbers and reasoning: [SCALE_AND_IMAGES_ANALYSIS.md](SCALE_AND_IMAGES_ANALYSIS.md). Meters: **S** = sustainable (keeps working and stays affordable as usage grows), **P** = practical (a one- or two-person team can ship and run it in the time available). Five blocks is best.

**Headline findings** (about 17 hostels and 11,000 residents, 40% weekly active, 3 orders a week; the active share is an assumption):

- The stack is **not** capacity-limited. The busiest hour is about 470 orders (0.13 per second) and about 113 people using the app at once; even a hostile 60% adoption case needs under 35 requests a second. One Supabase project is enough for load.
- The **free** Supabase plan is enough for a one- to three-hostel pilot. For the whole campus it runs out of monthly data transfer (5 GB) and database space (500 MB) within a few months, so plan to move to the $25 plan when a trigger in the analysis document is hit.
- Vendor consoles polling every 5 seconds produce about 10 M requests a month, more than all students combined. Moving to 30 seconds is a one-line change.
- **Product photos are the real risk.** Raw phone photos would use hundreds of times the free data transfer; resized WebP served through Cloudflare's free cache stays inside the free plan. Storage itself stays tiny: 600 products at two sizes is about 36 MB.
- Infrastructure on the paid plan costs about ₹0.04–0.10 per order; the free plan costs nothing but needs the safeguards in week 1.

| Decision | Verdict | S | P |
| --- | --- | --- | --- |
| Remove Express entirely | Yes, in weeks 1–3 behind a rollback switch; UPI payments are built as Edge Functions in Phase 2 | ▰▰▰▰▰ | ▰▰▰▱▱ |
| `pg_cron` for pool rotation (replaces scheduler and sweep route) | Yes, first | ▰▰▰▰▰ | ▰▰▰▰▰ |
| Poll every 30 s plus refetch on tab focus | Yes | ▰▰▰▰▰ | ▰▰▰▰▰ |
| Public catalogue reads through RLS read policies | Yes | ▰▰▰▰▰ | ▰▰▰▰▱ |
| Orders and student data protected by function checks and RLS | Yes, weeks 1–2, gated by a cross-user test suite in CI | ▰▰▰▰▰ | ▰▰▰▱▱ |
| Product photos in Supabase Storage, resized to 400 px and 800 px on the phone | Yes | ▰▰▰▰▱ | ▰▰▰▰▱ |
| Cloudflare free cache in front of the photo bucket (S3-style storage and a paid CDN are not needed) | Yes, week 3 | ▰▰▰▰▰ | ▰▰▰▰▱ |
| `ALLOWED_ORIGINS` CORS allowlist | Yes, today | ▰▰▰▱▱ | ▰▰▰▰▰ |
| At-most-3-orders-per-student-per-pool rule inside the order function (instead of Redis rate limiting for now) | Yes | ▰▰▰▰▰ | ▰▰▰▰▱ |
| Realtime for vendor new-order alerts | Phase 2; polling every 30 s until then | ▰▰▰▰▱ | ▰▰▰▱▱ |
| Queues, caches, multi-region, microservices | No | ▰▱▱▱▱ | ▰▱▱▱▱ |

**Stop-gaps if time runs short:** vendors paste an image link (`image_url`) and the emoji tile covers the rest; keep short-interval polling rather than Realtime; ship the pilot on cash/UPI-on-delivery while gateway KYC completes.

## Plan: phases, weeks and dates

Decisions from the owner on 4 Nov 2026 (see "Decisions made" at the end of this document): about 17 hostels and 10–12 thousand students, all 18+; delivery by store staff; cash on delivery (COD) and UPI both wanted; commission versus fixed charge per store is undecided; run on free plans as long as possible; a native student app and the vendor website are both in Phase 1; keep the current look and only smooth out inconsistencies. Numbers and reasoning: [SCALE_AND_IMAGES_ANALYSIS.md](SCALE_AND_IMAGES_ANALYSIS.md).

### At a glance

Dates assume a start on **Monday 9 Nov 2026** and **two full-time developers** (about 50 developer-days over five weeks). I do not know the real team size; if it differs, see "Changing the length" below.

| Phase | Weeks | Dates | What is done at the end | Exit gate |
| --- | --- | --- | --- | --- |
| **Phase 0** · Paperwork | Starts day 1, runs alongside everything | From 4 Nov | Registrations and agreements are in progress | Nothing blocks on it until Phase 2 |
| **Phase 1A** · Secure web pilot | Weeks 1–3 | 9–27 Nov | Express backend retired; access rules enforced by the database and proven by tests; product photos work; COD ordering works; legal drafts and in-app consent pages exist | **Milestone A (27 Nov):** web pilot-ready on the free stack |
| **Phase 1B** · Native app and polish | Weeks 4–5 | 30 Nov–11 Dec | Android student app; consistent UI across both apps; end-to-end tests; store listing in review | **Milestone B (11 Dec):** pilot launch go/no-go |
| **Phase 2** · UPI and compliance | Weeks 6–9 (depends on approvals) | From 14 Dec | UPI through a payment gateway; commission/fixed-fee settlement; legal sign-off; MoU | Gateway live; legal sign-off |
| **Phase 3** · Campus rollout | After Phase 2 | 2027 | All 17 hostels; move to paid Supabase when a trigger is hit | Pilot metrics |

**Why Phase 1 is five weeks, not three.** The three-week plan I gave earlier covered the backend change, security, photos and legal drafts (about 31 developer-days, now Phase 1A). Adding the native student app and the UI clean-up adds about 19 more. Two developers cannot do 50 days of work in 3 weeks (30 days).

**Changing the length:**

- **Three weeks, as originally asked:** needs about **3–4 developers**, or moving the native app and UI clean-up to after the pilot (Phase 1B becomes "week 4–5, after launch"). The web pilot is still fully usable on phones as an installable web app.
- **One developer:** about 10 weeks.

### Phase 0: paperwork (owner, from day 1, in parallel)

| Action | Why now | Lead time (estimate) |
| --- | --- | --- |
| Incorporate the company, then GST, then open a bank account | Gateway KYC, vendor agreements and the app-store organisation account all need it | Weeks |
| Start FSSAI application for the platform; collect each store's FSSAI number | Required before launch | Weeks |
| DLT registration (sender ID, OTP template) through the SMS provider | Phone login cannot send real SMS without it | Days to weeks |
| College/hostel MoU meeting | Required to deliver inside hostels | Weeks |
| Decide commission versus fixed charge with the first stores | Needed for the settlement design in Phase 2; the system will store either (see Week 2) | Whenever ready |
| Register a domain (about ₹800–1,000 a year) | Needed for Cloudflare hosting and the image cache | One sitting |
| Pay Google Play developer fee ($25, one time); decide on Apple ($99 a year) later | Google may require a closed test with 12 testers for 14 days before a new personal account can publish (verify the current rule); start early | Days |
| File the "Poolit" trademark; book a lawyer and a CA for week 3–5 | Cheap and early; calendar availability | Days |

### Phase 1A: secure web pilot (weeks 1–3)

**Week 1 (9–13 Nov): the database enforces the rules**

| Task | Dev-days |
| --- | --- |
| Interim safety on the live system: `ENFORCE_VENDOR_SCOPING=true`, `ALLOWED_ORIGINS` | 0.25 |
| Staging Supabase project; migrations applied by CI | 1.5 |
| Free-plan safeguards: a scheduled keep-alive request (free projects pause after about a week of inactivity, as happened on 2 Nov) and a nightly encrypted backup to a private Cloudflare R2 bucket (the free plan has no point-in-time restore) | 0.5 |
| Helper functions: caller's role in a store (`auth.uid()` plus `vendor_users`); caller's student identity | 0.5 |
| Convert the 35 Express routes into about 25 Postgres functions that check the caller inside | 5 |
| Public data (hostels, stores, menu, current pool) served by read-only functions; tables stay closed to the public roles with no policies, which leaves one door instead of two | 1.5 |
| `pg_cron` pool rotation and closing every minute | 0.5 |
| At most 3 orders per student per pool (a top-up is allowed, flooding is not) and quantity limits, inside the order function | 0.5 |
| **Total** | **10.25** |

**Week 1 status (updated 4 Nov 2026)**

| Item | Status |
| --- | --- |
| 32 `api_*` functions covering every Express route, same JSON shape as before (checked row-by-row against the old serializers), plus the frozen price fields | **Applied to the live project** (migration `20261104122329`), checked there as anonymous, store owner and stranger |
| Access-control test suite (anonymous, two students, a stranger, store owner, store staff, another store's owner) in CI | Done; deliberately breaking five rules in a scratch copy made it fail each time |
| Pool rotation every minute | Already live: `poolit-sweep-slots` (from the `wonderful-fermi` branch). My duplicate was dropped; tests now cover that job |
| Keep-alive workflow for the free plan | Written; needs two repository secrets |
| Live migrations missing from this branch (`vendor_daily_revenue`, `idempotency_keys`, `order_price_snapshot`, `scheduled_jobs`) | Recorded in `supabase/migrations/` so the repo matches the live project |
| Staging Supabase project | Not started (needs your Supabase account) |
| Nightly encrypted backup to R2 | Not started (needs the R2 bucket and keys) |
| Interim flags on Vercel (`ENFORCE_VENDOR_SCOPING`, `ALLOWED_ORIGINS`) | Not started (your Vercel account) |
| Idempotency keys on order, restock and stock-adjust calls | Not ported: the live `idempotency_keys` table exists but the new functions do not use it yet. Week 2 |

**Week 2 (16–20 Nov): prove it, switch the apps, photos, COD**

| Task | Dev-days |
| --- | --- |
| Security test suite in CI: signed in as student A, student B, vendor X, vendor Y, anonymous; each may read and write only what they own; fails the build on any leak | 2 |
| Rewire `frontend/packages/domain/src/api.ts` (the single point both apps use to reach the backend) to Supabase; keep a `VITE_BACKEND=express\|supabase` switch for instant rollback | 3 |
| COD ordering: payment method per order, "cash collected" recorded by store staff on delivery, daily cash summary per store | 1.5 |
| Per-store commission settings: a type (percent or fixed per order) and a value, stored per store and applied to each delivered order in a ledger table; deciding the actual numbers can wait | 0.5 |
| Polling 5 s → 30 s plus refresh on tab focus | 0.5 |
| Photos: `image_path` column, Storage bucket, vendor-scoped upload policy; resize to 400 px and 800 px on the phone (WebP, JPEG fallback), upload in Add/Edit item, thumbnails in the student app, emoji fallback; ten-photo size test | 3 |
| **Total** | **10.5** |

**Week 2 status (updated 5 Nov 2026)**

| Item | Status |
| --- | --- |
| Photo bucket `product-images` (public read, 200 KB cap per file, WebP/JPEG only), `menu_items.image_path`, upload rule (a vendor can add files only to their own store's folder; nobody can overwrite or delete through the API), `api_set_item_image`, one picture shared by all stores for the same barcode | Written and tested locally (migration `20261105000000`); **not yet applied to the live project** |
| Picture type and address helper in the shared app code (`productImageUrl`), with tests | Done |
| Resize on the phone, upload, and the Add/Edit item screens | Next |
| Student app showing the picture in place of the emoji tile | Next |
| Switch both apps from Express to the database functions | Not started |
| Idempotency keys for the new order, restock and stock-adjust functions | Not started |

**Week 3 (23–27 Nov): cut over, harden, legal drafts** → *Milestone A*

| Task | Dev-days |
| --- | --- |
| Replay 200 orders in 10 minutes on staging (pass: 95th percentile under 1 s) | 0.5 |
| Production cutover: apply migrations, flip `VITE_BACKEND=supabase`, watch errors; delete Express after 48 stable hours | 1 |
| Security review, MFA for vendor accounts, leaked-password protection, secrets audit, log retention of at least 180 days | 1 |
| Restore drill from the nightly backup into staging; runbooks: pool did not close, orders failing, database down | 1.5 |
| Move the three frontends from Vercel Hobby (non-commercial use only) to Cloudflare Pages (free, commercial use allowed); put Cloudflare's cache in front of the photo bucket | 1 |
| Sentry on both apps; uptime check | 0.5 |
| In-app legal pieces: 18+ confirmation and consent screen at sign-up, Terms, Privacy, Refund/Cancellation/Delivery and Grievance pages, data-deletion request, store licence details on store pages, MRP/net quantity/manufacturer/origin fields on items | 3 |
| Vendor console flow for store-staff delivery (mark out for delivery, delivered, cash collected) checked on a phone | 0.5 |
| Documentation drafts (list below) | 1.5 |
| **Total** | **10.5** |

**Milestone A gate (27 Nov):** security suite green; no table readable by `anon` except public catalogue data; no Express traffic for 48 hours; replay test passed; restore drill done; consent and policy pages live.

### Phase 1B: native app and polish (weeks 4–5)

**Week 4 (30 Nov–4 Dec): student app on Android, UI foundations**

| Task | Dev-days |
| --- | --- |
| Wrap the existing student web app with Capacitor (same screens and look, no rebuild): project setup and build | 1 |
| Native behaviour: status bar and safe areas, hardware back button, splash screen and icons, haptics on key actions | 1.5 |
| Push notifications for order status through Firebase Cloud Messaging (free), triggered by an Edge Function | 2 |
| Signed Android build in GitHub Actions; deep links; offline start screen | 1.5 |
| Testing on at least three real Android phones | 1.5 |
| UI consistency, part 1: shared type scale, control heights, spacing and radii as tokens; shared loading, empty and error components; shared copy of duplicated code (toast, connection gate, auth, logo) | 2.5 |
| **Total** | **10** |

**Week 5 (7–11 Dec): finish, test, submit** → *Milestone B*

| Task | Dev-days |
| --- | --- |
| UI consistency, part 2: apply the tokens and shared components to every screen in both apps; before-and-after screenshots to prove nothing changed except the intended fixes | 3 |
| Playwright smoke tests: place a COD order, close pool, dispatch, deliver, collect cash, scan-to-restock | 2 |
| Play Store listing, privacy and data-safety forms, closed-test rollout; direct APK download from the website as a fallback | 1 |
| iPhone: polished install-to-home-screen flow for the web app (native iOS app waits for Phase 2 budget) | 0.5 |
| Self-host fonts; add a Content-Security-Policy header; split the vendor Analytics code out of the main bundle | 1 |
| Apply lawyer and CA feedback on the drafts | 1 |
| Pilot go/no-go review | 0.5 |
| **Total** | **9** |

**Milestone B gate (11 Dec):** all of Milestone A still true; Android app installed and tested on three phones; screenshots show no unintended visual change; smoke tests green; MoU signed for the pilot hostel(s).

### Phase 2: UPI and compliance (weeks 6–9, depends on approvals)

- UPI payments through a licensed payment gateway: Edge Functions for create-payment, webhook (signature check, idempotent) and refund; order states `pending_payment` / `placed` / `expired`; stock reservation with `pg_cron` expiry of unpaid orders; fee ladder counts paid orders only. About 5 developer-days, built in the gateway's test mode, live when KYC clears.
- Commission or fixed-charge settlement once decided: monthly store statement and invoice (ask the CA about GST on commission and about TCS when the platform does not collect payment itself).
- Vendor Realtime new-order alerts.
- Native iOS app if the budget allows ($99 a year).
- Legal sign-off on all documents; GST, FSSAI and DLT completed; MoU for each campus.

### Phase 3: campus rollout

Add hostels in waves. Move to paid Supabase on any of the triggers in the analysis document (monthly data transfer above 3.5 GB, database above 350 MB, a pause incident, or a need for point-in-time restore).

### Documentation set (drafts finished in week 3, reviewed in weeks 4–5)

Each is a draft for a lawyer or CA to review, not a final legal instrument.

1. Terms of Use for students
2. Privacy Policy and consent notice (DPDP-aligned)
3. Refund, Cancellation and Delivery policy
4. Grievance Redressal page (officer name, contact, timelines)
5. Vendor/Seller Agreement (commission or fixed charge, payout schedule, FSSAI and stock-accuracy duties, store staff delivering orders and handling cash)
6. Data processing terms with Supabase, Cloudflare, the SMS provider, Firebase and the payment gateway; record where data is stored
7. Information Security Policy and Incident Response Plan
8. College/Hostel MoU template
9. Engineering handoff: updated README, architecture diagram, runbooks, secrets inventory

The Rider Agreement is dropped: delivery is by store staff, so it is covered in the Vendor Agreement. Ask the lawyer whether any worker-protection rules apply to store staff delivering on the platform's behalf.

### If time runs short, cut in this order

1. Playwright suite (keep the security suite and a manual end-to-end checklist)
2. Push notifications (use in-app status only)
3. UI consistency part 2 (keep part 1's shared components)
4. Native app moves after the pilot (the web app is installable on phones)

**Never cut:** the security test suite, database access checks, the nightly backup and restore drill, the consent screen and policy pages, and the rollback switch.

## India compliance and business documentation

Poolit should launch as a **marketplace**: hostel stores remain the sellers, Poolit is the platform plus delivery coordinator, and money flows through an RBI-licensed payment aggregator. This keeps Poolit out of food-licence and payment-licence territory it can't yet carry. The registrations below are the minimum; have a CA and a lawyer confirm each one before launch — this section is a planning checklist, not legal advice.

| Area | What applies to Poolit | What to do | When |
| --- | --- | --- | --- |
| Company | Need a legal entity to sign vendor contracts and hold a payment-gateway account | Incorporate a Private Limited company (MCA SPICe+ form, gives PAN/TAN); open a current account | Before payments |
| GST | Every e-commerce operator must register under GST regardless of turnover (CGST Act s.24(x)), collect TCS on sellers' sales (s.52) and file GSTR-8 monthly; sellers on the platform must also register | GST + separate TCS registration; build TCS into the vendor payout ledger. The TCS rate was reported cut from 1% to 0.5% in July 2024 — confirm the current rate with a CA | Before first paid order |
| Food safety (FSSAI) | E-commerce food business operators need a Central licence; each store selling food needs its own FSSAI licence/registration, shown on the listing | Apply on FoSCoS; collect and display each vendor's FSSAI number (add a field + verification step in vendor onboarding) | Before launch |
| Consumer protection | Consumer Protection (E-Commerce) Rules, 2020: grievance officer named on the site, acknowledge complaints within 48 hours, resolve within one month; display seller name, address and licence details; clear return/refund policy; no fake reviews or manipulative design ("dark patterns") | Grievance page + in-app help; seller details on product pages; refund policy | Before launch |
| Packaged goods labelling | Legal Metrology (Packaged Commodities) rules require online listings to show MRP, net quantity, manufacturer and country of origin | Add `mrp`, `net_quantity`, `manufacturer`, `country_of_origin` to menu items; barcode lookup can pre-fill them | Phase 2 |
| Personal data | DPDP Act 2023 + DPDP Rules notified 13–14 Nov 2025; core duties (notice, consent, security safeguards, breach reporting, children's data, grievance handling) apply from about 13–14 May 2027 | Consent screen at sign-up, privacy notice, data-deletion request flow, breach-response runbook, data inventory. Students under 18 need verifiable parental consent — decide whether to allow under-18 accounts | Build into Phase 1; fully compliant before May 2027 |
| Cyber security | CERT-In directions (in force since June 2022): report specified incidents within 6 hours; keep ICT logs for a rolling 180 days | Log retention ≥ 180 days, synced clocks (NTP), incident contact registered | Phase 1 |
| Payments | RBI consolidated payment aggregator rules in a Master Direction (15 Sept 2025); marketplaces must not hold customer money themselves | Use a licensed PA (Razorpay, Cashfree, PayU) with its marketplace/split-settlement product so vendors are paid directly; full merchant KYC of vendors | Phase 2 |
| SMS OTP | Commercial SMS in India must use DLT-registered sender IDs and templates (TRAI rules) | Register entity, sender ID and OTP template on a DLT portal via the SMS provider | Before phone login |
| Campus permission | Delivery inside hostels needs the institution's consent | Written MoU or permission letter with each college/hostel administration | Per campus |
| Delivery staff | If Poolit engages riders, gig-worker social-security obligations under the Code on Social Security, 2020 may apply as states notify schemes | Rider agreement; accident insurance; confirm state rules with a lawyer | When riders are engaged |
| Brand | — | File a trademark for "Poolit" (classes 9, 35, 39) | Early; cheap |

### Legal documents to prepare

- [ ] Terms of Use (students)
- [ ] Privacy Policy + consent notice (DPDP-aligned, in plain English and Hindi/regional language as the campus needs)
- [ ] Refund, Cancellation and Delivery Policy
- [ ] Grievance Redressal page (officer name, email, phone, timelines)
- [ ] Vendor / Seller Agreement: commission, payout schedule, TCS deduction, FSSAI and stock-accuracy obligations, data handling
- [x] ~~Rider Agreement~~ not needed: store staff deliver (covered in the Vendor Agreement)
- [ ] Data Processing Agreements with Supabase, Vercel, the SMS provider and the payment aggregator; note where data is stored (Supabase region)
- [ ] Information Security Policy and Incident Response Plan (supports CERT-In and DPDP)
- [ ] College/Hostel MoU template

### Sources

From search results; the primary government pages could not be opened when this was written, so verify with the original notifications.

- DPDP Rules 2025: [Bar & Bench](https://www.barandbench.com/view-point/meity-notifies-final-digital-personal-data-protection-rules-2025), [Mondaq](https://www.mondaq.com/india/data-protection/1708164/digital-personal-data-protection-rules-2025-notified)
- GST e-commerce operators and TCS: [CBIC TCS flyer](https://cbic-gst.gov.in/hindi/pdf/e-version-gst-fliers/eflier-TCS-mechanism22062017.pdf), [GST Council TCS FAQ](https://www.gstcouncil.gov.in/sites/default/files/2024-02/faqs_tcs.pdf)
- FSSAI e-commerce: [Inc42](https://inc42.com/flash-feed/fssai-foodtech-license), [ClearTax](https://cleartax.in/s/e-commerce-fssai-food-license-registration)
- Consumer Protection (E-Commerce) Rules, 2020: [Khaitan & Co](https://khaitanco.com/thought-leaderships/Stricter-Regulations-on-E-Commerce-The-Consumer-Protection-E-Commerce-Rules-2020), [LiveLaw](https://livelaw.in/news-updates/consumer-protection-e-commerce-rules-2020-160398)
- CERT-In directions: [Linklaters](https://www.linklaters.com/insights/blogs/digilinks/2022/may/india-new-and-onerous-cyber-security-framework-and-breach-reporting-obligations)
- RBI Payment Aggregator Master Direction: [RBI](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12050), [Cyril Amarchand Mangaldas alert](https://www.cyrilshroff.com/wp-content/uploads/2025/10/Client-Alert-RBI-Introduces-Consolidated-Framework-for-Payment-Aggregators-3.pdf)
- Legal Metrology, TRAI DLT and gig-worker items are from general knowledge — approximate, confirm with counsel.

## Roadmap to completion

> Superseded for the near term by the [phase and week plan](#plan-phases-weeks-and-dates). The table below is the original longer sequence; items it lists are now pulled into those three weeks where they appear in the plan.

Phase 1 starts once the open questions below are answered; each phase ends at a gate that must pass before the next begins. Registrations in Phase 2 take weeks of government processing, so file them at the start of Phase 1.

| Phase | When | Scope | Exit gate |
| --- | --- | --- | --- |
| Shipped | 2 Nov 2026 · done | Camera scanner (Android + iPhone + handheld); phone layout + installable PWA; error toasts, real sync status, backend 4xx/503 fixes | Open questions answered (model, delivery, payments, launch campus) |
| Phase 1 · Foundations | Weeks 1–4 | Schema + RPCs as migrations, staging and production projects; per-store vendor access, student phone OTP, rate limits; lean API endpoints, CI with tests, Sentry and uptime alerts | Security review passed; database restore drill completed |
| Phase 2 · Payments and compliance | Weeks 5–8 | UPI via a licensed aggregator with split settlement, refunds, webhooks; GST/TCS payout ledger, FSSAI and MRP fields, legal pages, grievance desk; company, GST, FSSAI and DLT registrations | Legal sign-off on policies; college/hostel MoU signed |
| Phase 3 · Pilot on one campus | Weeks 9–12 | Realtime updates and Web Push; support desk, runbooks, daily payment reconciliation; track orders per pool, delivery time, refund rate, stock accuracy | Go / no-go on pilot metrics, then expand to the next campuses |

The week counts assume one to two full-time developers. The detailed task lists for each phase are the checkboxes in the sections above.

## Decisions made (4 Nov 2026)

| Question | Decision | What it changes |
| --- | --- | --- |
| Business model | Marketplace with the stores. Commission versus fixed charge **not decided yet** | Each store gets a configurable fee type and value, so the choice can wait. Settlement and invoicing are Phase 2. |
| Who delivers | Store staff | No rider app and no rider agreement; the vendor console carries the delivery steps (out for delivery, delivered, cash collected) |
| Payments | Both cash on delivery and UPI | COD ships first (Phase 1, no gateway needed); UPI follows when the gateway approves the account (Phase 2) |
| Age | Everyone is 18+ | No parental-consent flow; sign-up asks the student to confirm they are 18 or older |
| Launch campus | One campus: about 17 hostels, 10–12 thousand students | Capacity targets in the analysis document; pilot starts with one to three hostels |
| Hosting budget | Free as long as possible; paid Supabase if sustainable and needed | Free-plan safeguards in week 1; upgrade triggers in the analysis document |
| Native app | Native student app and the vendor website, both in Phase 1 | Android student app in weeks 4–5; iPhone uses the installable web app until the Apple fee is approved |
| UI | Do not redesign; smooth out and make consistent | UI consistency work in weeks 4–5, with screenshots to prove nothing else changed |
| Vendor console deployment | Checked from the repository | Findings in the analysis document, section 14 |

### Still open

- [ ] Commission or fixed charge, and the amounts.
- [ ] Team size and start date (the dates above assume two developers starting 9 Nov).
- [ ] Whether to pay Apple's $99 a year for a native iPhone app.
- [ ] The campus's name and the pilot hostels.
