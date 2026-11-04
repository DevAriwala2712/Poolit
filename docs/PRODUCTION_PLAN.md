# Poolit — Production Readiness Plan

As of 4 Nov 2026 (architecture, scale and photo sections added; the rest as of 2 Nov 2026). Living version (with comments and the drawn roadmap): https://claude.ai/artifact/6VVhZgzxfnwiYuhkmitBr1

## Summary

Poolit is a working prototype; it now has a compressed three-week plan to pilot readiness (section "Three-week plan" below) with two developers; live payments additionally wait on gateway and registration approvals. The original 10–12 week phases remain below as the full roadmap. The blocking gaps are payments, student identity, per-store vendor access control, a version-controlled database schema, and Indian legal/compliance setup.

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
- [ ] "One order per student per pool" enforced inside `place_order` (the in-memory rate limiter only works per serverless instance).
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

**Headline findings** (assumptions: 15 hostels, 9,000 residents, 40% weekly active, 3 orders a week; all to be verified with the college):

- The stack is **not** capacity-limited. The busiest hour is about 390 orders (0.1 per second) and about 93 simultaneous users; even a hostile 60% adoption case needs under 30 requests a second. One Supabase project is enough.
- Vendor consoles polling every 5 seconds produce about 9 M requests a month, more than all students combined. Moving to 30 seconds is a one-line change.
- **Product photos are the real risk.** Raw phone photos would use 15–38× the included monthly bandwidth; resized WebP uses 6–11%. Resizing on the vendor's phone before upload is mandatory. Storage itself stays tiny: 600 products at two sizes is about 36 MB.
- Infrastructure costs about ₹0.08–0.10 per order. The payment gateway costs about 50× more.

| Decision | Verdict | S | P |
| --- | --- | --- | --- |
| Remove Express entirely | Yes, in weeks 2–3 behind a rollback switch; payments are built as Edge Functions from the start | ▰▰▰▰▰ | ▰▰▰▱▱ |
| `pg_cron` for pool rotation (replaces scheduler and sweep route) | Yes, first | ▰▰▰▰▰ | ▰▰▰▰▰ |
| Poll every 30 s plus refetch on tab focus | Yes | ▰▰▰▰▰ | ▰▰▰▰▰ |
| Public catalogue reads through RLS read policies | Yes | ▰▰▰▰▰ | ▰▰▰▰▱ |
| Orders and student data protected by function checks and RLS | Yes, week 1, gated by a cross-user test suite in CI | ▰▰▰▰▰ | ▰▰▰▱▱ |
| Product photos in Supabase Storage, resized to 400 px and 800 px on the phone | Yes | ▰▰▰▰▱ | ▰▰▰▰▱ |
| Separate S3 and paid CDN | Not until egress passes about 150 GB a month | ▰▰▰▰▰ | ▰▰▱▱▱ |
| `ALLOWED_ORIGINS` CORS allowlist | Yes, today | ▰▰▰▱▱ | ▰▰▰▰▰ |
| One-order-per-student-per-pool rule inside `place_order` (instead of Redis rate limiting for now) | Yes | ▰▰▰▰▰ | ▰▰▰▰▱ |
| Realtime for vendor new-order alerts | Week 2, first to be cut; polling is the fallback | ▰▰▰▰▱ | ▰▰▰▱▱ |
| Queues, caches, multi-region, microservices | No | ▰▱▱▱▱ | ▰▱▱▱▱ |

**Stop-gaps if time runs short:** vendors paste an image link (`image_url`) and the emoji tile covers the rest; keep short-interval polling rather than Realtime; ship the pilot on cash/UPI-on-delivery while gateway KYC completes.

## Three-week plan to pilot readiness

Target: by the end of week 3 the Express backend is retired, access control lives in the database (RLS and Postgres functions), payments run on Edge Functions in test mode, product photos work end to end, and the legal and documentation set is drafted and in review. Reasoning and numbers: [SCALE_AND_IMAGES_ANALYSIS.md](SCALE_AND_IMAGES_ANALYSIS.md).

