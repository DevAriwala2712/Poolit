# Poolit — Scale, Cost and Product-Photo Analysis

As of 4 Nov 2026 (updated after the owner's answers: 17 hostels, 10–12 thousand students, free plans, native app). Companion to [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md). It answers three questions with numbers:

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
| Is the stack big enough for the whole campus? | **Yes for load.** The busiest evening needs about 14–34 requests per second even with 5-second polling (2–6 with 30-second polling). One small Supabase project handles that. |
| Does the **free** plan work? | **For a one- to three-hostel pilot, yes. For all 17 hostels, not for long.** Free Supabase allows 5 GB of data transfer and 500 MB of database a month; the campus-wide good case needs about 4–6 GB of transfer and fills the database in about 3–4 months. See section 11. |
| Biggest risk | **Product photos.** Unprocessed phone photos would use hundreds of times the free transfer. Resized photos behind Cloudflare's free cache stay inside it. |
| Do we need to remove the Vercel backend to scale? | **No.** Load does not require it. Doing it removes a system, the cron limit, and the Hobby plan's non-commercial restriction. |
| Biggest hidden cost? | Vendor consoles polling every 5 seconds: about 10 M requests a month, more than all students combined. |
| Infrastructure cost per order? | Free plan: nothing but your time. Paid plan: about ₹0.04–0.10 per order. The payment gateway (about ₹5 on a ₹250 basket) costs 50–100× more. |

## 2. Assumptions

### 2.1 Campus size

Hostel count and student count come from the owner. The active share is a guess.

| Input | Value | Why |
| --- | --- | --- |
| Hostels with a store | 17 | Owner |
| Hostel residents | 11,000 | Owner: 10–12 thousand; about 650 per hostel |
| Weekly active users (WAU) | 20% pilot, 25% base, 40% good, 60% stress | Quick-commerce adoption on a captive campus; 60% is a deliberately hostile case |
| Orders per active user per week | 3 | Snack and essentials ordering |
| App sessions per active user per week | 6 | About two sessions per order (browse, order, track) |
| Foreground time per session | 3 minutes | Polling only runs while the app is visible |
| Busiest hour share | 25% of a day's orders, 20% of a day's sessions | Evening cluster (about 9–11 pm) |
| Burst factor inside that hour | 3× | Pools close on timers, so people arrive together |
| Rows per order | 4 (1 order plus about 3 lines) at about 250 bytes, doubled for indexes | Small |
| Catalogue | 600 distinct products across all stores | Planning figure |

### 2.2 Scenarios

| Scenario | Hostels | Active users | Orders / day | Orders / month | Orders in busiest hour |
| --- | --- | --- | --- | --- | --- |
| Pilot | 2 | 260 | 111 | 3,400 | 27 |
| Campus, base | 17 | 2,750 | 1,178 | 35,700 | 294 |
| Campus, good | 17 | 4,400 | 1,885 | 57,200 | 471 |
| Stress | 17 | 6,600 | 2,828 | 85,700 | 707 |

## 3. Traffic and database load

### 3.1 Concurrent users and requests per second

Concurrent users are the average foreground sessions in the busiest hour, times the 3× burst factor. The "5 s" column is today's behaviour (12 requests a minute per open app). The "30 s" column is the proposed one (2 a minute).

| Scenario | Peak concurrent users | Student requests/s at 5 s polling | At 30 s polling |
| --- | --- | --- | --- |
| Pilot | 6 | 1.3 | 0.2 |
| Campus, base | 70 | 14.1 | 2.4 |
| Campus, good | 113 | 22.6 | 3.8 |
| Stress | 169 | 33.9 | 5.7 |

Orders themselves are tiny: 707 in the busiest hour is **0.2 orders per second**. Even if a whole hostel's pool closed at once, that is a burst of a few dozen writes.

**Conclusion:** one small Postgres instance is enough. There is no sharding, queue or cache layer to build for a campus of this size.

### 3.2 Monthly request volume

| Scenario | Student, 5 s | Student, 30 s | Vendor consoles, 5 s | Vendor consoles, 30 s |
| --- | --- | --- | --- | --- |
| Pilot | 0.24 M | 0.04 M | 1.2 M | 0.2 M |
| Campus, base | 2.6 M | 0.43 M | 10.3 M | 1.7 M |
| Campus, good | 4.1 M | 0.69 M | 10.3 M | 1.7 M |
| Stress | 6.2 M | 1.03 M | 10.3 M | 1.7 M |

Vendor console assumption: 17 stores, 2 devices each, open 14 hours a day, polling continuously. Vendors, not students, generate most of the traffic. Slowing the vendor poll saves load and battery; the money saved is small.

### 3.3 Database growth

Orders written per month, times 4 rows at about 250 bytes, doubled to allow for indexes:

| Scenario | Database growth / month | Months to fill the free 500 MB (using 400 MB) |
| --- | --- | --- |
| Pilot | about 7 MB | about 57 |
| Campus, base | about 71 MB | about 5.6 |
| Campus, good | about 114 MB | about 3.5 |
| Stress | about 171 MB | about 2.3 |

The paid plan includes 8 GB, which lasts years. Archiving old orders extends the free plan but adds work, so a paid plan is the simpler fix once the campus is live.

### 3.4 Realtime connections

Peak concurrent users (169 in the stress case) fit inside the free plan's 200 concurrent Realtime connections only if every student app held one. Realtime for **vendors only** (34 devices) is comfortably inside the limit. Realtime is therefore possible, but not required by load; it is a Phase 2 item.

## 4. Monthly cost model

Assumes ₹85 per US dollar. All prices from memory; confirm them before budgeting.

### 4.1 Recommended free stack

| Item | Plan | Cost |
| --- | --- | --- |
| Database, login, storage, Edge Functions, `pg_cron` | Supabase Free | $0 |
| Three frontends | Cloudflare Pages (free; commercial use is allowed, unlike Vercel Hobby) | $0 |
| Photo cache | Cloudflare free proxy cache in front of the Supabase bucket | $0 |
| Nightly backup storage | Cloudflare R2, 10 GB free | $0 |
| CI, scheduled jobs (keep-alive, backups, Android build) | GitHub Actions free minutes | $0 |
| Error tracking, uptime check | Sentry free, UptimeRobot free | $0 |
| Push notifications | Firebase Cloud Messaging | $0 |
| Domain | Any registrar | about ₹800–1,000 a year |
| Google Play developer account | One time | $25 (about ₹2,100) |
| Apple Developer Program (later) | Yearly | $99 (about ₹8,400) |
| SMS login codes | Per message; Indian SMS must use a registered sender | roughly ₹0.15–4 per code depending on provider; about 4,000–6,000 codes in the first campus month, so ₹600–24,000 once, then much less |

Everything above is free except the domain, the Play account and SMS. The single largest real cost at launch is SMS, so choose the provider by price per code after DLT registration.

### 4.2 When to move to paid Supabase ($25 a month, about ₹2,100)

Move when **any one** of these happens:

- Monthly data transfer passes 3.5 GB (70% of the 5 GB free allowance)
- Database size passes 350 MB (70% of 500 MB)
- The project pauses and a customer notices
- You need daily backups with point-in-time restore, or the pilot grows past three hostels

Infrastructure on the paid plan costs about ₹2,100 a month. At 57,200 orders a month that is about ₹0.04 per order (the earlier estimate of ₹0.08–0.10 included Vercel Pro, which this plan no longer needs). The business model document estimates about ₹29 gross margin per order, so hosting is a rounding error once volume exists. **Do not trade safety for hosting savings.**

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

### 5.2 Monthly bandwidth (egress), campus-good case (4,400 active users)

Steady month: about 10 new or changed images per user, plus 30% of sessions re-downloading about 20 images after the browser cache evicts them. This is pessimistic for a native app, which keeps images on the device.

| Image set | First month | Steady month | Against free 5 GB | Against paid 250 GB |
| --- | --- | --- | --- | --- |
| Raw 12 MP (4 MB) | 4,680 GB | 2,920 GB | about 580× over | 12–19× over |
| Raw 50 MP (10 MB) | 11,699 GB | 7,299 GB | about 1,460× over | 29–47× over |
| 1600 px WebP | 211 GB | 131 GB | about 26× over | 52–84% |
| 800 px WebP | 53 GB | 33 GB | about 7× over | 13–21% |
| 400 px thumbs plus 800 px detail (about 20% of images) | about 28 GB | about 17.5 GB | about 3.5–5.6× over | 7–11% |
| Same, **behind Cloudflare's cache** | under 1 GB from Supabase (only cache misses reach it) | under 1 GB | **inside the free allowance** | negligible |

Under the pilot scenario (260 active users), 400 px thumbs plus 800 px detail use about 1–2 GB a month, inside the free allowance even without the cache.

**Free-plan consequence:** resizing alone does not fit the free 5 GB at campus scale. Resizing **and** the free Cloudflare cache in front of the bucket does, because browsers and Cloudflare serve repeat views. That is why the cache is in week 3 of the plan and needs a domain.

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

**Recommendation: Supabase Storage as the origin, with Cloudflare's free cache in front from the start.** On the free plan the cache is required, not optional (section 5.2). On the paid plan resized photos need only 7–11% of the included bandwidth even in the good case. Move to Cloudflare R2 (zero egress fees) only if the cache hit rate is poor or storage outgrows the plan. The database stores only a file path, so the move is a configuration change later.

Storage is not the limit: 600 products at both sizes is about 36 MB. The "storage fills up" concern disappears once photos are resized. It would only return with raw originals or per-store duplicate photos. One photo per product, shared across stores, keeps it small.

## 6. Architecture decision register

Decision 1 is the answer to "should we remove the Vercel backend?".

| # | Decision | Verdict | Why (numbers) | Sustainable | Practical |
| --- | --- | --- | --- | --- | --- |
| 1 | Remove Express completely | **Yes, in weeks 1–3**, behind a `VITE_BACKEND` rollback switch. Load does not require it; the reasons are one fewer system, no cron limit, and payments built once as Edge Functions. | Write functions are granted to `service_role` only today, so the access checks must first move into the functions (`auth.uid()` plus `vendor_users`), and a cross-user test suite must prove them before cutover. The single frontend seam (`api.ts`) makes the switch a config change. | ▰▰▰▰▰ | ▰▰▰▱▱ |
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

The phase and week plan, with dates, developer-day estimates, gates and the cut order, lives in [PRODUCTION_PLAN.md](PRODUCTION_PLAN.md#plan-phases-weeks-and-dates) so there is one source of truth. In short: Phase 1A (weeks 1–3) secures the database, moves both apps off Express, adds photos and cash-on-delivery, and finishes the legal drafts; Phase 1B (weeks 4–5) adds the Android student app and the UI consistency work; Phase 2 adds UPI and the compliance sign-offs.

## 9. What to revisit as it grows

| Trigger | Revisit |
| --- | --- |
| Photo cache hit rate poor, or storage outgrows the plan | Move photos to Cloudflare R2 (no egress fees) |
| Sustained above 100 requests/s or database CPU above 60% | Larger Supabase compute size, then query review. Not a rewrite. |
| More than 3 campuses | Per-campus tenant column on every table, support tooling, archive old orders |
| UPI payments go live (Phase 2) | Edge Function webhook with signature checks and idempotency keys |
| More than 200 simultaneous Realtime connections | Move to the Pro tier limit (500) or reduce to vendor-only Realtime |
| Native app requested | Version the API (`/v1`) first |

## 10. Risks in this analysis

- **Campus size and adoption are assumptions.** The conclusions hold with a 3× error in either direction, because even the stress case uses a small fraction of one project's capacity. They do not hold with raw photos at any scale.
- **Prices and limits are from memory.** A change in free-tier limits could shift the cost table, but not the ranking of options.
- **Image sizes are planning figures.** The ten-photo test is the guard.
- **I have not load-tested the live system.** The week 3 replay test does that.
- **Safari WebP behaviour** is from memory and must be checked on a real iPhone.

## 11. Does the free plan hold? (campus-good case, 17 hostels)

Free-plan limits are from memory; confirm them.

| Limit | Free allowance | Campus-good need | Fits? | Mitigation |
| --- | --- | --- | --- | --- |
| Data transfer, API | 5 GB a month | about 4.2 GB (30-second polling, about 25 KB catalogue load plus small polls per session) | Barely; **no** at stress (about 6.3 GB) | Cache the catalogue on the device; trigger to move to paid |
| Data transfer, photos | included in the same 5 GB | 17–28 GB uncached | **No** without the cache | Cloudflare cache in front of the bucket |
| Database size | 500 MB | fills in about 3.5 months | Pilot yes, campus no | Archive old orders, or paid plan |
| Storage | 1 GB | about 36 MB of photos | Yes | None needed |
| Edge Function calls | 500,000 a month | push notifications and (later) payments: well under | Yes | None needed |
| Auth users | 50,000 monthly active | 11,000 at most | Yes | None needed |
| Realtime connections | 200 | 34 if vendor-only | Yes | Do not give every student a live connection |
| **Inactivity pause** | Project pauses after about a week without activity | Happened on 2 Nov 2026; college breaks and exams will repeat it | **Risk** | Scheduled keep-alive request; paid plan removes it |
| **Backups** | No point-in-time restore on free | Needed before real money and student data | **Gap** | Nightly encrypted dump to a private R2 bucket, tested restore |
| Vercel Hobby | Non-commercial use only | A paid service is commercial | **Not allowed** | Cloudflare Pages |

**Verdict:** the free stack is a legitimate way to run a pilot of one to three hostels, provided the three safeguards (keep-alive, nightly backup, Cloudflare cache) are in week 1–3 of the plan. It is not a sustainable base for 17 hostels. Budget the $25 plan for the point the pilot succeeds, and treat the triggers in section 4.2 as the signal.

## 12. Native student app

**Recommended approach: wrap the existing student web app with Capacitor.** Reasons:

- **No redesign.** The owner asked to keep the current look. Rebuilding in React Native or Flutter would mean re-creating every screen.
- **One codebase.** The same React code ships to the web, Android and (later) iPhone.
- **Free tooling.** Capacitor and Firebase Cloud Messaging are free. Android builds run in GitHub Actions.
- **Talks to Supabase directly,** so removing Express helps rather than complicates it.

| Item | Android | iPhone |
| --- | --- | --- |
| Build in this plan | Yes, weeks 4–5 | Not yet |
| Store account | Google Play, $25 once | Apple Developer Program, $99 a year |
| Free interim | Direct APK download from the website; installable web app | Installable web app ("Add to Home Screen") |
| Push notifications | Firebase Cloud Messaging, free | Needs the Apple account and its certificates |
| Publishing time | Review of days. **Google may require a closed test with 12 testers for 14 days for a new personal account**; an organisation account may be exempt (verify the current rule). Start the clock in week 4. | Review of days, and Apple can reject apps that only wrap a website; the app needs real native features such as push and haptics |

Native features worth including because they genuinely help students: push notifications when a pool closes or an order is dispatched, haptics on add-to-cart, correct back-button behaviour, and offline start. The vendor console stays a website and installable web app, as agreed.

## 13. UI consistency audit (no redesign)

Measured from the code on 4 Nov 2026.

| Finding | Student app | Vendor console |
| --- | --- | --- |
| Distinct hard-coded font sizes | **26** (e.g. 11, 11.5, 12, 12.5, 13, 13.5, 14, 15 px) | 11, with a named type scale (good) |
| Hard-coded colours in components outside the design tokens | 21 | 6 |
| Button/control minimum heights in use | 7 different (36, 40, 44, 46, 48, 52, 56 px) | not measured |
| Design tokens | Cream/lime/coral palette in `index.css` | Material-style palette in `index.css` |
| Duplicated code across the two apps | Logo (identical), toast, connection gate, auth and clock hook (near copies of 2–130 differing lines) | same |
| Fonts | Inter via system stack | Geist, JetBrains Mono and Material Symbols loaded from Google Fonts at run time |

**What this means.** The two apps intentionally look different, and that stays. The inconsistencies are *inside* each app and in how the two are built. The plan:

1. **Tokens, not rewrites.** Define one type scale, one control-height scale (all tappable controls at least 44 px) and one radius/spacing scale per app. Map every existing value to its nearest token. Where two values are visually indistinguishable (13 px and 13.5 px), pick one.
2. **Shared pieces.** Move the duplicated toast, connection gate, auth and logo code into the shared package, and add standard loading, empty and error states so every screen behaves the same way.
3. **Proof of no redesign.** Capture screenshots of every screen at three phone widths **before** starting; capture again after. Anything that changed must be an intended fix on the list; everything else must be pixel-identical or explained.
4. **Consistent wording and formats.** One place for currency, date, time and "pool" wording, so the same thing is never written two ways.
5. **Self-host fonts.** Faster first load on campus Wi-Fi, works offline in the native app, and no third-party request per visit (also helps the privacy notice).

## 14. Vendor console deployment check

What I could verify from the repository and GitHub, and what I could not.

**Verified**

- Three Vercel projects exist and deploy from GitHub: `student`, `vendor` and `backend`, under the owner's Vercel account. The latest merged pull request (2 Nov 2026) shows all three deployments as **successful**.
- The vendor console builds cleanly here (`vite build`), all 15 unit tests pass and the type check shows no errors.
- The earlier question about the project's Root Directory is answered: the deploy history shows a Root Directory fix followed by working deployments.
- `frontend/apps/vendor/vercel.json` correctly rewrites all routes to the app shell while leaving `/assets`, `/icons`, the service worker and the manifest alone; it sets security headers, allows the camera for the barcode scanner, and caches built files for a year.
- The service worker is network-first for the app shell and never caches API calls, so stock counts are never stale.

**Could not verify**

- The live address of the vendor site. The repository does not record it and I cannot open the Vercel dashboard from here, so I did not open the live site, check which environment variables are set, or confirm `ENFORCE_VENDOR_SCOPING` or `ALLOWED_ORIGINS`.

**Issues found and where they are fixed in the plan**

| Issue | Fix | When |
| --- | --- | --- |
| Hosted on Vercel Hobby-style projects; paid use needs a paid plan | Move to Cloudflare Pages | Week 3 |
| No Content-Security-Policy header | Add one after fonts are self-hosted | Week 5 |
| Fonts loaded from Google at run time | Self-host | Week 5 |
| Single main script of 564 KB (157 KB compressed) because Analytics and charts load for everyone | Split Analytics out | Week 5 |
| The app is built against `VITE_API_URL`; after Express is removed it must point at Supabase only | The `VITE_BACKEND` switch and environment clean-up | Weeks 2–3 |
