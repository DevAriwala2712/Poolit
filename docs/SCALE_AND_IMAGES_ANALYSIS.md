# Poolit — Scale, Cost and Product-Photo Analysis

As of 4 Nov 2026. Companion to [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md). It answers three questions with numbers:

1. How much traffic can Poolit realistically get at Thapar, and is the current stack enough?
2. Are modern phone photos too big for product images, and what should we do about it?
3. What should we build in the next few weeks, and what should we deliberately leave alone?

## How to read this document

- Everything marked **assumption** is a guess to replace with real data after the pilot. The model is a short script, so it is easy to rerun with better inputs.
- Vendor prices and free-tier limits are **from memory of public list prices** and move often. Confirm each on the vendor's pricing page before budgeting.
- Image file sizes are **typical ranges, not measurements of Poolit's own photos**. Section 5 has a ten-photo test that replaces them with real numbers.
- Ratings use five blocks. **Sustainable** means it keeps working, and stays affordable, as usage grows without constant attention. **Practical** means a one- or two-person team can build and run it in the time available.

```
▰▰▰▰▰  excellent      ▰▰▰▱▱  acceptable      ▰▱▱▱▱  avoid
```

## 1. Bottom line

| Question | Answer |
| --- | --- |
| Is the current stack big enough for all of Thapar? | **Yes, by a wide margin.** The busiest evening needs about 12–28 requests per second even with the current 5-second polling. A single small Supabase project handles that. |
| Is the traffic the risk? | **No. Product photos are.** Unprocessed phone photos would use roughly 10–40× the included bandwidth. Resized photos use about 10% of it. |
| Do we need to remove the Vercel backend to scale? | **No.** Scale does not require it. The reasons to simplify are cost, fewer moving parts and the cron limit, and they can be handled in steps. |
| Biggest hidden cost? | Vendor consoles polling every 5 seconds: about 9 M requests a month, more than all students combined. Slowing this is a one-line change. |
| Infrastructure cost per order? | About ₹0.08–0.10. The payment gateway (about ₹5 on a ₹250 basket) costs roughly 50× more. Infrastructure is not where money is lost. |

## 2. Assumptions

### 2.1 Campus size (verify with the college)

I do not have verified figures for Thapar. These are planning numbers.

| Input | Value | Why |
| --- | --- | --- |
| Hostels with a store | 15 | Planning figure for a large residential campus; the seed data has 5 |
| Hostel residents | 9,000 | About 600 per hostel |
| Weekly active users (WAU) | 20% pilot, 25% base, 40% good, 60% stress | Quick-commerce adoption on a captive campus; 60% is a deliberately hostile case |
| Orders per active user per week | 3 | Snack and essentials ordering |
| App sessions per active user per week | 6 | About two sessions per order (browse, order, track) |
| Foreground time per session | 3 minutes | Polling only runs while the app is visible |
| Busiest hour share | 25% of a day's orders, 20% of a day's sessions | Evening cluster (about 9–11 pm) |
| Burst factor inside that hour | 3× | Pools close on timers, so people arrive together |
| Rows per order | 4 (1 order plus about 3 lines) at about 250 bytes | Small |

### 2.2 Scenarios

| Scenario | Hostels | Active users | Orders / day | Orders / month | Orders in busiest hour |
| --- | --- | --- | --- | --- | --- |
| Pilot | 2 | 200 | 86 | 2,600 | 21 |
| Campus, base | 15 | 2,250 | 964 | 29,200 | 241 |
| Campus, good | 15 | 3,600 | 1,543 | 46,800 | 386 |
| Stress | 15 | 5,400 | 2,314 | 70,100 | 579 |

## 3. Traffic and database load

### 3.1 Concurrent users and requests per second

Concurrent users are the average foreground sessions in the busiest hour, multiplied by the 3× burst factor. The "5 s" column is today's behaviour (12 requests a minute per open app). The "30 s" column is the proposed one (2 a minute).