**Honest feasibility.** Adding up the tables below gives about **36 developer-days** (week 1: 13, week 2: 14, week 3: 9). Two developers working full-time for three weeks have about 30. So the full list does **not** fit with no slack. Ways to make it fit, in order of preference:

1. Cut items 1–3 of the cut order below (Realtime, the Playwright suite, Edge Function refunds): saves about 3.5 days, giving about 32.5. Still tight; it needs some overtime or a third person for the legal-document drafting.
2. Or move the payment work (order states and Edge Functions, 5 days) to just after week 3 and run the pilot on cash or UPI-on-delivery recorded in the app. That gives about 27.5 days, which fits two developers with a little slack. This is the option I would choose, because the payment gateway's approval is the real gate for live payments anyway.
3. One developer cannot finish this in three weeks; plan on about six.

Three things outside our control can slip the *calendar* date regardless of code: company, GST, FSSAI and DLT registrations (weeks of government processing), the payment gateway's merchant KYC, and the college's MoU. Everything payment-related is built and tested in the gateway's test mode meanwhile. "Legal" here means drafted documents plus the in-app pieces, ready for a lawyer's review; it is not legal sign-off. The estimates are mine and have not been checked against how fast your team works, so re-estimate after the first two days.

Meters: **Conf.** is my confidence the item lands inside its week (five blocks is best).

### Day 0 and ongoing: non-code actions (owner, in parallel)

These start on day 1 because they have the longest lead times.

| Action | Why now | Lead time (estimate) |
| --- | --- | --- |
| Answer the open questions (marketplace vs resale, who delivers, payments mode, under-18 policy, launch campus) | Blocks payments design and legal text | Hours |
| Start company incorporation, then GST, then payment-gateway merchant account | Gateway KYC needs the company and bank account | Weeks |
| Start FSSAI applications (platform) and collect each store's FSSAI number | Required before launch | Weeks |
| DLT registration (sender ID, OTP template) through the SMS provider | Phone login cannot send real SMS without it | Days to weeks |
| Request the MoU meeting with the college/hostel administration | Required to deliver inside hostels | Weeks |
| File the "Poolit" trademark | Cheap, early | One sitting |
| Book a lawyer and a CA for week 3 review | Calendar availability | Days |

### Week 1: secure the database and prepare the move

Goal: the database can enforce every rule by itself, with automated proof.

| Task | Dev-days | Conf. |
| --- | --- | --- |
| Interim safety: `ENFORCE_VENDOR_SCOPING=true`, `ALLOWED_ORIGINS` on Vercel (protects the live system during the migration) | 0.25 | ▰▰▰▰▰ |
| Staging Supabase project; migrations applied by CI; seed script for staging | 1.5 | ▰▰▰▰▱ |
| Helper `vendor_role(vendor_id)` using `auth.uid()` and `vendor_users`; student helper using `auth.uid()` | 0.5 | ▰▰▰▰▰ |
| Convert the 35 Express routes into about 25 Postgres functions callable by signed-in users, each checking the caller inside (place order, restock, close/dispatch/deliver, menu items, barcodes, stock, staff, vendor settings, `vendor_overview`, `my_orders`) | 5 | ▰▰▰▱▱ |
| RLS read policies for hostels, stores, menu items and the current pool; no direct table access to orders, students, staff | 1.5 | ▰▰▰▰▱ |
| `pg_cron` pool rotation and closing (every minute); remove the in-process scheduler and `/internal/sweep-slots` from deployment | 0.5 | ▰▰▰▰▰ |
| "One order per student per pool" rule and quantity limits inside `place_order` | 0.5 | ▰▰▰▰▱ |
| **Security test suite in CI**: sign in as student A, student B, vendor X (store 1), vendor Y (store 2), anonymous; assert each can read and write only their own data. Fails the build on any leak | 2 | ▰▰▰▰▱ |
| Photos part 1: `menu_items.image_path`, Storage bucket, vendor-scoped upload policy, ten-photo size test | 1 | ▰▰▰▰▱ |
| Sentry on both apps; uptime check | 0.5 | ▰▰▰▰▰ |

**Gate to enter week 2:** the security suite passes on staging, and the ten-photo test meets the size limits (800 px ≤ 80 KB, 400 px ≤ 30 KB).

### Week 2: move the apps off Express, finish photos, build payments

Goal: both apps run with no Express traffic on staging; payments work in test mode.

| Task | Dev-days | Conf. |
| --- | --- | --- |
| Rewire `frontend/packages/domain/src/api.ts` (the single seam, 244 lines) to call Supabase functions and policies; keep a `VITE_BACKEND=express|supabase` switch so cutover and rollback are a config change | 3 | ▰▰▰▰▱ |
| Student app: direct catalogue reads, order placement, my orders, profile | (in the line above) | |
| Vendor console: overview, inventory, scan-to-restock, pools, staff, settings | (in the line above) | |
| Polling 5 s → 30 s plus refetch on tab focus | 0.5 | ▰▰▰▰▰ |
| Photos part 2: resize to 400 px and 800 px on the phone (WebP, JPEG fallback), upload in Add/Edit item, thumbnails in the student app, emoji tile fallback, real-iPhone test | 2 | ▰▰▰▰▱ |
| Order states `pending_payment` → `placed` / `expired`; stock reservation; `pg_cron` releases unpaid reservations after about 10 minutes; fee ladder counts paid orders only | 2 | ▰▰▰▱▱ |
| Edge Functions: `create-payment`, `payment-webhook` (raw-body signature check, unique `payment_id`, idempotent), `refund`; secrets in Supabase; region set near the database | 3 | ▰▰▰▱▱ |
| Phone OTP provider configured in staging (test numbers until DLT clears) | 0.5 | ▰▰▰▱▱ |
| Vendor Realtime for new-order alerts, with polling as fallback | 1 | ▰▰▰▱▱ |
| Playwright smoke tests: place order, pay (test mode), close pool, dispatch, deliver, scan-to-restock | 2 | ▰▰▰▱▱ |

**Gate to enter week 3:** on staging, a full order-to-delivery run passes with Express switched off, and the security suite still passes.

### Week 3: cut over, harden, and finish the legal and documentation set

Goal: production on the new backend, Express deleted after a stable window, legal drafts in review.

| Task | Dev-days | Conf. |
| --- | --- | --- |
| Capacity replay: 200 orders in 10 minutes on staging (pass: 95th percentile under 1 s) | 0.5 | ▰▰▰▰▱ |
| Production cutover: apply migrations, flip `VITE_BACKEND=supabase`, watch Sentry; retire Express after 48 stable hours, then remove the `backend/` deployment and its CI job | 1 | ▰▰▰▱▱ |
| Security review (checklist in the analysis doc), leaked-password protection and MFA for vendor accounts, log retention of at least 180 days, secrets audit | 1 | ▰▰▰▰▱ |
| Restore drill (Point-in-Time Recovery or backup restore) and runbooks: pool did not close, payments failing, API/database down | 1.5 | ▰▰▰▰▱ |
| In-app legal pieces: consent screen at sign-up with privacy notice link, Terms, Refund/Cancellation/Delivery policy and Grievance pages, data-deletion request flow, seller name/address/FSSAI shown on store pages, MRP/net quantity/manufacturer/country fields on items | 3 | ▰▰▰▱▱ |
| Documentation set (see below) written as drafts | 1.5 | ▰▰▰▰▱ |
| Pilot go/no-go review against the gates | 0.5 | ▰▰▰▰▰ |

**Legal and documentation drafts to finish in week 3** (each is a draft for a lawyer or CA to review, not a final legal instrument):

1. Terms of Use for students
2. Privacy Policy and consent notice (DPDP-aligned)
3. Refund, Cancellation and Delivery policy
4. Grievance Redressal page (officer name, contact, timelines)
5. Vendor/Seller Agreement (commission, payout schedule, TCS, FSSAI and stock-accuracy duties)
6. Rider Agreement (only if riders are used)
7. Data processing terms with Supabase, Vercel, the SMS provider and the payment gateway; record where data is stored
8. Information Security Policy and Incident Response Plan
9. College/Hostel MoU template
10. Engineering handoff: updated README, architecture diagram, runbooks, environment/secrets inventory