| Scenario | Peak concurrent users | Student requests/s at 5 s polling | At 30 s polling |
| --- | --- | --- | --- |
| Pilot | 5 | 1.0 | 0.2 |
| Campus, base | 58 | 11.6 | 1.9 |
| Campus, good | 93 | 18.5 | 3.1 |
| Stress | 139 | 27.8 | 4.6 |

Orders themselves are tiny: 579 in the busiest hour is **0.16 orders per second**. Even if a whole hostel's pool closed at once, that is a burst of a few dozen writes.

**Conclusion:** one small Postgres instance and a few serverless functions are enough. There is no sharding, queue or cache layer to build for a campus of this size.

### 3.2 Monthly request volume

| Scenario | Student, 5 s | Student, 30 s | Vendor consoles, 5 s | Vendor consoles, 30 s |
| --- | --- | --- | --- | --- |
| Pilot | 0.19 M | 0.03 M | 1.2 M | 0.2 M |
| Campus, base | 2.1 M | 0.35 M | 9.1 M | 1.5 M |
| Campus, good | 3.4 M | 0.56 M | 9.1 M | 1.5 M |
| Stress | 5.1 M | 0.84 M | 9.1 M | 1.5 M |

Vendor console assumption: 15 stores, 2 devices each, open 14 hours a day, polling continuously.

**Finding:** vendors, not students, generate most of the traffic. At 5-second polling the campus-good case is about 12.5 M requests a month; at 30 seconds it is about 2.1 M. Vercel Pro includes roughly 1 M function invocations and charges about $0.60 per extra million (from memory), so the saving is only about $6 a month. The real benefit is less load, less battery use and fewer failure modes, not money.

### 3.3 Database growth

| Scenario | Rows / month | Storage / month |
| --- | --- | --- |
| Campus, good | about 187,000 | about 47 MB |
| Stress | about 281,000 | about 70 MB |

At the stress rate, a year of orders is under 1 GB. The 8 GB included with Supabase Pro lasts years. Old data needs archiving only after multiple campuses.

### 3.4 Realtime connections

Peak concurrent users (139 in the stress case) fit inside the 200 concurrent Realtime connections of Supabase's free tier and 500 on Pro (from memory). Realtime is therefore **possible**, but **not required by load**. It is an experience upgrade, covered in section 7.

## 4. Monthly cost model (campus, good case)

Assumes ₹85 per US dollar. All prices from memory; confirm them.

| Item | Setup A: keep Express on Vercel | Setup B: slimmed down (recommended) |
| --- | --- | --- |
| Supabase Pro | $25 | $25 |
| Vercel Pro (commercial use needs a paid plan) | $20 | $20 until Express is retired, then $0 if the frontends move to Cloudflare Pages |
| Function overage (at 5 s polling) | about $6 | about $0 (30 s polling) |
| Image bandwidth, resized photos | $0 (within 250 GB) | $0 |
| Image bandwidth, unprocessed photos | **about $320** (about 3.8 TB at about $0.09/GB beyond the included 250 GB) | not applicable |
| **Total, approx.** | about $51 (₹4,300) | about $45 (₹3,800), falling to $25 (₹2,100) once Express is gone |
| SMS one-time (first-month logins) | ₹1,000–16,000 depending on provider | same |

**Infrastructure per order** (46,764 orders a month): about ₹0.08–0.09 per order for the platform itself. The business model in [BUSINESS_MODEL.md](BUSINESS_MODEL.md) estimates about ₹29 gross margin per order and about ₹15,000 a month of fixed costs, so hosting is a rounding error. **Do not trade reliability or safety for infrastructure savings at this scale.**

Vercel's Hobby plan is for non-commercial use, so the live version needs Vercel Pro, or Cloudflare Pages (free and allowed commercially) for the static frontends.

## 5. Product photos: do the numbers work?

### 5.1 The size problem