### If time runs short, cut in this order

1. Vendor Realtime (polling is fine)
2. Playwright suite (keep the security suite and one manual end-to-end checklist)
3. Edge Function refunds (refund by hand in the gateway dashboard for the pilot)
4. Live payments: ship the pilot with cash or UPI-on-delivery recorded in-app, while gateway KYC completes
5. Vendor staff roles beyond owner/staff

**Never cut:** the security test suite, RLS and function checks, the restore drill, the consent screen and policy pages, and the rollback switch. These are what make the pilot safe to run with real students' phone numbers and rooms.

### Pilot readiness gates (all must pass)

- Security suite green in CI; no table readable by `anon` except the public catalogue
- No Express traffic for 48 hours
- Replay test passes; Sentry error rate below 1% of requests
- Photos load at 400 px thumbnails under 30 KB on a mid-range phone
- Restore drill done once
- Consent, Terms, Privacy, Refund and Grievance pages live
- MoU signed for the pilot hostel(s)

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
- [ ] Rider Agreement (if applicable)
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

> Superseded for the near term by the [three-week plan](#three-week-plan-to-pilot-readiness). The table below is the original longer sequence; items it lists are now pulled into those three weeks where they appear in the plan.

Phase 1 starts once the open questions below are answered; each phase ends at a gate that must pass before the next begins. Registrations in Phase 2 take weeks of government processing, so file them at the start of Phase 1.

| Phase | When | Scope | Exit gate |
| --- | --- | --- | --- |
| Shipped | 2 Nov 2026 · done | Camera scanner (Android + iPhone + handheld); phone layout + installable PWA; error toasts, real sync status, backend 4xx/503 fixes | Open questions answered (model, delivery, payments, launch campus) |
| Phase 1 · Foundations | Weeks 1–4 | Schema + RPCs as migrations, staging and production projects; per-store vendor access, student phone OTP, rate limits; lean API endpoints, CI with tests, Sentry and uptime alerts | Security review passed; database restore drill completed |
| Phase 2 · Payments and compliance | Weeks 5–8 | UPI via a licensed aggregator with split settlement, refunds, webhooks; GST/TCS payout ledger, FSSAI and MRP fields, legal pages, grievance desk; company, GST, FSSAI and DLT registrations | Legal sign-off on policies; college/hostel MoU signed |
| Phase 3 · Pilot on one campus | Weeks 9–12 | Realtime updates and Web Push; support desk, runbooks, daily payment reconciliation; track orders per pool, delivery time, refund rate, stock accuracy | Go / no-go on pilot metrics, then expand to the next campuses |

The week counts assume one to two full-time developers. The detailed task lists for each phase are the checkboxes in the sections above.

## Open questions

These decisions change what gets built; each needs an answer before its phase starts.

- [ ] **Business model:** marketplace (stores sell, Poolit takes a commission) or Poolit buys and resells stock? This plan assumes marketplace; the other model changes GST, FSSAI and payment setup.
- [ ] **Who delivers?** Store staff, Poolit riders, or student runners? Decides rider app scope and gig-worker obligations.
- [ ] **Payments at launch:** UPI-only prepaid, or also cash on delivery? COD is simpler to start but complicates TCS and reconciliation.
- [ ] **Under-18 students:** allow them (needs verifiable parental consent under DPDP) or require 18+?
- [ ] **Launch campus and size:** which college first, how many hostels and stores? Sets capacity targets and the MoU to sign.
- [ ] **Vercel Pro / Supabase Pro budget:** approve roughly $45/month plus usage from Phase 1.
- [ ] **Native app stores:** is a home-screen PWA enough for year one, or is a Play Store listing a requirement?
- [ ] **Where the vendor console is deployed:** the `vercel.json` files assume each app's Vercel project uses its app folder (`frontend/apps/vendor`) as the root directory — confirm, or the deep-link rewrites won't apply.