Typical phone photos (ranges, not measurements of Poolit's photos):

| Source | Typical file size |
| --- | --- |
| 12 MP photo (default on most phones) | 2–5 MB |
| 48–50 MP mode | 6–12 MB |
| 108–200 MP mode | 15–40 MB |
| Web-ready WebP, 800 px wide, plain product shot | about 25–60 KB (planning figure: 45 KB) |
| Web-ready WebP, 400 px wide thumbnail | about 10–20 KB (planning figure: 15 KB) |

Assumptions: a campus catalogue of 600 distinct products, one photo per product (not per store), and each active user downloading about 100 distinct images in their first month.

| Image set | Storage for 600 products | One home screen of 24 cards |
| --- | --- | --- |
| Raw 12 MP JPEG (4 MB) | 2.4 GB | **96 MB** |
| Raw 50 MP (10 MB) | 6.0 GB | **240 MB** |
| 1600 px WebP (180 KB) | 108 MB | 4.3 MB |
| 800 px WebP (45 KB) | 27 MB | 1.1 MB |
| 400 px WebP (15 KB) | 9 MB | 0.36 MB |

A home screen of raw photos would take 96–240 MB on a student's mobile data. The app would be unusable on hostel Wi-Fi at 9 pm, whatever the server does.

### 5.2 Monthly bandwidth (egress), campus-good case (3,600 active users)

Steady month: about 10 new or changed images per user, plus 30% of sessions re-downloading about 20 images after the browser cache evicts them.

| Image set | First month | Steady month | Against 250 GB included (Pro) |
| --- | --- | --- | --- |
| Raw 12 MP (4 MB) | 3,829 GB | 2,389 GB | **15× over** |
| Raw 50 MP (10 MB) | 9,572 GB | 5,972 GB | **38× over** |
| 1600 px WebP | 172 GB | 108 GB | 43% of included |
| 800 px WebP | 43 GB | 27 GB | 11% |
| 400 px thumbs plus 800 px detail | about 25 GB | about 15 GB | 6% |

Under the pilot scenario (200 active users), 800 px images use 2.4 GB in the first month, which even the free tier's 5 GB covers.

### 5.3 Verdict on downsizing

**Downsizing is mandatory, not optional.**

- Resize once, **on the vendor's phone before upload**. The server never sees the 5–10 MB original, so storage and upload time stay small.
- Keep two sizes: a **400 px thumbnail** for grids and a **800 px image** for the product page. Skip 1600 px: phone screens show a card at about 160–200 CSS px (about 400–600 device pixels), and 1600 px costs 4× the bandwidth for no visible gain.
- Use **WebP, quality 75–80**. Fall back to JPEG when the browser can't encode WebP (see 5.4).
- Name files by content hash and serve them with a one-year cache header. A browser then downloads each photo once per device.

### 5.4 Implementability test (run in this session)

I ran a resize in headless Chromium (server-class CPU) on synthetic 12 MP (4000×3000) and 50 MP (8160×6120) images, using `createImageBitmap` with a target width, then `canvas.toBlob('image/webp')`.

| Input | 800 px WebP: time | 400 px WebP: time |
| --- | --- | --- |
| 12 MP | 0.40 s | 0.09 s |
| 50 MP | 0.79 s | 0.34 s |

Results:

- The pipeline works with plain browser APIs and no library or server component.
- Decoding with a target width (`createImageBitmap`) avoids holding a full 50 MP bitmap, which matters on low-memory phones.
- A budget phone is perhaps 3–5× slower than this machine, so budget **2–4 seconds** for a 50 MP photo. A one-time "optimising photo…" spinner is acceptable for a vendor action.
- **The file sizes from this test are not meaningful.** The synthetic images are smoother than real photos (the 12 MP original came out at 0.7 MB, not 3–5 MB). Use the ten-photo acceptance test below for real sizes.
- **Safari/iPhone caveat:** Safari has historically not encoded WebP from a canvas; it silently returns PNG. The upload code must check `blob.type` and fall back to JPEG (about 40–80 KB at 800 px, still fine). Vendors are often on iPhones, so this must be tested on a real device.

**Ten-photo acceptance test (before building the full feature):**

1. Photograph 10 real products on a plain background with a mid-range phone.
2. Run them through the resize step. Record original size, 800 px size, 400 px size and processing time.
3. Pass if: 800 px ≤ 80 KB, 400 px ≤ 30 KB, processing ≤ 5 s on the vendor's own phone, product text still readable on a 360 px-wide screen.
4. If 800 px is above 80 KB, lower WebP quality to 70 or crop the background tighter. Do not raise the size limit.

### 5.5 Where to store them

| Option | Cost at 600 products (about 36 MB total) | Egress | Effort | Sustainable | Practical |
| --- | --- | --- | --- | --- | --- |
| **Supabase Storage** (public bucket, vendor upload allowed by a storage policy) | Within the 100 GB included | Within the 250 GB included; has a built-in CDN | About 1–2 days. One login, one bill, permissions use the same vendor-to-store link | ▰▰▰▰▱ | ▰▰▰▰▰ |
| **Cloudflare R2** (S3-compatible) | 10 GB free, then about $0.015/GB-month | **Free** | About 3–4 days: needs a small signed-upload endpoint and a second account | ▰▰▰▰▰ | ▰▰▰▱▱ |
| **AWS S3 plus CloudFront** | About $0.023/GB-month | About $0.085/GB | About 4–5 days, plus IAM and policies | ▰▰▰▱▱ | ▰▰▱▱▱ |
| **Image URL pasted by the vendor** (stop-gap) | $0 | Someone else's site | Hours | ▰▱▱▱▱ | ▰▰▰▰▰ |

**Recommendation: Supabase Storage now.** Resized photos need about 6–11% of the included bandwidth even in the good case. Move to Cloudflare in front of the bucket (a cache, no code change) or to R2 **only if** monthly egress passes about 60% of the included amount (150 GB). The database stores only a file path, so the move is a configuration change later.

Storage is not the limit: 600 products at both sizes is about 36 MB. The "storage fills up" concern disappears once photos are resized. It would only return with raw originals or per-store duplicate photos. One photo per product, shared across stores, keeps it small.

## 6. Architecture decision register

Decision 1 is the answer to "should we remove the Vercel backend?".

| # | Decision | Verdict | Why (numbers) | Sustainable | Practical |
| --- | --- | --- | --- | --- | --- |
| 1 | Remove Express completely | **Yes, within three weeks**, behind a `VITE_BACKEND` rollback switch. Load does not require it; the reasons are one fewer system, no cron limit, and payments built once as Edge Functions. | Write functions are granted to `service_role` only today, so the access checks must first move into the functions (`auth.uid()` plus `vendor_users`), and a cross-user test suite must prove them before cutover. The single frontend seam (`api.ts`) makes the switch a config change. | ▰▰▰▰▰ | ▰▰▰▱▱ |
| 2 | Slim Express: move cron and public reads out | **Yes** | Removes the cron limit and the biggest request source | ▰▰▰▰▰ | ▰▰▰▰▱ |
| 3 | RLS read policies for public catalogue data | **Yes** | Hostels, stores, menu, current pool are not secret. Reads then skip Express. | ▰▰▰▰▰ | ▰▰▰▰▱ |
| 4 | Function checks and RLS for private data (orders, students) | **Yes, week 1, gated by tests** | A mistake leaks phone numbers and rooms, so the cross-user suite (student A vs B, vendor X vs Y, anonymous) must pass in CI before the apps are switched over. | ▰▰▰▰▰ | ▰▰▰▱▱ |
| 5 | `pg_cron` closes and rotates pools | **Yes, first** | Replaces the in-process scheduler and the sweep route; no Vercel cron needed | ▰▰▰▰▰ | ▰▰▰▰▰ |
| 6 | Polling 5 s → 30 s plus refresh on focus | **Yes** | 12× fewer requests; students see the pool timer locally, so 30 s is invisible | ▰▰▰▰▰ | ▰▰▰▰▰ |
| 7 | Supabase Realtime | **Week 2, vendor orders only; first to be cut if late** | Not needed for load. Improves "new order" latency from up to 30 s to under 2 s. | ▰▰▰▰▱ | ▰▰▰▱▱ |
| 8 | Product photos in Supabase Storage, resized on the phone | **Yes** | See section 5 | ▰▰▰▰▱ | ▰▰▰▰▱ |
| 9 | Separate S3 and a paid CDN | **No, not yet** | Only worth it above 150 GB a month of egress | ▰▰▰▰▰ | ▰▰▱▱▱ |
| 10 | CORS allowlist (`ALLOWED_ORIGINS`) | **Yes, today** | A config change. Not a security control on its own, since RLS and keys are the real protection. | ▰▰▰▱▱ | ▰▰▰▰▰ |
| 11 | Shared rate limiting (Upstash Redis) | **Defer. Use a database rule instead.** | The in-memory limiter is per serverless instance, so it is only a speed bump. A database rule ("one order per student per pool", checked inside `place_order`) is exact, free and needs no new service. | ▰▰▰▰▰ | ▰▰▰▰▱ |
| 12 | Sentry plus uptime check | **Yes** | Free tiers cover this volume | ▰▰▰▰▰ | ▰▰▰▰▰ |
| 13 | Multi-region, queues, Redis cache, microservices | **No** | 0.16 orders/s. No problem exists to solve. | ▰▱▱▱▱ | ▰▱▱▱▱ |

## 7. Make-do options when the proper fix is out of reach

| Need | Proper fix | Make-do that is acceptable for the pilot |
| --- | --- | --- |
| Photos | Storage bucket with in-browser resize | Vendor pastes an image link into an `image_url` column; emoji tile when empty. Replace after the pilot. |
| Live order updates | Realtime | 15–30 s polling plus an immediate refresh when the tab becomes visible |
| Strong rate limiting | Shared Redis limiter | Database rule inside `place_order` plus the existing per-instance limiter |
| Vendor access in RLS | Full policy set with tests | Keep enforcement in Express (`ENFORCE_VENDOR_SCOPING=true`); it is already coded and tested |
| Staging environment | Separate Supabase project with CI | Supabase branching, or a second free project with migrations applied by hand |
| Analytics trend data | Daily revenue aggregate table | Compute from `orders` on demand; fine under 100,000 rows |

## 8. Plan

The week-by-week plan, with developer-day estimates, confidence meters, gates and the cut order, lives in [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md#three-week-plan-to-pilot-readiness) so there is one source of truth. In short: week 1 secures the database and proves it with tests; week 2 moves both apps off Express, finishes photos and builds payments as Edge Functions; week 3 cuts over, hardens, and finishes the legal and documentation drafts.

## 9. What to revisit as it grows

| Trigger | Revisit |
| --- | --- |
| Image egress above 150 GB a month | Put Cloudflare in front of the bucket, or move to R2 |
| Sustained above 100 requests/s or database CPU above 60% | Larger Supabase compute size, then query review. Not a rewrite. |
| More than 3 campuses | Per-campus tenant column on every table, support tooling, archive old orders |
| Payments go live | Edge Function webhook with signature checks and idempotency keys; retire Express once nothing depends on it |
| More than 200 simultaneous Realtime connections | Move to the Pro tier limit (500) or reduce to vendor-only Realtime |
| Native app requested | Version the API (`/v1`) first |

## 10. Risks in this analysis

- **Campus size and adoption are assumptions.** The conclusions hold with a 3× error in either direction, because even the stress case uses a small fraction of one project's capacity. They do not hold with raw photos at any scale.
- **Prices and limits are from memory.** A change in free-tier limits could shift the cost table, but not the ranking of options.
- **Image sizes are planning figures.** The ten-photo test is the guard.
- **I have not load-tested the live system.** The week 3 replay test does that.
- **Safari WebP behaviour** is from memory and must be checked on a real iPhone.
